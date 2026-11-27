/*
  Binary fire — the cover for the Iris-AVIF launch post.

  Draws the Halide Compression mark burning, as a grid of 1s and 0s on a
  <canvas data-binary-fire>. The mark is white-hot, blooms into orange, red
  and magenta around it, and sheds embers that drift upward. Every cell has
  a fixed colour; only the digit shown and a short-lived "glow" change.
  Cells flip ambiently (faster inside the bloom) and much faster around the
  pointer.
  Only changed cells are repainted, so the loop stays cheap even on a
  full-width hero.

  Honors prefers-reduced-motion (no ambient motion or embers; hover still
  responds, since it is user-initiated), pauses while offscreen or hidden,
  and rebuilds the grid on resize.
*/
(() => {
  const canvas = document.querySelector("[data-binary-fire]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motion = globalThis.halideMotion;
  // Reduced motion, or the reader's pause switch (js/motion.js).
  const calm = () => reduceMotion.matches || !!motion?.paused;

  /* --- Tunables ---------------------------------------------------------- */
  const FONT_PX = 13; // CSS px. Roboto Mono's advance width is ~0.6em.
  const CELL_W = FONT_PX * 0.62;
  const CELL_H = FONT_PX * 1.18;
  const FONT = `500 ${FONT_PX}px "Roboto Mono", ui-monospace, SFMono-Regular, monospace`;
  // Cells inside the mark use the heavy weight so it reads as a solid shape
  // rather than more of the same texture.
  const FONT_HEAVY = `700 ${FONT_PX}px "Roboto Mono", ui-monospace, SFMono-Regular, monospace`;
  const BG = "#0b0914";
  const AMBIENT_FLIP = 0.0025; // fraction of all cells flipped per frame
  const BLOOM_FLIP = 0.02; // extra fraction of bloom cells flipped per frame
  const SPARKLE_CHANCE = 0.5; // chance per frame of one bloom cell flaring
  const HOVER_RADIUS = 6.5; // in cell widths
  const HOVER_FLIP = 0.28; // flip chance at the pointer, falling off to 0
  const GLOW_DECAY = 0.9;
  const GLOW_TINT = [255, 238, 205];
  const MAX_EMBERS = 20;
  const EMBER_CHANCE = 0.2; // chance per frame of a new ember

  /* The mark, from static/img/halide_logo.svg. */
  const LOGO_W = 455.19;
  const LOGO_H = 394.36;
  const LOGO = new Path2D(
    "M113.8 0 83.58 52.35 278.8 0Zm167.22 0 142.75 142.76L341.37 0ZM82.32 54.53 0 197.18l30.09 52.14Zm108.92 79.7L154.9 197.2h-.01l36.34 62.97h72.58l36.33-62.97-36.32-62.97zM425 144.89l-52.42 195.43 82.6-143.12ZM31.64 252l82.15 142.35h60.2zm339.97 90L176.4 394.36h165z"
  );

  /* --- Grid state -------------------------------------------------------- */
  let W = 0;
  let H = 0;
  let cols = 0;
  let rows = 0;
  let n = 0;
  let bits, glow, base, baseCss, heavy, glowCells;
  let embers = [];
  let currentFont = "";
  let pointer = null; // { col, row } in cell units, or null
  let visible = true;
  let raf = 0;
  let built = false;

  /* --- Colour ------------------------------------------------------------ */
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

  function ramp(stops, t) {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1];
        const [t1, c1] = stops[i];
        return mix(c0, c1, (t - t0) / (t1 - t0));
      }
    }
    return stops[stops.length - 1][1];
  }

  // Dusk behind the fire: the same violet-to-magenta ground as the rest of
  // the launch palette, darkest at the top.
  const SKY = [
    [0.0, [30, 20, 62]],
    [0.5, [56, 24, 80]],
    [1.0, [92, 28, 78]],
  ];

  // Heat, from barely-there to white-hot.
  const FIRE = [
    [0.0, [70, 22, 82]],
    [0.18, [130, 30, 92]],
    [0.36, [196, 44, 72]],
    [0.54, [236, 88, 44]],
    [0.72, [255, 150, 58]],
    [0.86, [255, 206, 118]],
    [1.0, [255, 248, 228]],
  ];

  /* Cheap value noise, for texture in the mark. */
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /* --- Field ------------------------------------------------------------- */

  // Extent of the hero text in canvas px: the right edge of its set lines
  // and buttons (the column is wider than any line) and its bottom edge.
  function textBox() {
    const content = canvas.parentElement.querySelector(".launch-hero__content");
    if (!content) return { right: W * 0.45, bottom: H * 0.6, edge: W };
    const c = canvas.getBoundingClientRect();
    // The container's inner right edge: the page margin the mark keeps to.
    const edge = content.getBoundingClientRect().right - c.left -
      parseFloat(getComputedStyle(content).paddingRight);
    let right = 0;
    let bottom = 0;
    const take = (r) => {
      right = Math.max(right, r.right - c.left);
      bottom = Math.max(bottom, r.bottom - c.top);
    };
    const range = document.createRange();
    const walk = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      if (!t.data.trim()) continue;
      range.selectNodeContents(t);
      take(range.getBoundingClientRect());
    }
    for (const btn of content.querySelectorAll(".btn")) take(btn.getBoundingClientRect());
    return { right: right || W * 0.45, bottom: bottom || H * 0.6, edge: edge || W };
  }

  // Where the mark sits, in CSS px. On desktop it is centred in the free
  // space right of the text; below that the text spans the hero, so the
  // mark is centred in the room the stylesheet leaves under the buttons.
  function placeLogo() {
    const aspect = LOGO_W / LOGO_H;
    const text = textBox();
    if (W < 1024) {
      const free = Math.max(H - text.bottom, 0);
      const h = Math.min(free * 0.8, (W * 0.6) / aspect);
      const w = h * aspect;
      return { x: W / 2 - w / 2, y: text.bottom + (free - h) / 2, w, h };
    }
    const free = text.edge - text.right;
    const h = Math.min(H * 0.6, (free * 0.8) / aspect);
    const w = h * aspect;
    const cx = text.right + free / 2;
    return { x: cx - w / 2, y: H / 2 - h / 2, w, h };
  }

  // Logo coverage per cell, 0..1, supersampled 3×3 within each cell.
  function coverage(box) {
    const ss = 3;
    const mw = cols * ss;
    const mh = rows * ss;
    const off = document.createElement("canvas");
    off.width = mw;
    off.height = mh;
    const o = off.getContext("2d");
    o.setTransform((box.w / LOGO_W) * (ss / CELL_W), 0, 0, (box.h / LOGO_H) * (ss / CELL_H),
      (box.x / CELL_W) * ss, (box.y / CELL_H) * ss);
    o.fillStyle = "#fff";
    o.fill(LOGO);
    const px = o.getImageData(0, 0, mw, mh).data;
    const m = new Float32Array(n);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let sum = 0;
        for (let sy = 0; sy < ss; sy++) {
          const line = (row * ss + sy) * mw + col * ss;
          for (let sx = 0; sx < ss; sx++) sum += px[(line + sx) * 4 + 3];
        }
        m[row * cols + col] = sum / (ss * ss * 255);
      }
    }
    return m;
  }

  // Separable box blur on the cell grid, `passes` times (≈ gaussian).
  function blur(src, rx, ry, passes) {
    let a = Float32Array.from(src);
    let b = new Float32Array(n);
    for (let p = 0; p < passes; p++) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          let s = 0;
          let k = 0;
          for (let d = -rx; d <= rx; d++) {
            const c = col + d;
            if (c < 0 || c >= cols) continue;
            s += a[row * cols + c];
            k++;
          }
          b[row * cols + col] = s / k;
        }
      }
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          let s = 0;
          let k = 0;
          for (let d = -ry; d <= ry; d++) {
            const r = row + d;
            if (r < 0 || r >= rows) continue;
            s += b[r * cols + col];
            k++;
          }
          a[row * cols + col] = s / k;
        }
      }
    }
    return a;
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
    embers = [];

    const box = placeLogo();
    const m = coverage(box);
    // Bloom: a tight hot glow hugging the mark over a wide, cooler one.
    const near = blur(m, 2, 1, 2);
    const far = blur(m, 10, 5, 3);
    const bloomCells = [];

    const logoTop = box.y / CELL_H;
    const logoRows = box.h / CELL_H;
    const lcx = (box.x + box.w / 2) / W;
    const lcol = (box.x + box.w / 2) / CELL_W;
    const lrow = (box.y + box.h / 2) / CELL_H;
    const lrx = box.w / 2 / CELL_W;
    const lry = box.h / 2 / CELL_H;

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = (i - col) / cols;
      const u = (col + 0.5) / cols;
      const v = (row + 0.5) / rows;

      // Ground, dimmed away from the mark so the title has a dark field.
      let c = ramp(SKY, v);
      const dx = (u - lcx) * (W / H);
      const dim = 0.45 + 0.55 * Math.exp(-(dx * dx) / (2 * 0.5 * 0.5));
      c = [c[0] * dim, c[1] * dim, c[2] * dim];

      // Bloom: orange at the mark's edge, cooling through red and magenta
      // into the ground.
      const bloom = clamp(near[i] * 0.7 + far[i] * 1.5, 0, 1);
      if (bloom > 0.01) {
        c = mix(c, ramp(FIRE, 0.12 + 0.66 * bloom ** 0.8), smoothstep(0, 0.4, bloom));
        if (bloom > 0.2 && m[i] < 0.4) bloomCells.push(i);
      }

      // Inside the mark's hexagon the gaps go darker so the shards read.
      const ldx = (col + 0.5 - lcol) / lrx;
      const ldy = (row + 0.5 - lrow) / lry;
      const inHex = 1 - smoothstep(0.7, 0.9, Math.sqrt(ldx * ldx + ldy * ldy));
      c = mix(c, [c[0] * 0.35, c[1] * 0.35, c[2] * 0.35], inHex);

      // The mark: hottest at the base, cooling slightly towards the top.
      const inMark = m[i] >= 0.4 ? 1 : 0;
      if (inMark) {
        const up = clamp((row + 0.5 - logoTop) / logoRows, 0, 1);
        const t = 0.88 + 0.12 * up + 0.04 * (noise(col * 0.4, row * 0.4) - 0.5);
        c = ramp(FIRE, clamp(t, 0, 1));
      }

      // Per-cell grain so the field reads as digits, not a smooth gradient.
      const grain = inMark ? 0.94 + Math.random() * 0.08 : 0.86 + Math.random() * 0.28;
      const r = clamp(c[0] * grain, 0, 255) | 0;
      const gg = clamp(c[1] * grain, 0, 255) | 0;
      const b = clamp(c[2] * grain, 0, 255) | 0;
      heavy[i] = inMark;
      base[i * 3] = r;
      base[i * 3 + 1] = gg;
      base[i * 3 + 2] = b;
      baseCss[i] = `rgb(${r},${gg},${b})`;
      bits[i] = Math.random() < 0.5 ? 1 : 0;
    }
    glowCells = Uint32Array.from(bloomCells);

    built = true;
    paintAll();
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

  /* --- Animation --------------------------------------------------------- */
  function step() {
    raf = 0;
    if (!built) return;

    const dirty = new Set();
    const fl = glowCells.length;

    if (!calm()) {
      const flips = Math.max(1, Math.round(n * AMBIENT_FLIP));
      for (let k = 0; k < flips; k++) {
        const i = (Math.random() * n) | 0;
        bits[i] ^= 1;
        dirty.add(i);
      }
      if (fl) {
        const fflips = Math.max(1, Math.round(fl * BLOOM_FLIP));
        for (let k = 0; k < fflips; k++) {
          const i = glowCells[(Math.random() * fl) | 0];
          bits[i] ^= 1;
          dirty.add(i);
        }
        if (Math.random() < SPARKLE_CHANCE) {
          const i = glowCells[(Math.random() * fl) | 0];
          glow[i] = Math.max(glow[i], 0.5);
          dirty.add(i);
        }
        // Embers leave the bloom and drift up, wobbling as they cool.
        if (embers.length < MAX_EMBERS && Math.random() < EMBER_CHANCE) {
          const i = glowCells[(Math.random() * fl) | 0];
          const col = i % cols;
          embers.push({
            col: col + 0.5,
            row: (i - col) / cols + 0.5,
            vy: 0.12 + Math.random() * 0.18,
            phase: Math.random() * Math.PI * 2,
            life: 1,
            fade: 0.006 + Math.random() * 0.01,
          });
        }
      }
      for (let e = embers.length - 1; e >= 0; e--) {
        const em = embers[e];
        em.row -= em.vy;
        em.phase += 0.08;
        em.col += Math.sin(em.phase) * 0.12;
        em.life -= em.fade;
        const col = em.col | 0;
        const row = em.row | 0;
        if (em.life <= 0 || row < 0 || col < 0 || col >= cols) {
          embers.splice(e, 1);
          continue;
        }
        const i = row * cols + col;
        glow[i] = Math.max(glow[i], 0.85 * em.life);
        dirty.add(i);
      }
    } else if (embers.length) {
      embers = [];
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

    const idle = !pointer && calm() && dirty.size === 0;
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
  if (motion) {
    motion.on(schedule);
    canvas.parentElement.append(motion.button());
  }

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
