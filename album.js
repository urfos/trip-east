(async function () {
  const bookEl = document.getElementById("book");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const whereEl = document.getElementById("where");
  const TURN_MS = 900;
  const PRELOAD = 2; // leaves around the current spread whose images get loaded

  const { chapters } = await (await fetch("photos.json")).json();

  // ---------- Build the sequence of page faces ----------
  // Faces alternate right (front of a leaf) / left (back of a leaf).
  // Chapter title pages are always placed on a right-hand page.
  const faces = [{ kind: "cover" }, { kind: "blank" }];
  chapters.forEach((ch, i) => {
    if (faces.length % 2 === 1) faces.push({ kind: "blank" });
    faces.push({ kind: "chapter", chapter: i, number: i + 1, city: ch.city, dates: dateRange(ch.photos) });
    ch.photos.forEach((p) => faces.push({ kind: "photo", chapter: i, photo: p }));
  });
  if (faces.length % 2 === 1) faces.push({ kind: "blank" });
  faces.push({ kind: "end" }, { kind: "backcover" });

  const leafCount = faces.length / 2;
  const leaves = [];
  for (let i = 0; i < leafCount; i++) {
    const leaf = document.createElement("div");
    leaf.className = "leaf";
    leaf.append(renderFace(faces[2 * i], "front", 2 * i), renderFace(faces[2 * i + 1], "back", 2 * i + 1));
    leaf.addEventListener("click", () => (i < current ? go(-1) : go(1)));
    bookEl.append(leaf);
    leaves.push(leaf);
  }

  // number of leaves turned over; #N in the URL opens the book at that spread
  let current = Math.min(leafCount, Math.max(0, parseInt(location.hash.slice(1), 10) || 0));
  update();

  // ---------- Rendering ----------
  function renderFace(face, side, index) {
    const el = document.createElement("div");
    el.className = `face ${side}`;
    switch (face.kind) {
      case "cover":
        el.classList.add("is-cover");
        el.innerHTML = `<div class="cover"><h1>Trip East</h1>
          <p>${chapters.map((c) => c.city).join(" · ")}</p>
          <p class="hint">Click to open</p></div>`;
        break;
      case "backcover":
        el.classList.add("is-cover");
        el.innerHTML = `<div class="cover"></div>`;
        break;
      case "chapter":
        el.innerHTML = `<div class="chapter-page">
          <div class="num">Chapter ${roman(face.number)}</div>
          <h2>${face.city}</h2><div class="rule"></div>
          <div class="dates">${face.dates}</div></div>`;
        break;
      case "photo": {
        const p = face.photo;
        el.innerHTML = `<div class="photo-page">
          <img data-src="${p.src}" width="${p.w}" height="${p.h}" alt="${chapters[face.chapter].city}">
          <div class="caption">${p.exact ? formatDay(p.taken) : ""}</div></div>
          <div class="folio">${index}</div>`;
        break;
      }
      case "end":
        el.innerHTML = `<div class="blank-page">The End</div>`;
        break;
      default:
        el.innerHTML = `<div class="blank-page"></div>`;
    }
    return el;
  }

  function update() {
    leaves.forEach((leaf, i) => {
      leaf.classList.toggle("flipped", i < current);
      if (!leaf.classList.contains("turning")) leaf.style.zIndex = i < current ? i + 1 : leafCount - i;
    });
    bookEl.classList.toggle("closed-front", current === 0);
    bookEl.classList.toggle("closed-back", current === leafCount);
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === leafCount;
    whereEl.textContent = describe();
    loadNearby();
  }

  function go(dir) {
    const target = current + dir;
    if (target < 0 || target > leafCount) return;
    const leaf = leaves[dir > 0 ? current : current - 1];
    leaf.classList.add("turning");
    leaf.style.zIndex = leafCount + 10;
    clearTimeout(leaf._settle);
    leaf._settle = setTimeout(() => {
      leaf.classList.remove("turning");
      update();
    }, TURN_MS);
    current = target;
    history.replaceState(null, "", current ? `#${current}` : location.pathname);
    update();
  }

  function loadNearby() {
    const from = Math.max(0, current - PRELOAD), to = Math.min(leafCount, current + PRELOAD + 1);
    for (let i = from; i < to; i++) {
      leaves[i].querySelectorAll("img[data-src]").forEach((img) => {
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
      });
    }
  }

  function describe() {
    if (current === 0) return "Cover";
    if (current === leafCount) return "The End";
    const visible = [faces[2 * current - 1], faces[2 * current]];
    const ch = visible.map((f) => f.chapter).filter((c) => c !== undefined).pop();
    return ch === undefined ? "" : `${roman(ch + 1)}. ${chapters[ch].city}`;
  }

  // ---------- Helpers ----------
  function roman(n) {
    return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n - 1] || String(n);
  }

  function formatDay(iso) {
    return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }

  function dateRange(photos) {
    const days = photos.filter((p) => p.exact).map((p) => new Date(p.taken));
    if (!days.length) return "";
    const a = days[0], b = days[days.length - 1];
    const fmt = (d, opts) => d.toLocaleDateString("en-GB", opts);
    if (a.getMonth() === b.getMonth())
      return `${a.getDate()} – ${fmt(b, { day: "numeric", month: "long", year: "numeric" })}`;
    return `${fmt(a, { day: "numeric", month: "long" })} – ${fmt(b, { day: "numeric", month: "long", year: "numeric" })}`;
  }

  // ---------- Sizing: fit the open spread into the viewport ----------
  function fit() {
    const ratio = 3 / 4; // page width / height
    const availW = window.innerWidth - 32, availH = window.innerHeight - 110;
    let h = Math.min(availH, 760), w = h * ratio;
    if (2 * w > availW) { w = availW / 2; h = w / ratio; }
    document.documentElement.style.setProperty("--page-w", `${Math.floor(w)}px`);
    document.documentElement.style.setProperty("--page-h", `${Math.floor(h)}px`);
    const scale = h / 560;
    document.documentElement.style.setProperty("--content-scale", scale.toFixed(3));
  }
  fit();
  window.addEventListener("resize", fit);

  // ---------- Input ----------
  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") go(-1);
  });
  let touchX = null;
  bookEl.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  bookEl.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX = null;
  });
})();
