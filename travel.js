// Draws the map, parks the vehicle in a city and drives it along a route. The camera either
// follows the vehicle closely or shows the whole map.
// Usage: const travel = TripTravel.createTravel(svgElement, mapJson, { publicOnly });
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const PASSENGERS = [
    ["ilya", "masha", "iero"],
    ["ilya", "masha", "iero", "lada"],
    ["ilya", "masha", "iero", "lada"],
  ];
  const MAX_TILT = 70;        // degrees; the vehicles climb steep stretches but never go sideways
  const SPEED = 40;           // map units per second (clamped by MIN/MAX_SECONDS)
  const MIN_SECONDS = 6.75, MAX_SECONDS = 18;
  const CAMERA_LIFT = 0.09;   // share of the view width: the camera looks slightly above the vehicle
  const WINDOW_LIFT = 26;     // height of the passenger windows above the road, in map units
  const DEPART_EASE = 0.15;   // share of the leg over which the departure close-up eases out
  const FOLLOW_RATE = 4;      // camera easing speed (1/s) while following the vehicle
  const ZOOM_RATE = 2.6;      // ... while zooming between the vehicle and the whole map
  const DOT_PX = 6; // city dots keep their on-screen size at any zoom
  const OVERVIEW_PAD = 1.4;   // the overview shows the trip's extent plus 40% room around it
  // Label box position in screen pixels relative to the city dot; the default is centred below it.
  const DEFAULT_LABEL = { dx: 0, dy: 12, shift: "-50%" };
  const LABEL_PLACEMENT = {
    Prague: { dx: 12, dy: -12, shift: "0%" },
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function createTravel(svg, map, opts = {}) {
    const el = (name, attrs, parent) => {
      const n = document.createElementNS(NS, name);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      parent.appendChild(n);
      return n;
    };
    svg.replaceChildren();

    map.countries.forEach((c) => el("path", { d: c.d, class: "country" }, svg));
    const routes = map.routes.map((r) => {
      const path = el("path", { d: r.d, class: "route " + r.mode }, svg);
      const length = path.getTotalLength();
      return { ...r, path, length, start: path.getPointAtLength(0), end: path.getPointAtLength(length) };
    });
    map.landmarks.forEach((m) => el("image", {
      href: m.file, x: m.x - m.w / 2, y: m.y - m.h, width: m.w, height: m.h,
    }, svg));
    const names = [routes[0].from, ...routes.map((r) => r.to)];
    // City names are HTML laid over the map rather than SVG text: text scaled by the camera
    // zoom shimmers, while HTML text keeps one font size and only moves.
    const overlay = document.createElement("div");
    overlay.className = "city-labels";
    svg.after(overlay);
    const markers = names.map((name) => {
      const c = map.cities[name];
      const dot = el("circle", { cx: c.x, cy: c.y, r: 2.5, class: "city-dot" }, svg);
      const label = document.createElement("div");
      label.className = "city-label";
      label.textContent = (opts.labels && opts.labels[name]) || name;
      overlay.appendChild(label);
      return { c, dot, label, place: LABEL_PLACEMENT[name] || DEFAULT_LABEL };
    });

    // Extent of everything that belongs to the trip: cities, routes and landmarks.
    const extent = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const include = (x, y, w = 0, h = 0) => {
      extent.x0 = Math.min(extent.x0, x); extent.y0 = Math.min(extent.y0, y);
      extent.x1 = Math.max(extent.x1, x + w); extent.y1 = Math.max(extent.y1, y + h);
    };
    markers.forEach((m) => include(m.c.x, m.c.y));
    routes.forEach((r) => { const b = r.path.getBBox(); include(b.x, b.y, b.width, b.height); });
    map.landmarks.forEach((m) => include(m.x - m.w / 2, m.y - m.h, m.w, m.h));

    const layer = el("g", {}, svg);
    const vehicles = routes.map((r, i) => {
      const v = TripVehicles.createVehicle(r.mode, PASSENGERS[i] || PASSENGERS[PASSENGERS.length - 1], opts);
      v.el.style.opacity = 0;
      layer.appendChild(v.el);
      return v;
    });

    let active = -1, p = 0, mode = "follow"; // mode: "follow" the vehicle or "overview" of the whole map
    const cam = { x: 0, y: 0, w: 250 };
    const target = { x: 0, y: 0, w: 250 };
    let waiting = [];

    // Point at distance s along route i, extending along the end tangents beyond 0 and length.
    function pointAt(i, s) {
      const { path, length } = routes[i];
      if (s >= 0 && s <= length) return path.getPointAtLength(s);
      const atStart = s < 0;
      const edge = path.getPointAtLength(atStart ? 0 : length);
      const inner = path.getPointAtLength(atStart ? 2 : length - 2);
      const d = Math.hypot(edge.x - inner.x, edge.y - inner.y) || 1;
      const heading = { x: (atStart ? inner.x - edge.x : edge.x - inner.x) / d,
                        y: (atStart ? inner.y - edge.y : edge.y - inner.y) / d };
      const over = atStart ? s : s - length; // negative before the start, positive after the end
      return { x: edge.x + heading.x * over, y: edge.y + heading.y * over };
    }

    function layout() {
      if (active < 0) return;
      const v = vehicles[active], r = routes[active];
      const s = p * r.length;
      // At the ends the vehicle stands level (centred on the city when leaving, with its
      // nose at the city when arriving); in between it follows the route.
      const k = smooth(0, 0.1, Math.min(p, 1 - p));
      const anchor = p < 0.5 ? r.start : r.end;
      const park = p < 0.5 ? 0 : -v.length / 2;
      v.pieces.forEach((pc) => {
        const f = pointAt(active, s + pc.offset + pc.len / 2);
        const b = pointAt(active, s + pc.offset - pc.len / 2);
        const angle = clamp(Math.atan2(f.y - b.y, f.x - b.x) * 57.2958, -MAX_TILT, MAX_TILT);
        const px = (f.x + b.x) / 2, py = (f.y + b.y) / 2;
        const fx = anchor.x + park + pc.offset, fy = anchor.y;
        pc.el.setAttribute("transform",
          `translate(${fx + (px - fx) * k} ${fy + (py - fy) * k}) rotate(${angle * k}) scale(${TripVehicles.SCALE})`);
      });
      if (mode === "overview") {
        const box = svg.getBoundingClientRect();
        const aspect = box.width ? box.height / box.width : 0.6;
        const w = extent.x1 - extent.x0, h = extent.y1 - extent.y0;
        target.x = (extent.x0 + extent.x1) / 2;
        target.y = (extent.y0 + extent.y1) / 2;
        target.w = Math.max(w, h / aspect) * OVERVIEW_PAD;
      } else {
        // Departure close-up: frame just the passengers, then ease out to the normal follow view.
        const t = 1 - smooth(0, DEPART_EASE, p);
        const focus = pointAt(active, s + v.focusOffset * t);
        const levelX = anchor.x + park + v.focusOffset * t; // the same point while parked level
        target.w = v.viewWidth + (v.departWidth - v.viewWidth) * t;
        target.x = levelX + (focus.x - levelX) * k;
        // The close-up looks a little below the windows so the city label clears the hint text.
        const tightLift = WINDOW_LIFT - v.departWidth * 0.06;
        target.y = anchor.y + (focus.y - anchor.y) * k - (tightLift * t + target.w * CAMERA_LIFT * (1 - t));
      }
      v.spin(s);
    }

    // Keeps dots and labels a constant size on screen whatever the zoom.
    function scaleMarkers(box, h) {
      const unit = box.width ? cam.w / box.width : 0.2; // map units per screen pixel
      markers.forEach((m) => {
        m.dot.setAttribute("r", DOT_PX * unit);
        const x = box.left + ((m.c.x - (cam.x - cam.w / 2)) / cam.w) * box.width;
        const y = box.top + ((m.c.y - (cam.y - h / 2)) / h) * box.height;
        m.label.style.transform =
          `translate(${(x + m.place.dx).toFixed(2)}px, ${(y + m.place.dy).toFixed(2)}px) translateX(${m.place.shift})`;
      });
    }

    function applyCamera() {
      const box = svg.getBoundingClientRect();
      const aspect = box.width ? box.height / box.width : 0.6;
      const h = cam.w * aspect;
      svg.setAttribute("viewBox", `${cam.x - cam.w / 2} ${cam.y - h / 2} ${cam.w} ${h}`);
      scaleMarkers(box, h);
    }

    function snapCamera() {
      layout();
      Object.assign(cam, target);
      applyCamera();
    }

    let last = null;
    function frame(now) {
      const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      layout();
      const a = 1 - Math.exp(-dt * (waiting.length ? ZOOM_RATE : FOLLOW_RATE));
      cam.x += (target.x - cam.x) * a;
      cam.y += (target.y - cam.y) * a;
      cam.w = Math.exp(Math.log(cam.w) + (Math.log(target.w) - Math.log(cam.w)) * a); // zoom evenly
      applyCamera();
      if (waiting.length && Math.abs(Math.log(target.w / cam.w)) < 0.02 &&
          Math.hypot(target.x - cam.x, target.y - cam.y) < target.w * 0.02) {
        waiting.forEach((resolve) => resolve());
        waiting = [];
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener("resize", applyCamera);

    // Shows the vehicle of `leg`, parked in the leg's start city.
    function show(leg, o = {}) {
      active = leg;
      p = 0;
      vehicles.forEach((v, i) => {
        v.el.style.transition = o.snap ? "none" : "";
        v.el.style.opacity = i === leg ? 1 : 0;
      });
      if (o.snap) snapCamera();
    }

    // Moves the camera to "follow" (zoomed in on the vehicle) or "overview" (the whole map).
    // Resolves when the camera has arrived; with { snap: true } it jumps there at once.
    function setCamera(newMode, o = {}) {
      mode = newMode;
      if (o.snap) { snapCamera(); return Promise.resolve(); }
      return new Promise((resolve) => waiting.push(resolve));
    }
    function setState(leg, progress, o = { snap: true }) {
      show(leg, { snap: true });
      p = progress;
      if (o.snap) snapCamera();
    }

    // Drives the active vehicle along the leg; resolves on arrival. With `midway` (an async
    // function) the vehicle eases to a stop at share `stopAt` of the route, waits for it,
    // then drives on.
    function travelLeg(leg, midway, stopAt = 0.5) {
      show(leg);
      const seconds = clamp(routes[leg].length / SPEED, MIN_SECONDS, MAX_SECONDS);
      const drive = (from, to, secs) => new Promise((resolve) => {
        let t0 = null;
        function step(now) {
          if (t0 === null) t0 = now;
          const t = Math.min(1, (now - t0) / (secs * 1000));
          p = from + (to - from) * ease(t);
          if (t < 1) requestAnimationFrame(step); else resolve();
        }
        requestAnimationFrame(step);
      });
      if (!midway) return drive(0, 1, seconds);
      return drive(0, stopAt, seconds * stopAt).then(midway)
        .then(() => drive(stopAt, 1, seconds * (1 - stopAt)));
    }

    const ready = Promise.all(vehicles.map((v) => v.ready));
    show(0, { snap: true });
    requestAnimationFrame(frame);
    // Renames the city labels on the map: label(englishName) -> text to show.
    function setLabels(label) {
      markers.forEach((m, i) => { m.label.textContent = label(names[i]); });
    }

    return { cities: names, legCount: routes.length, show, setState, setCamera, travelLeg, setLabels, ready };
  }

  window.TripTravel = { createTravel };
})();
