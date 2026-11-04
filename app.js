// Trip East: tap to travel Paris -> Lausanne -> Weisendorf -> Prague.
// Each leg: close-up on the passengers, drive, zoom out to the map, then the city's photos open.
// Debug hashes: #at=N (parked in city N), #leg=N&t=0.5 (partway through a leg), #view=overview,
// #photos=N (open the viewer for city N), #public (cartoon heads even if avatars-local/ exists).
(async function () {
  const stage = document.getElementById("stage");
  const hud = document.getElementById("hud");
  const hash = new URLSearchParams(location.hash.slice(1));

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

  const travel = TripTravel.createTravel(stage, map, { publicOnly: hash.has("public") });
  const viewer = TripViewer.create(document.getElementById("viewer"));
  await travel.ready;

  let at = 0;              // index of the city the vehicle is in
  let busy = false;        // travelling, zooming or viewing photos
  let zoomedOut = false;   // the camera shows the whole trip instead of the vehicle

  const say = (text, pulse) => { hud.innerHTML = pulse ? `<span class="pulse">${text}</span>` : text; };
  const idle = () => say(at < travel.legCount
    ? (zoomedOut ? `In ${travel.cities[at]}. ` : "") + `Tap to go to ${travel.cities[at + 1]}`
    : "The end. Tap to start over", true);

  async function showPhotos(city) {
    const photos = photosOf(city);
    if (photos.length) await viewer.open(city, photos);
  }

  async function advance() {
    if (busy || viewer.isOpen()) return;
    busy = true;
    say("");
    if (at >= travel.legCount) at = 0;
    travel.show(at);
    if (zoomedOut) { await travel.setCamera("follow"); zoomedOut = false; }
    await travel.travelLeg(at);
    at++;
    await travel.setCamera("overview");
    zoomedOut = true;
    await showPhotos(travel.cities[at]);
    busy = false;
    idle();
  }

  if (hash.has("leg")) {
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

  window.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) advance(); });
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest("button")) return; // Enter/Space on a button is that button's own action
    advance();
  });
})();
