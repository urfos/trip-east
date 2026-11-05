// Trip East: tap to travel Paris -> Lausanne -> Weisendorf -> Prague.
// Each leg: close-up on the passengers, drive (stopping on the way for the road photo, if any),
// zoom out to the map, then the city's photos open.
// Debug hashes: #at=N (parked in city N), #leg=N&t=0.5 (partway through a leg), #view=overview,
// #photos=N (open the viewer for city N), #road=N (the road photo of leg N),
// #public (cartoon heads even if avatars-local/ exists), #lang=ru (language without the title page).
(async function () {
  const stage = document.getElementById("stage");
  const hud = document.getElementById("hud");
  const hash = new URLSearchParams(location.hash.slice(1));

  // Language: chosen on the title page and remembered per browser. Until then: the last choice,
  // else Russian for a Russian browser, else English. Storage can be unavailable (private mode).
  const LANG_KEY = "trip-east-lang";
  let lang = hash.get("lang");
  try { lang = lang || localStorage.getItem(LANG_KEY); } catch (e) {}
  if (!TripTexts[lang]) lang = navigator.language.startsWith("ru") ? "ru" : "en";
  const T = () => TripTexts[lang];
  function applyTexts() {
    document.documentElement.lang = lang;
    document.title = T().title;
    document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = T()[el.dataset.t]; });
    document.querySelectorAll("[data-t-aria]").forEach((el) => {
      el.setAttribute("aria-label", T()[el.dataset.tAria]);
    });
  }
  applyTexts(); // before loading anything, so the title page shows in this language at once

  // photos.local.json (gitignored) holds the real photos and wins when present;
  // the published site only has the placeholder photos.json.
  // "reload" always goes to the server, so a rebuilt manifest is never served from a stale cache.
  const fetchJson = (url) => fetch(url, { cache: "reload" }).then((r) => r.json());
  async function loadManifest() {
    try {
      const local = await fetch("photos.local.json", { cache: "reload" });
      if (local.ok) return await local.json();
    } catch (e) {}
    return fetchJson("photos.json");
  }

  const [map, manifest] = await Promise.all([
    fetchJson("map.json"),
    loadManifest(),
  ]);
  const photosOf = (city) => (manifest.chapters.find((c) => c.city === city) || { photos: [] }).photos;
  const roadOf = (from, to) => (manifest.roads || []).find((r) => r.from === from && r.to === to);

  const travel = TripTravel.createTravel(stage, map, { publicOnly: hash.has("public") });
  travel.setLabels(T().city);
  const viewer = TripViewer.create(document.getElementById("viewer"), T);
  const popup = TripViewer.createPopup(document.getElementById("road-photo"));
  // audio/<City>.mp3 plays in each town and audio/road.mp3 on every leg (local only; gitignored).
  const tracks = { road: "audio/road.mp3" };
  map.routes.forEach((r) => { tracks[r.to] = `audio/${r.to}.mp3`; });
  const muteBtn = document.getElementById("mute");
  const music = TripMusic.create(tracks, {
    resume: ["road"],
    levels: { road: 0.65 },
    onAvailable: () => { muteBtn.hidden = false; }, // no button on the public site, which has no audio
  });
  // The mute choice is remembered per browser; storage can be unavailable (e.g. private mode).
  const MUTE_KEY = "trip-east-muted";
  function setMuted(value) {
    music.setMuted(value);
    muteBtn.setAttribute("aria-pressed", value); // travel.css shows the matching icon
    muteBtn.setAttribute("aria-label", value ? T().unmute : T().mute);
    try { localStorage.setItem(MUTE_KEY, value ? "1" : "0"); } catch (e) {}
  }
  try { setMuted(localStorage.getItem(MUTE_KEY) === "1"); } catch (e) { setMuted(false); }
  muteBtn.addEventListener("click", (e) => {
    setMuted(!music.isMuted());
    if (e.detail) muteBtn.blur(); // after a mouse click, Space and Enter should drive on, not toggle again
  });
  await travel.ready;

  let at = 0;              // index of the city the vehicle is in
  let busy = false;        // travelling, zooming or viewing photos
  let zoomedOut = false;   // the camera shows the whole trip instead of the vehicle

  const say = (text, pulse) => { hud.innerHTML = pulse ? `<span class="pulse">${text}</span>` : text; };
  const idle = () => say(at < travel.legCount
    ? (zoomedOut ? T().inCity(travel.cities[at]) : "") + T().goTo(travel.cities[at + 1])
    : T().theEnd, true);

  async function showPhotos(city) {
    const photos = photosOf(city);
    if (photos.length) await viewer.open(T().city(city), photos);
  }

  // Where on each road (share of the route, keyed by the destination) the photo stop happens.
  const ROAD_STOP_AT = { Weisendorf: 0.2 };
  const stopAt = (leg) => ROAD_STOP_AT[travel.cities[leg + 1]] ?? 0.5;

  // The midway stop of a leg: shows the road photo until tapped. Undefined when there is none.
  function roadStop(leg) {
    const road = roadOf(travel.cities[leg], travel.cities[leg + 1]);
    if (!road) return undefined;
    new Image().src = road.photo.src; // preload, so the photo pops up without a blank card
    return async () => {
      say(T().tapToContinue, true);
      await popup.show(road.photo, `${T().city(road.from)} → ${T().city(road.to)}`);
      say("");
    };
  }

  async function advance() {
    if (busy || viewer.isOpen()) return;
    busy = true;
    say("");
    if (at >= travel.legCount) at = 0;
    music.play("road"); // before any await, so it still counts as part of the tap
    travel.show(at);
    if (zoomedOut) { await travel.setCamera("follow"); zoomedOut = false; }
    await travel.travelLeg(at, roadStop(at), stopAt(at));
    at++;
    music.play(travel.cities[at]);
    await travel.setCamera("overview");
    zoomedOut = true;
    await showPhotos(travel.cities[at]);
    busy = false;
    idle();
  }

  if (hash.has("road")) {
    const leg = +hash.get("road");
    travel.setState(leg, stopAt(leg));
    busy = true;
    const stop = roadStop(leg);
    if (stop) stop();
  } else if (hash.has("leg")) {
    travel.setState(+hash.get("leg"), +(hash.get("t") || 0));
    busy = true;
  } else if (hash.has("at")) {
    at = +hash.get("at");
    if (at >= travel.legCount) travel.setState(travel.legCount - 1, 1); else travel.setState(at, 0);
  }
  if (hash.get("view") === "overview") { travel.setCamera("overview", { snap: true }); zoomedOut = true; }
  if (hash.has("photos")) {
    busy = true;
    showPhotos(travel.cities[+hash.get("photos")]).then(() => { busy = false; idle(); });
  } else if (!busy) idle();

  // The title page covers the map until a language button is pressed; that sets the language
  // and removes the page without starting the bus. Debug hashes skip it.
  const intro = document.getElementById("intro");
  let introOpen = !["at", "leg", "view", "photos", "road", "lang"].some((k) => hash.has(k));
  if (!introOpen) intro.hidden = true;
  intro.querySelectorAll(".intro-lang").forEach((btn) => btn.addEventListener("click", () => {
    lang = btn.dataset.lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyTexts();
    travel.setLabels(T().city);
    setMuted(music.isMuted()); // relabels the mute button
    if (!busy) idle();
    btn.blur();
    introOpen = false;
    intro.classList.add("closing");
    setTimeout(() => { intro.hidden = true; }, 600); // matches the fade in intro.css
  }));

  window.addEventListener("pointerdown", (e) => {
    music.unlock();
    if (!introOpen && !e.target.closest("button")) advance();
  });
  window.addEventListener("keydown", (e) => {
    music.unlock();
    if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (introOpen) return; // keys only move between and press the language buttons
    if (e.target.closest && e.target.closest("button")) return; // Enter/Space on a button is that button's own action
    advance();
  });
})();
