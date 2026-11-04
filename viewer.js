// Full-screen photo viewer. TripViewer.create(rootElement) -> { open(city, photos), close(), isOpen() }.
// open() resolves when the viewer is closed again (Back to map button, Escape, or "next" on the last photo).
(function () {
  const SWIPE_PX = 40;
  const FADE_MS = 220;
  const SLIDE_PX = 60;              // how far a photo slides while it fades out or in
  const SLIDE_OUT_MS = 160, SLIDE_IN_MS = 260;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function formatDay(iso) {
    return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }

  function create(root) {
    const $ = (sel) => root.querySelector(sel);
    const backBtn = $(".viewer-back"), prevBtn = $(".viewer-nav.prev"), nextBtn = $(".viewer-nav.next");
    const cityEl = $(".viewer-city"), countEl = $(".viewer-count");
    const stage = $(".viewer-stage"), img = $(".viewer-img"), caption = $(".viewer-caption");

    let photos = [], city = "", index = 0, resolveClose = null, hideTimer = null;
    let swap = 0; // bumped on every show(), so a newer photo change cancels an older one mid-way

    const isOpen = () => root.classList.contains("open");

    const slide = (from, to, ms, easing) =>
      img.animate([from, to], { duration: ms, easing, fill: "forwards" }).finished.catch(() => {});

    // Shows photo i. dir = 1 (forward) or -1 (back) slides the old photo out that way and the
    // new one in from the other side; dir = 0 shows it at once.
    async function show(i, dir = 0) {
      i = Math.max(0, Math.min(photos.length - 1, i));
      if (dir && i === index) return;
      index = i;
      const token = ++swap;
      const p = photos[index];
      const animate = dir && !reducedMotion.matches;
      prevBtn.disabled = index === 0;
      nextBtn.setAttribute("aria-label", index === photos.length - 1 ? "Back to map" : "Next photo");

      if (animate) {
        await slide({ opacity: getComputedStyle(img).opacity, transform: getComputedStyle(img).transform },
                    { opacity: 0, transform: `translateX(${-dir * SLIDE_PX}px)` }, SLIDE_OUT_MS, "ease-in");
        if (token !== swap) return;
      } else img.getAnimations().forEach((a) => a.cancel()); // e.g. a slide cut short by close()
      img.src = p.src;
      img.width = p.w;
      img.height = p.h;
      img.alt = `${city}, photo ${index + 1} of ${photos.length}`;
      countEl.textContent = `${index + 1} / ${photos.length}`;
      caption.textContent = p.exact ? formatDay(p.taken) : "";
      [index - 1, index + 1].forEach((j) => { if (photos[j]) new Image().src = photos[j].src; });

      if (animate) {
        await img.decode().catch(() => {}); // slide in only once the new photo can be drawn
        if (token !== swap) return;
        img.getAnimations().forEach((a) => a.cancel());
        slide({ opacity: 0, transform: `translateX(${dir * SLIDE_PX}px)` },
              { opacity: 1, transform: "none" }, SLIDE_IN_MS, "ease-out");
      }
    }

    const next = () => (index === photos.length - 1 ? close() : show(index + 1, 1));
    const prev = () => show(index - 1, -1);

    function open(cityName, cityPhotos) {
      city = cityName;
      photos = cityPhotos;
      cityEl.textContent = city;
      clearTimeout(hideTimer);
      root.hidden = false;
      index = -1;
      show(0);
      void root.offsetWidth; // let the browser register the hidden -> visible change before fading in
      root.classList.add("open");
      backBtn.focus({ preventScroll: true });
      return new Promise((resolve) => { resolveClose = resolve; });
    }

    function close() {
      if (!isOpen()) return;
      root.classList.remove("open");
      swap++; // drop any photo change still in progress
      document.activeElement && document.activeElement.blur();
      hideTimer = setTimeout(() => { root.hidden = true; img.removeAttribute("src"); }, FADE_MS);
      const resolve = resolveClose;
      resolveClose = null;
      if (resolve) resolve();
    }

    backBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", prev);
    nextBtn.addEventListener("click", next);

    window.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "ArrowRight") { next(); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { prev(); e.preventDefault(); }
      else if (e.key === "Escape") { close(); e.preventDefault(); }
    });

    let start = null;
    stage.addEventListener("pointerdown", (e) => { start = { x: e.clientX, y: e.clientY }; });
    stage.addEventListener("pointerup", (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
    });
    stage.addEventListener("pointercancel", () => { start = null; });

    return { open, close, isOpen };
  }

  // Road photo that pops up over the map. TripViewer.createPopup(rootElement) -> { show(photo, caption) }.
  // show() resolves when the photo is tapped or a key is pressed. Input in the first
  // CLOSE_DELAY_MS is ignored, so a tap meant for the map does not dismiss it unseen.
  const CLOSE_DELAY_MS = 400;

  function createPopup(root) {
    const img = root.querySelector(".popup-img"), caption = root.querySelector(".popup-caption");
    let resolveClose = null, shownAt = 0, hideTimer = null;

    function show(photo, text) {
      clearTimeout(hideTimer);
      img.src = photo.src;
      img.width = photo.w;
      img.height = photo.h;
      img.alt = text;
      caption.textContent = text;
      root.hidden = false;
      void root.offsetWidth; // let the browser register the hidden -> visible change before popping in
      root.classList.add("open");
      shownAt = performance.now();
      return new Promise((resolve) => { resolveClose = resolve; });
    }

    function close() {
      if (!resolveClose || performance.now() - shownAt < CLOSE_DELAY_MS) return;
      root.classList.remove("open");
      hideTimer = setTimeout(() => { root.hidden = true; img.removeAttribute("src"); }, FADE_MS);
      const resolve = resolveClose;
      resolveClose = null;
      resolve();
    }

    root.addEventListener("pointerdown", close);
    window.addEventListener("keydown", (e) => {
      if (!resolveClose || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      close();
      e.preventDefault(); // app.js skips handled keys, so this key does not also start the next leg
    });

    return { show };
  }

  window.TripViewer = { create, createPopup };
})();
