// Cartoon characters: plain SVG bodies with a photo head.
// Heads load from avatars-local/<id>.png (gitignored, real faces) and fall back to the
// public cartoon heads in avatars/<id>.svg when the local file is missing.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const BASE_HEIGHT = 100; // SVG units for a character with height 1.0 (Masha, Lada)

  // height is relative to Masha. headRatio is the share of the total height taken by the head.
  // width scales torso, arms' position and legs; tilt is in degrees (positive = clockwise);
  // headScale enlarges the head around the chin without changing the body.
  // shift / shiftY move the head sideways / vertically as a fraction of the torso width
  // (positive = right / down on screen).
  const CHARACTERS = {
    ilya:  { name: "Ilya",  height: 1.1,  headRatio: 0.30, width: 0.9, tilt: -15, headScale: 1, shift: 0.2, shiftY: 0,
             top: "#3f6fb5", bottom: "#2f3a4d" },
    masha: { name: "Masha", height: 1.0,  headRatio: 0.30, width: 0.9, tilt: 30, headScale: 1.2, shift: -0.4, shiftY: 0.1,
             top: "#d9625a", bottom: "#3d5a80" },
    iero:  { name: "Iero",  height: 0.75, headRatio: 0.36, width: 1, tilt: 0, headScale: 1, shift: -0.1, shiftY: 0,
             top: "#4fa36b", bottom: "#6b6f7d" },
    lada:  { name: "Lada",  height: 1.0,  headRatio: 0.30, width: 0.8, tilt: 0, headScale: 1, shift: 0, shiftY: 0,
             top: "#e0a82e", bottom: "#33415c" },
  };
  const SKIN = "#f1c7a0";
  const OUTLINE = "#2b2b33";

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadHead(id, publicOnly) {
    const local = publicOnly ? null : await loadImage(`avatars-local/${id}.png`);
    return local ? { src: local.src, w: local.naturalWidth, h: local.naturalHeight }
                 : await loadImage(`avatars/${id}.svg`).then((img) => ({
                     src: img.src, w: img.naturalWidth, h: img.naturalHeight }));
  }

  // Returns an SVG <g> with the feet at (0, 0), standing up to y = -BASE_HEIGHT * height.
  // Move it with the `transform` attribute of the returned group.
  function createCharacter(id, options = {}) {
    const c = CHARACTERS[id];
    const total = BASE_HEIGHT * c.height;
    const headH = total * c.headRatio;
    const bodyH = total - headH;                 // from chin to feet
    const headBottom = -bodyH;
    const torsoTop = headBottom - headH * 0.08;  // tucked under the chin
    const torsoW = total * 0.27 * c.width;
    // The torso is 20% shorter than the original proportions; the legs take up the difference.
    const torsoH = 0.8 * (-torsoTop - 0.88 * bodyH * 0.42);
    const legOverlap = bodyH * 0.05;             // legs start slightly under the torso
    const legTop = torsoTop + torsoH - legOverlap;
    const legH = -legTop;
    const legW = total * 0.11 * c.width;
    const armW = total * 0.062;
    const armLen = bodyH * 0.34;
    const stroke = Math.max(0.8, total * 0.014);
    const shoulderY = headBottom + bodyH * 0.1;

    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "character");
    g.dataset.id = id;
    g.style.setProperty("--amp", `${(total * 0.012).toFixed(2)}px`);
    g.style.setProperty("--delay", `${options.delay || 0}s`);

    const arm = (side) => {
      const x = side * (torsoW / 2 - armW * 0.2);
      return `<g class="c-arm ${side < 0 ? "left" : "right"}" style="transform-origin:${x}px ${shoulderY}px">
        <line x1="${x}" y1="${shoulderY}" x2="${x + side * armW * 0.3}" y2="${shoulderY + armLen}"
              stroke="${OUTLINE}" stroke-width="${armW + stroke * 2}" stroke-linecap="round"/>
        <line x1="${x}" y1="${shoulderY}" x2="${x + side * armW * 0.3}" y2="${shoulderY + armLen}"
              stroke="${c.top}" stroke-width="${armW}" stroke-linecap="round"/>
        <circle cx="${x + side * armW * 0.3}" cy="${shoulderY + armLen + armW * 0.25}" r="${armW * 0.62}"
                fill="${SKIN}" stroke="${OUTLINE}" stroke-width="${stroke}"/>
      </g>`;
    };
    const leg = (side) => {
      const x = side * torsoW * 0.22 - legW / 2;
      return `<rect x="${x}" y="${-legH}" width="${legW}" height="${legH - total * 0.03}" rx="${legW * 0.3}"
                    fill="${c.bottom}" stroke="${OUTLINE}" stroke-width="${stroke}"/>
        <ellipse cx="${x + legW / 2 + side * legW * 0.15}" cy="${-total * 0.03}" rx="${legW * 0.85}" ry="${total * 0.03}"
                 fill="${OUTLINE}"/>`;
    };

    g.innerHTML = `<g class="c-bob">
      ${leg(-1)}${leg(1)}
      <rect x="${-torsoW / 2}" y="${torsoTop}" width="${torsoW}" height="${torsoH}"
            rx="${torsoW * 0.28}" fill="${c.top}" stroke="${OUTLINE}" stroke-width="${stroke}"/>
      ${arm(-1)}${arm(1)}
      <g transform="translate(${torsoW * c.shift} ${torsoW * c.shiftY})">
        <g class="c-head" style="transform-origin:0px ${headBottom}px">
          <g transform="rotate(${c.tilt} 0 ${headBottom})"><image class="c-face"/></g>
        </g>
      </g>
    </g>`;

    const face = g.querySelector(".c-face");
    g.ready = loadHead(id, options.publicOnly).then((head) => {
      const h = headH * c.headScale;
      const w = h * head.w / head.h;
      face.setAttribute("href", head.src);
      face.setAttribute("x", -w / 2);
      face.setAttribute("y", headBottom - h);
      face.setAttribute("width", w);
      face.setAttribute("height", h);
    });
    g.totalHeight = total;
    return g;
  }

  window.TripCharacters = { CHARACTERS, BASE_HEIGHT, createCharacter };
})();
