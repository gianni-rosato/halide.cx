/*
  Binary sunset — the cover for the Iris-AVIF launch post.

  Draws a sunset as a grid of 1s and 0s on a <canvas data-binary-sunset>.
  Every cell has a fixed colour sampled from a procedural sunset; only the
  digit shown and a short-lived "glow" change. Cells flip ambiently at a slow
  rate and much faster around the pointer. Only changed cells are repainted,
  so the loop stays cheap even on a full-width hero.

  Honors prefers-reduced-motion (no ambient motion; hover still responds,
  since it is user-initiated), pauses while offscreen or hidden, and rebuilds
  the grid on resize.
*/
(() => {
  const canvas = document.querySelector("[data-binary-sunset]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* --- Tunables ---------------------------------------------------------- */
  const FONT_PX = 13; // CSS px. Roboto Mono's advance width is ~0.6em.
  const CELL_W = FONT_PX * 0.62;
  const CELL_H = FONT_PX * 1.18;
  const FONT = `500 ${FONT_PX}px "Roboto Mono", ui-monospace, SFMono-Regular, monospace`;
  // Cells inside the sun disc use the heavy weight so the disc reads as a
  // solid shape rather than more of the same texture.
  const FONT_HEAVY = `700 ${FONT_PX}px "Roboto Mono", ui-monospace, SFMono-Regular, monospace`;
  const BG = "#0b0914";
  const AMBIENT_FLIP = 0.0035; // fraction of cells flipped per frame
  const SPARKLE_CHANCE = 0.6; // chance per frame of one random cell glowing
  const HOVER_RADIUS = 6.5; // in cell widths
  const HOVER_FLIP = 0.28; // flip chance at the pointer, falling off to 0
  const GLOW_DECAY = 0.9;
  const GLOW_TINT = [255, 244, 226];

  /* Sun placement, in unit coordinates of the canvas. Kept right of centre
     so the title on the left never covers it. */
  const SUN_U = 0.66;
  const HORIZON = 0.66;
  const SUN_V = HORIZON - 0.015;
  const SUN_R = 0.17; // relative to canvas height

  /* --- Grid state -------------------------------------------------------- */
  let W = 0;
  let H = 0;
  let cols = 0;
  let rows = 0;
  let n = 0;
  let bits, glow, base, baseCss, heavy;
  let currentFont = "";
  let pointer = null; // { col, row } in cell units, or null
  let visible = true;
  let raf = 0;
  let built = false;

  /* --- Sunset ------------------------------------------------------------ */
  const SKY = [
    [0.0, [44, 30, 92]],
    [0.32, [84, 34, 104]],
    [0.54, [172, 54, 88]],
    [0.63, [236, 104, 58]],
    [0.7, [255, 178, 96]],
  ];

  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const mix = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function sky(t) {
    for (let i = 1; i < SKY.length; i++) {
      if (t <= SKY[i][0]) {
        const [t0, c0] = SKY[i - 1];
        const [t1, c1] = SKY[i];
        return mix(c0, c1, (t - t0) / (t1 - t0));
      }
    }
    return SKY[SKY.length - 1][1];
  }

  function sunset(u, v, aspect) {
    let c;
    let inDisc = 0;
    const dx = (u - SUN_U) * aspect;
    const dy = v - SUN_V;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (v <= HORIZON) {
      const t = v / HORIZON;
      c = sky(t * 0.7);
      // The warm horizon band is brightest near the sun and cools off to
      // either side, which also keeps the left of the field dark enough
      // for the title to sit on.
      const att = Math.exp(-(dx * dx) / (2 * 0.55 * 0.55));
      const dim = 1 - (1 - att) * 0.5 * smoothstep(0.3, 0.8, t);
      c = [c[0] * dim, c[1] * dim, c[2] * dim];
      const disc = 1 - smoothstep(SUN_R - 0.012, SUN_R + 0.012, d);
      inDisc = disc > 0.5 ? 1 : 0;
      const halo = Math.exp(-(d * d) / (2 * 0.2 * 0.2)) * 0.32;
      c = [
        c[0] + halo * 255,
        c[1] + halo * 140,
        c[2] + halo * 60,
      ];
      c = mix(c, [255, 255, 250], disc);
    } else {
      const t = (v - HORIZON) / (1 - HORIZON);
      c = mix([74, 26, 58], [16, 11, 30], t);
      const rx = (u - SUN_U) * aspect;
      const width = 0.05 + t * 0.12;
      const column = Math.exp(-(rx * rx) / (2 * width * width));
      const shimmer = 0.5 + 0.5 * Math.sin(v * 150 + Math.sin(u * 40) * 2);
      const refl = column * (1 - t * 0.75) * (0.35 + 0.65 * shimmer);
      const line = Math.exp(-t * 22);
      c = [
        c[0] + refl * 236 + line * 140,
        c[1] + refl * 128 + line * 70,
        c[2] + refl * 60 + line * 30,
      ];
    }

    // Per-cell grain so the field reads as digits, not a smooth gradient.
    const grain = 0.86 + Math.random() * 0.28;
    return [
      clamp(c[0] * grain, 0, 255) | 0,
      clamp(c[1] * grain, 0, 255) | 0,
      clamp(c[2] * grain, 0, 255) | 0,
      inDisc,
    ];
  }

  /* --- Painting ---------------------------------------------------------- */
  function paintCell(i) {
    const col = i % cols;
    const row = (i - col) / cols;
    const x = col * CELL_W;
    const y = row * CELL_H;

    ctx.fillStyle = BG;
    ctx.fillRect(x, y, CELL_W, CELL_H);

    const g = glow[i];
    if (g > 0) {
      const k = i * 3;
      const r = base[k] + (GLOW_TINT[0] - base[k]) * g;
      const gg = base[k + 1] + (GLOW_TINT[1] - base[k + 1]) * g;
      const b = base[k + 2] + (GLOW_TINT[2] - base[k + 2]) * g;
      ctx.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
    } else {
      ctx.fillStyle = baseCss[i];
    }
    const font = heavy[i] ? FONT_HEAVY : FONT;
    if (font !== currentFont) {
      ctx.font = font;
      currentFont = font;
    }
    ctx.fillText(bits[i] ? "1" : "0", x + CELL_W / 2, y + CELL_H / 2 + 0.5);
  }

  function paintAll() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < n; i++) paintCell(i);
  }

  function build() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    if (!W || !H) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT;
    currentFont = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    cols = Math.ceil(W / CELL_W);
    rows = Math.ceil(H / CELL_H);
    n = cols * rows;

    bits = new Uint8Array(n);
    glow = new Float32Array(n);
    base = new Uint8ClampedArray(n * 3);
    baseCss = new Array(n);
    heavy = new Uint8Array(n);

    const aspect = W / H;
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = (i - col) / cols;
      const [r, g, b, inDisc] = sunset((col + 0.5) / cols, (row + 0.5) / rows, aspect);
      heavy[i] = inDisc;
      base[i * 3] = r;
      base[i * 3 + 1] = g;
      base[i * 3 + 2] = b;
      baseCss[i] = `rgb(${r},${g},${b})`;
      bits[i] = Math.random() < 0.5 ? 1 : 0;
    }

    built = true;
    paintAll();
  }

  /* --- Animation --------------------------------------------------------- */
  function step() {
    raf = 0;
    if (!built) return;

    const dirty = new Set();

    if (!reduceMotion.matches) {
      const flips = Math.max(1, Math.round(n * AMBIENT_FLIP));
      for (let k = 0; k < flips; k++) {
        const i = (Math.random() * n) | 0;
        bits[i] ^= 1;
        dirty.add(i);
      }
      if (Math.random() < SPARKLE_CHANCE) {
        const i = (Math.random() * n) | 0;
        glow[i] = Math.max(glow[i], 0.55);
        dirty.add(i);
      }
    }

    if (pointer) {
      const ry = HOVER_RADIUS * (CELL_W / CELL_H);
      const c0 = Math.max(0, Math.floor(pointer.col - HOVER_RADIUS));
      const c1 = Math.min(cols - 1, Math.ceil(pointer.col + HOVER_RADIUS));
      const r0 = Math.max(0, Math.floor(pointer.row - ry));
      const r1 = Math.min(rows - 1, Math.ceil(pointer.row + ry));
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const dx = (col + 0.5 - pointer.col) / HOVER_RADIUS;
          const dy = (row + 0.5 - pointer.row) / ry;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= 1) continue;
          const f = 1 - dist;
          const i = row * cols + col;
          if (Math.random() < f * HOVER_FLIP) bits[i] ^= 1;
          glow[i] = Math.max(glow[i], f * f);
          dirty.add(i);
        }
      }
    }

    // Decay every glowing cell. Glow is sparse, so this scan is cheap.
    for (let i = 0; i < n; i++) {
      const g = glow[i];
      if (g === 0) continue;
      const next = g * GLOW_DECAY;
      glow[i] = next < 0.02 ? 0 : next;
      dirty.add(i);
    }

    dirty.forEach(paintCell);

    const idle = !pointer && reduceMotion.matches && dirty.size === 0;
    if (visible && !document.hidden && !idle) schedule();
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(step);
  }

  /* --- Events ------------------------------------------------------------ */
  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer = {
      col: (event.clientX - rect.left) / CELL_W,
      row: (event.clientY - rect.top) / CELL_H,
    };
    schedule();
  });
  canvas.addEventListener("pointerleave", () => {
    pointer = null;
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedule();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible) schedule();
      },
      { threshold: 0 }
    ).observe(canvas);
  }

  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (canvas.clientWidth !== W || canvas.clientHeight !== H) {
        build();
        schedule();
      }
    });
  };
  if ("ResizeObserver" in window) {
    new ResizeObserver(onResize).observe(canvas);
  } else {
    window.addEventListener("resize", onResize);
  }

  reduceMotion.addEventListener("change", schedule);

  /* --- Boot -------------------------------------------------------------- */
  const start = () => {
    build();
    schedule();
  };
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load(FONT), document.fonts.load(FONT_HEAVY)]).then(start, start);
    // If the face arrives after first paint, repaint with the real glyphs.
    document.fonts.ready.then(() => built && paintAll());
  } else {
    start();
  }
})();
