// Schematic side-view vehicles (facing right) with passengers visible through the windows.
// A vehicle is a list of pieces (a bus is one piece; a train is a locomotive plus cars) so a
// train can bend along the route. Piece art uses "vehicle units" with the origin at the
// bottom centre of the piece (where the wheels touch the ground); SCALE maps them to map units.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const OUTLINE = "#2b2b33";
  const SCALE = 0.24;
  const PASSENGER_SCALE = 1.38;          // passengers are drawn larger than life-size; the windows stay as they are
  const HEAD_MARGIN = 8;                 // extra room above the head for tilt and hair
  const FACE_MARGIN = 6;                 // gap between a chin and the window sill
  const BASE_HEIGHT = TripCharacters.BASE_HEIGHT;
  const FLOOR = -10;                     // passengers stand here; they are clipped to the window band
  const BAND_TOP = -146, BAND_BOTTOM = -74; // window band: heads and shoulders show
  const PITCH = 78, WIN_W = 64;          // one passenger window per character
  const GAP = 8;                         // between train pieces (coupler)
  const VIEW_WIDTH = { bus: 130, train: 220 }; // camera width (map units) that follows each kind

  function svgEl(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function rrect(x, y, w, h, r) {
    return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}` +
           `Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}` +
           `V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
  }

  const rectWindow = (x, w) => ({ x, w, d: rrect(x - w / 2, BAND_TOP, w, BAND_BOTTOM - BAND_TOP, 8) });

  function addWheel(parent, x, r) {
    const g = svgEl("g", { transform: `translate(${x} ${-r})` }, parent);
    svgEl("circle", { r, fill: OUTLINE }, g);
    const spin = svgEl("g", {}, g);
    svgEl("circle", { r: r * 0.58, fill: "#b9c2cc", stroke: OUTLINE, "stroke-width": 2 }, spin);
    [0, 60, 120].forEach((a) => svgEl("line", {
      x1: -r * 0.52, x2: r * 0.52, y1: 0, y2: 0, stroke: OUTLINE, "stroke-width": 2.5,
      transform: `rotate(${a})`,
    }, spin));
    svgEl("circle", { r: r * 0.14, fill: OUTLINE }, spin);
    return { spin, r };
  }

  let pieceCount = 0;

  // spec: { length, body (path d), color, windows[], passengers[{id, x}], wheels[{x, r}], decorate(g) }
  function assemble(spec, opts, delayStart) {
    const g = svgEl("g", { class: "vehicle-piece" });
    const ready = [];
    const windowsPath = spec.windows.map((w) => w.d).join("");
    const clipId = `window-clip-${pieceCount++}`;
    svgEl("path", { d: windowsPath }, svgEl("clipPath", { id: clipId }, g));
    svgEl("path", { d: windowsPath, fill: "#cfe3f0" }, g);
    const riders = svgEl("g", { "clip-path": `url(#${clipId})` }, g);
    spec.passengers.forEach((p, i) => {
      // Keep every head inside its window: short passengers stand a little higher so the face
      // clears the sill, tall ones a little lower so the hair clears the frame.
      const c = TripCharacters.CHARACTERS[p.id];
      const total = BASE_HEIGHT * c.height * PASSENGER_SCALE;
      const chin = total * (1 - c.headRatio);
      const headTop = chin + total * c.headRatio * c.headScale + HEAD_MARGIN;
      const floor = Math.max(Math.min(FLOOR, BAND_BOTTOM - FACE_MARGIN + chin), BAND_TOP + headTop);
      const holder = svgEl("g", { transform: `translate(${p.x} ${floor}) scale(${PASSENGER_SCALE})` }, riders);
      const ch = TripCharacters.createCharacter(p.id, {
        publicOnly: opts.publicOnly, delay: -(delayStart + i) * 0.37,
      });
      holder.appendChild(ch);
      ready.push(ch.ready);
    });
    svgEl("path", {
      d: spec.body + spec.windows.map((w) => w.d).join(""), "fill-rule": "evenodd",
      fill: spec.color, stroke: OUTLINE, "stroke-width": 3, "stroke-linejoin": "round",
    }, g);
    spec.decorate(g);
    spec.windows.filter((w) => w.sheen !== false).forEach((w) => {
      const a = w.x - w.w / 2 + 24;
      svgEl("path", { d: `M${a} ${BAND_TOP}H${a + 12}L${a - 4} ${BAND_BOTTOM}H${a - 16}Z`,
                      fill: "#fff", opacity: 0.22 }, g);
    });
    const wheels = spec.wheels.map((w) => addWheel(g, w.x, w.r));
    return { el: g, length: spec.length, wheels, ready };
  }

  function busSpec(ids) {
    const L = ids.length * PITCH + 116, half = L / 2;
    const xs = ids.map((_, i) => -half + 26 + 39 + i * PITCH);
    return {
      length: L, color: "#e0483f", body: rrect(-half, -156, L, 130, 14),
      windows: [...xs.map((x) => rectWindow(x, WIN_W)), rectWindow(half - 40, 56)],
      passengers: ids.map((id, i) => ({ id, x: xs[i] })),
      wheels: [{ x: -half + 60, r: 20 }, { x: half - 52, r: 20 }],
      decorate(g) {
        svgEl("rect", { x: -half + 3, y: -60, width: L - 6, height: 10, fill: "#f6c945" }, g);
        svgEl("rect", { x: half - 4, y: -46, width: 10, height: 18, rx: 3, fill: "#8a8f99",
                        stroke: OUTLINE, "stroke-width": 2 }, g);
        svgEl("circle", { cx: half - 10, cy: -42, r: 6, fill: "#ffe08a", stroke: OUTLINE, "stroke-width": 1.5 }, g);
        svgEl("circle", { cx: -half + 8, cy: -42, r: 4.5, fill: "#8c1f1a" }, g);
        svgEl("rect", { x: -20, y: -166, width: 40, height: 10, rx: 4, fill: "#f6c945",
                        stroke: OUTLINE, "stroke-width": 2 }, g);
      },
    };
  }

  function carSpec(ids) {
    const L = ids.length * PITCH + 50, half = L / 2;
    const xs = ids.map((_, i) => -half + 25 + 39 + i * PITCH);
    return {
      length: L, color: "#3a6db3", body: rrect(-half, -156, L, 130, 10),
      windows: xs.map((x) => rectWindow(x, WIN_W)),
      passengers: ids.map((id, i) => ({ id, x: xs[i] })),
      wheels: [-1, 1].flatMap((s) => [{ x: s * (half - 28), r: 15 }, { x: s * (half - 58), r: 15 }]),
      decorate(g) {
        svgEl("rect", { x: -half + 3, y: -62, width: L - 6, height: 10, fill: "#fff" }, g);
        svgEl("rect", { x: -half + 28, y: -166, width: 36, height: 10, rx: 3, fill: "#9aa5b3",
                        stroke: OUTLINE, "stroke-width": 2 }, g);
        svgEl("rect", { x: -half - GAP, y: -42, width: GAP, height: 6, fill: OUTLINE }, g);
        svgEl("rect", { x: half, y: -42, width: GAP, height: 6, fill: OUTLINE }, g);
      },
    };
  }

  function locoSpec() {
    const half = 85;
    const body = `M-77 -26H79Q85 -26 85 -34V-96Q85 -104 81 -111L60 -146Q56 -152 48 -152H-77` +
                 `Q-85 -152 -85 -144V-34Q-85 -26 -77 -26Z`;
    return {
      length: 170, color: "#2d4f8a", body,
      windows: [
        { x: -40, w: 60, sheen: false, d: rrect(-70, -140, 60, 42, 7) },
        { x: 46, w: 48, sheen: false, d: "M24 -140H52L70 -104H24Z" },
      ],
      passengers: [],
      wheels: [-55, -15, 25, 62].map((x) => ({ x, r: 16 })),
      decorate(g) {
        svgEl("rect", { x: -82, y: -62, width: 164, height: 10, fill: "#f6c945" }, g);
        svgEl("circle", { cx: half - 5, cy: -72, r: 6, fill: "#ffe08a", stroke: OUTLINE, "stroke-width": 1.5 }, g);
        svgEl("path", { d: "M-30 -152L-14 -176L2 -152M-24 -176H-4", fill: "none", stroke: OUTLINE,
                        "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
        svgEl("rect", { x: half, y: -42, width: GAP, height: 6, fill: OUTLINE }, g);
        svgEl("rect", { x: -half - GAP, y: -42, width: GAP, height: 6, fill: OUTLINE }, g);
      },
    };
  }

  // kind: "bus" | "train". Pieces are listed front to back; `offset` is the piece centre's
  // distance ahead of the vehicle centre, `len` its length, both in map units.
  function createVehicle(kind, ids, opts = {}) {
    const root = svgEl("g", { class: "vehicle" });
    const specs = kind === "bus" ? [busSpec(ids)] : [locoSpec()];
    if (kind === "train") for (let i = 0; i < ids.length; i += 2) specs.push(carSpec(ids.slice(i, i + 2)));

    let seen = 0;
    const pieces = specs.map((spec) => {
      const piece = assemble(spec, opts, seen);
      seen += spec.passengers.length;
      return piece;
    });
    const total = pieces.reduce((n, p) => n + p.length, 0) + GAP * (pieces.length - 1);
    let front = total / 2;
    pieces.forEach((p) => {
      p.offset = (front - p.length / 2) * SCALE;
      p.len = p.length * SCALE;
      front -= p.length + GAP;
      root.appendChild(p.el);
    });

    // Where the passengers are along the vehicle, for the close-up at departure.
    const xs = pieces.flatMap((pc, i) => specs[i].passengers.map((p) => pc.offset + p.x * SCALE));
    const lo = Math.min(...xs), hi = Math.max(...xs);

    return {
      el: root, pieces, kind,
      length: total * SCALE,
      viewWidth: VIEW_WIDTH[kind],
      focusOffset: (lo + hi) / 2,                                  // passengers' centre, ahead of the vehicle centre
      departWidth: Math.max(60, (hi - lo + WIN_W * SCALE) * 1.5),  // camera width framing just the passengers
      ready: Promise.all(pieces.flatMap((p) => p.ready)),
      // Rolls every wheel as if the vehicle had travelled `dist` map units.
      spin(dist) {
        pieces.forEach((p) => p.wheels.forEach((w) =>
          w.spin.setAttribute("transform", `rotate(${(dist / SCALE / w.r) * 57.2958})`)));
      },
    };
  }

  window.TripVehicles = { createVehicle, SCALE };
})();
