// Background music: one track at a time, each fading in and out over FADE_MS. Switching tracks
// fades the old one out completely before the new one fades in (no crossfade).
// A track that runs out fades out over its last FADE_MS and stays silent.
// Usage: const music = TripMusic.create({ road: "audio/road.mp3", ... },
//          { resume: ["road"], levels: { road: 0.65 }, onAvailable() {} });
// music.play(name) | music.stop() | music.unlock() (call from every tap or key press)
// | music.setMuted(bool) | music.isMuted().
// The files are local only (audio/ is gitignored); a missing file just means silence.
(function () {
  const FADE_MS = 1500;
  const TICK_MS = 30;

  function create(files, opts = {}) {
    const resume = opts.resume || []; // tracks that continue where they stopped instead of restarting
    const levels = opts.levels || {}; // full volume per track (0-1); 1 when not listed
    const tracks = {};
    let current = null, muted = false, available = false;
    let pending = null; // timer that starts `current` once the previous track has faded out
    let quietAt = 0;    // performance.now() time when every fade-out under way reaches silence

    function fade(t, to, ms = FADE_MS) {
      clearInterval(t.timer);
      const from = t.el.volume, start = performance.now();
      if (to === 0 && from > 0 && !t.el.paused) quietAt = Math.max(quietAt, start + ms);
      t.timer = setInterval(() => {
        const k = Math.min(1, (performance.now() - start) / ms);
        t.el.volume = from + (to - from) * k;
        if (k < 1) return;
        clearInterval(t.timer);
        if (to === 0) t.el.pause();
      }, TICK_MS);
    }

    for (const name in files) {
      const el = new Audio(files[name]);
      el.preload = "auto";
      el.volume = 0;
      const t = { el, level: levels[name] ?? 1, timer: null, missing: false, ending: false };
      el.addEventListener("error", () => { t.missing = true; });
      el.addEventListener("loadedmetadata", () => {
        if (available) return;
        available = true;
        if (opts.onAvailable) opts.onAvailable();
      });
      el.addEventListener("timeupdate", () => {
        const left = (el.duration - el.currentTime) * 1000;
        if (t === current && !t.ending && left < FADE_MS) {
          t.ending = true;
          fade(t, 0, left); // timeupdate comes only every ~250 ms, so fit the fade to what is left
        }
      });
      tracks[name] = t;
    }

    function start(name) {
      const t = tracks[name];
      if (t.ending || !resume.includes(name)) t.el.currentTime = 0;
      t.ending = false;
      t.el.muted = muted;
      t.el.play().catch(() => {});
      fade(t, t.level);
    }

    // Fades the current track out, then `name` in once every fade-out has reached silence
    // (at once if nothing is audible). An unknown or missing track means silence.
    function play(name) {
      const t = tracks[name] || null;
      if (t === current) return;
      clearTimeout(pending);
      if (current) fade(current, 0);
      current = t;
      if (!t || t.missing) return;
      const wait = quietAt - performance.now();
      if (wait > 0) pending = setTimeout(() => start(name), wait);
      else start(name);
    }

    function stop() {
      clearTimeout(pending);
      if (current) fade(current, 0);
      current = null;
    }

    // Muting keeps the music running silently, like a TV, so unmuting picks it up where it is now.
    function setMuted(value) {
      muted = value;
      for (const name in tracks) tracks[name].el.muted = muted;
    }

    // Browsers allow sound only after a user gesture, and Safari wants each element started from
    // one, so the first gesture briefly plays every idle track muted.
    let unlocked = false;
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      for (const name in tracks) {
        const t = tracks[name];
        if (t === current || t.missing) continue;
        t.el.muted = true;
        t.el.play().then(() => { if (t !== current) t.el.pause(); }, () => {})
          .finally(() => { t.el.muted = muted; });
      }
    }

    return { play, stop, unlock, setMuted, isMuted: () => muted };
  }

  window.TripMusic = { create };
})();
