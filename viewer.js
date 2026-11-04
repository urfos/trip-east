// Full-screen photo viewer. TripViewer.create(rootElement) -> { open(city, photos), close(), isOpen() }.
// open() resolves when the viewer is closed again (Back to map button or Escape).
(function () {
  const SWIPE_PX = 40;
  const FADE_MS = 220;

  function formatDay(iso) {
    return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }

  function create(root) {
    const $ = (sel) => root.querySelector(sel);
    const backBtn = $(".viewer-back"), prevBtn = $(".viewer-nav.prev"), nextBtn = $(".viewer-nav.next");
    const cityEl = $(".viewer-city"), countEl = $(".viewer-count");
    const stage = $(".viewer-stage"), img = $(".viewer-img"), caption = $(".viewer-caption");

    let photos = [], city = "", index = 0, resolveClose = null, hideTimer = null;

    const isOpen = () => root.classList.contains("open");

    function show(i) {
      index = Math.max(0, Math.min(photos.length - 1, i));
      const p = photos[index];
      img.classList.add("loading");
      img.onload = img.onerror = () => img.classList.remove("loading");
      img.src = p.src;
      img.width = p.w;
      img.height = p.h;
      img.alt = `${city}, photo ${index + 1} of ${photos.length}`;
      countEl.textContent = `${index + 1} / ${photos.length}`;
      caption.textContent = p.exact ? formatDay(p.taken) : "";
      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === photos.length - 1;
      [index - 1, index + 1].forEach((j) => { if (photos[j]) new Image().src = photos[j].src; });
    }

    function open(cityName, cityPhotos) {
      city = cityName;
      photos = cityPhotos;
      cityEl.textContent = city;
      clearTimeout(hideTimer);
      root.hidden = false;
      show(0);
      void root.offsetWidth; // let the browser register the hidden -> visible change before fading in
      root.classList.add("open");
      backBtn.focus({ preventScroll: true });
      return new Promise((resolve) => { resolveClose = resolve; });
    }

    function close() {
      if (!isOpen()) return;
      root.classList.remove("open");
      document.activeElement && document.activeElement.blur();
      hideTimer = setTimeout(() => { root.hidden = true; img.removeAttribute("src"); }, FADE_MS);
      const resolve = resolveClose;
      resolveClose = null;
      if (resolve) resolve();
    }

    backBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => show(index - 1));
    nextBtn.addEventListener("click", () => show(index + 1));

    window.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "ArrowRight") { show(index + 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { show(index - 1); e.preventDefault(); }
      else if (e.key === "Escape") { close(); e.preventDefault(); }
    });

    let start = null;
    stage.addEventListener("pointerdown", (e) => { start = { x: e.clientX, y: e.clientY }; });
    stage.addEventListener("pointerup", (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
    });
    stage.addEventListener("pointercancel", () => { start = null; });

    return { open, close, isOpen };
  }

  window.TripViewer = { create };
})();
