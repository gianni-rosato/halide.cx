/*
  Plates: paints the bits and blur windows of every .plate, and the dashed
  guides along their edges (layout model in sass/_plate.scss).

  Each window reads the part of the photograph under it once, from a small
  downsampled copy, and paints a canvas:
    blur  the low frequencies, gradient-mapped through the tone's --ramp,
          with grain. Painted once; never repainted unless resized.
    bits  a field of Roboto Mono glyphs, denser for brighter cells. A few
          cells re-pick a glyph each tick and briefly flare; the pointer
          speeds up the cells around it. Glyphs are blitted from a sheet
          drawn at build time, so a tick is a handful of copies.

  Nothing is filtered or blended live. Fields tick only while on screen and
  the tab is visible; with prefers-reduced-motion, or once a reader pauses
  them (js/motion.js), they hold still except under the pointer.
*/
(() => {
  const plates = document.querySelectorAll(".plate");
  if (!plates.length) return;

  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const motion = globalThis.halideMotion;
  const calm = () => still.matches || !!motion?.paused;

  const CW = 7; // cell, CSS px
  const CH = 9;
  const FONT_PX = 9.5;
  const TICK = 1000 / 12;
  const RATE = 0.0064; // share of cells re-picked per tick
  const FLARE = 0.3; // share of re-picks that flare
  const DECAY = 0.78;
  const WAVE = 0.55; // how far the slow wave pushes a cell across a band
  const HOVER_R = 5; // cells
  const HOVER_P = 0.35;
  const GRAIN = 20; // blur grain amplitude, 0–255

  // Density bands, sparse to solid; ■ is drawn as a square.
  const BANDS = ["", ".·", ":·-", "-=+:", "+10=", "0110o", "#%8&0", "■"];
  const TOP = BANDS.length - 1;
  const CHARS = [...new Set(BANDS.join(""))];
  const BAND_CHARS = BANDS.map((s) => [...s].map((ch) => CHARS.indexOf(ch)));
  const FLARES = [0.2, 0.4, 0.65, 1]; // sheet rows 2–5; 0 dim, 1 glyph

  // 4×4 Bayer thresholds centred on zero: band edges dither, not contour.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
    (v) => (v + 0.5) / 16 - 0.5,
  );

  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const hex = (s) => {
    const n = parseInt(s.trim().slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  const canvas = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };

  // Pixels can only be read from same-origin images. Zola writes absolute
  // URLs from base_url, which may not match the host the page was opened on
  // (www vs bare, localhost vs 127.0.0.1), so load by path.
  const images = new Map();
  function loadImage(src) {
    const url = new URL(src, location.href);
    const key = url.pathname + url.search;
    if (!images.has(key)) {
      const img = new Image();
      img.src = key;
      images.set(key, img.decode().then(() => img));
    }
    return images.get(key);
  }

  const FONT = `500 ${FONT_PX}px "Roboto Mono", ui-monospace, monospace`;
  const fontReady = document.fonts ? document.fonts.load(FONT).catch(() => {}) : null;

  /* Where the photograph sits under a window, in field CSS px: the image is
     laid over its frame with object-fit: cover, like .win__media. */
  function geometry(win, field, img) {
    const st = getComputedStyle(win);
    const num = (name, d) => {
      const v = parseFloat(st.getPropertyValue(name));
      return Number.isFinite(v) ? v : d;
    };
    const pos = (s) =>
      s === "left" || s === "top" ? 0
      : s === "right" || s === "bottom" ? 1
      : Number.isFinite(parseFloat(s)) ? parseFloat(s) / 100
      : 0.5;
    const cols = num("--cols", 12);
    const rows = num("--rows", 8);
    const FW = field.offsetWidth;
    const FH = field.offsetHeight;
    const fx = (num("--fx", 0) / cols) * FW;
    const fy = (num("--fy", 0) / rows) * FH;
    const fw = (num("--fw", cols) / cols) * FW;
    const fh = (num("--fh", rows) / rows) * FH;
    const [px, py = px] = st.getPropertyValue("--pos").trim().split(/\s+/);
    const s = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
    const iw = img.naturalWidth * s;
    const ih = img.naturalHeight * s;
    return {
      st,
      num,
      wx: win.offsetLeft,
      wy: win.offsetTop,
      ww: win.offsetWidth,
      wh: win.offsetHeight,
      iw,
      ih,
      ox: fx + (fw - iw) * pos(px),
      oy: fy + (fh - ih) * pos(py),
    };
  }

  /* Luminance of a region (field CSS px) of the laid-out image, averaged
     down to gw × gh in two steps so each sample is a mean, not a point. */
  function luma(img, g, rx, ry, rw, rh, gw, gh) {
    const mid = canvas(gw * 4, gh * 4);
    const mc = mid.getContext("2d");
    mc.imageSmoothingQuality = "high";
    const kx = mid.width / rw;
    const ky = mid.height / rh;
    mc.drawImage(img, (g.ox - rx) * kx, (g.oy - ry) * ky, g.iw * kx, g.ih * ky);
    const sc = canvas(gw, gh).getContext("2d", { willReadFrequently: true });
    sc.imageSmoothingQuality = "high";
    sc.drawImage(mid, 0, 0, gw, gh);
    const d = sc.getImageData(0, 0, gw, gh).data;
    const out = new Float32Array(gw * gh);
    for (let i = 0; i < out.length; i++) {
      out[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
    }
    return out;
  }

  // One pass of a separable box blur with clamped edges.
  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(src.length);
    const out = new Float32Array(src.length);
    const n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += src[y * w + clamp(x + k, 0, w - 1)];
        tmp[y * w + x] = s / n;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += tmp[clamp(y + k, 0, h - 1) * w + x];
        out[y * w + x] = s / n;
      }
    }
    return out;
  }

  /* --- A window ---------------------------------------------------------- */
  class Win {
    constructor(win) {
      this.win = win;
      this.field = win.closest(".plate__field");
      this.cv = win.querySelector("canvas");
      this.token = 0;
    }

    load() {
      this.busy = this.build()
        .catch((error) => console.warn("plates: could not draw", error))
        .finally(() => {
          this.busy = null;
          wake();
        });
    }

    async build() {
      const token = ++this.token;
      const img = await loadImage(this.win.dataset.src);
      if (this.bits) await fontReady;
      // A resize may have started a newer build while this one waited.
      if (token !== this.token) return;
      const g = geometry(this.win, this.field, img);
      if (g.ww < 2 || g.wh < 2) return;
      this.size = `${g.ww}x${g.wh}`;
      this.paint(img, g);
      this.ready = true;
      this.win.classList.add("is-drawn");
    }
  }

  /* Blur: the window's region plus a margin, averaged down to a few pixels
     per blur radius, box-blurred three times (close to a Gaussian), then
     sampled back up bilinearly through the ramp with grain added. */
  class Blur extends Win {
    paint(img, g) {
      const ramp = (g.st.getPropertyValue("--ramp").match(/#[0-9a-f]{6}/gi) || []).map(hex);
      if (ramp.length < 2) return;
      const r = Math.max(4, g.num("--blur", 0.026) * innerWidth);
      const p = r / 2.5; // buffer pixel, CSS px
      const m = r * 2;
      const rx = Math.max(g.wx - m, g.ox);
      const ry = Math.max(g.wy - m, g.oy);
      const rw = Math.min(g.wx + g.ww + m, g.ox + g.iw) - rx;
      const rh = Math.min(g.wy + g.wh + m, g.oy + g.ih) - ry;
      const gw = Math.max(2, Math.ceil(rw / p));
      const gh = Math.max(2, Math.ceil(rh / p));
      let L = luma(img, g, rx, ry, rw, rh, gw, gh);
      for (let k = 0; k < 3; k++) L = boxBlur(L, gw, gh, 2);

      const last = ramp.length - 1;
      const lut = new Uint8ClampedArray(256 * 3);
      for (let v = 0; v < 256; v++) {
        const t = (v / 255) * last;
        const j = Math.min(last - 1, t | 0);
        for (let c = 0; c < 3; c++) {
          lut[v * 3 + c] = ramp[j][c] + (ramp[j + 1][c] - ramp[j][c]) * (t - j);
        }
      }

      // One canvas pixel per CSS px: the field is smooth, and the grain
      // reads as film grain at any density.
      const W = Math.round(g.ww);
      const H = Math.round(g.wh);
      this.cv.width = W;
      this.cv.height = H;
      const ctx = this.cv.getContext("2d", { alpha: false });
      const out = ctx.createImageData(W, H);
      const o = out.data;
      const sx = gw / rw;
      const sy = gh / rh;
      const x0 = new Int32Array(W);
      const xf = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        const bx = clamp((g.wx - rx + x + 0.5) * sx - 0.5, 0, gw - 1.001);
        x0[x] = bx | 0;
        xf[x] = bx - x0[x];
      }
      for (let y = 0, i = 0; y < H; y++) {
        const by = clamp((g.wy - ry + y + 0.5) * sy - 0.5, 0, gh - 1.001);
        const y0 = by | 0;
        const fy = by - y0;
        const a = y0 * gw;
        const b = a + gw;
        for (let x = 0; x < W; x++, i += 4) {
          const c = x0[x];
          const f = xf[x];
          const top = L[a + c] + (L[a + c + 1] - L[a + c]) * f;
          const bot = L[b + c] + (L[b + c + 1] - L[b + c]) * f;
          const v = clamp(Math.round((top + (bot - top) * fy) * 255), 0, 255) * 3;
          const n = (Math.random() - 0.5) * GRAIN;
          o[i] = lut[v] + n;
          o[i + 1] = lut[v + 1] + n;
          o[i + 2] = lut[v + 2] + n;
          o[i + 3] = 255;
        }
      }
      ctx.putImageData(out, 0, 0);
    }
  }

  class Bits extends Win {
    constructor(win) {
      super(win);
      this.bits = true;
      this.rate = parseFloat(win.dataset.rate) || 1;
      this.pointer = null;
      this.cv.addEventListener("pointermove", (e) => {
        if (!this.cols) return;
        const b = this.cv.getBoundingClientRect();
        this.pointer = {
          col: ((e.clientX - b.left) / b.width) * this.cols,
          row: ((e.clientY - b.top) / b.height) * this.rows,
        };
        wake();
      });
      this.cv.addEventListener("pointerleave", () => (this.pointer = null));
    }

    paint(img, g) {
      const gc = Math.max(2, Math.round(g.ww / CW));
      const gr = Math.max(2, Math.round(g.wh / CH));
      const n = gc * gr;
      const lum = luma(img, g, g.wx, g.wy, g.ww, g.wh, gc, gr);

      // Each window is levelled on its own: half a plain stretch to its
      // range, half its rank among the window's cells. The rank spreads a
      // dim crop across every band; the stretch keeps the real contrast.
      const order = Array.from(lum.keys()).sort((a, b) => lum[a] - lum[b]);
      const lo = lum[order[Math.floor(n * 0.03)]];
      const hi = lum[order[Math.min(n - 1, Math.floor(n * 0.985))]];
      const span = Math.max(0.08, hi - lo);
      const level = new Float32Array(n);
      order.forEach((cell, r) => {
        level[cell] = clamp((lum[cell] - lo) / span, 0, 1) * 0.5 + (r / (n - 1)) * 0.5;
      });

      // Device-pixel canvas with integer cell edges, so repaints leave no seams.
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const W = (this.cv.width = Math.round(g.ww * dpr));
      const H = (this.cv.height = Math.round(g.wh * dpr));
      this.xs = Int32Array.from({ length: gc + 1 }, (_, c) => Math.round((c * W) / gc));
      this.ys = Int32Array.from({ length: gr + 1 }, (_, r) => Math.round((r * H) / gr));

      // The glyph sheet: one column per character, one row per colour.
      const glyph = hex(g.st.getPropertyValue("--glyph") || "#d2ef62");
      const hot = hex(g.st.getPropertyValue("--glyph-hot") || "#ffffff");
      const ground = hex(g.st.getPropertyValue("--glyph-ground") || "#14121c");
      const colors = [mix(ground, glyph, 0.55), glyph, ...FLARES.map((f) => mix(glyph, hot, f))];
      const aw = (this.aw = Math.ceil(CW * dpr) + 2);
      const ah = (this.ah = Math.ceil(CH * dpr) + 2);
      const sheet = (this.sheet = canvas(CHARS.length * aw, colors.length * ah));
      const sc = sheet.getContext("2d");
      sc.font = `500 ${FONT_PX * dpr}px "Roboto Mono", ui-monospace, monospace`;
      sc.textAlign = "center";
      sc.textBaseline = "middle";
      const side = Math.round(Math.min(CW, CH) * dpr * 0.72);
      colors.forEach((color, row) => {
        sc.fillStyle = rgb(color);
        CHARS.forEach((ch, col) => {
          const cx = col * aw + aw / 2;
          const cy = row * ah + ah / 2;
          if (ch === "■") sc.fillRect(Math.round(cx - side / 2), Math.round(cy - side / 2), side, side);
          else sc.fillText(ch, cx, cy + 0.5);
        });
      });

      this.cols = gc;
      this.rows = gr;
      this.n = n;
      this.lum = level;
      this.band = new Uint8Array(n);
      this.pick = new Uint8Array(n);
      this.flare = new Float32Array(n);
      this.flaring = new Set();
      this.ground = rgb(ground);

      this.ctx = this.cv.getContext("2d", { alpha: false });
      this.ctx.fillStyle = this.ground;
      this.ctx.fillRect(0, 0, W, H);
      const t = performance.now();
      for (let i = 0; i < n; i++) {
        this.band[i] = this.bandFor(i, t);
        this.pick[i] = (Math.random() * 255) | 0;
        this.draw(i);
      }
    }

    bandFor(i, t) {
      const c = i % this.cols;
      const r = (i / this.cols) | 0;
      const wave =
        Math.sin(t * 0.00045 + c * 0.17 + r * 0.09) *
        Math.sin(t * 0.00031 - r * 0.21 + c * 0.05) *
        WAVE;
      const dither = BAYER[(r & 3) * 4 + (c & 3)] * 0.9;
      return clamp(Math.floor(this.lum[i] * (TOP + 0.4) + dither + wave), 0, TOP);
    }

    draw(i) {
      const c = i % this.cols;
      const r = (i / this.cols) | 0;
      const x = this.xs[c];
      const y = this.ys[r];
      const w = this.xs[c + 1] - x;
      const h = this.ys[r + 1] - y;
      const ctx = this.ctx;
      ctx.fillStyle = this.ground;
      ctx.fillRect(x, y, w, h);
      const band = this.band[i];
      if (!band) return;
      const set = BAND_CHARS[band];
      const f = this.flare[i];
      const row = f > 0.8 ? 5 : f > 0.5 ? 4 : f > 0.28 ? 3 : f > 0.12 ? 2 : band <= 2 ? 0 : 1;
      const col = set[this.pick[i] % set.length];
      ctx.drawImage(
        this.sheet,
        col * this.aw + ((this.aw - w) >> 1),
        row * this.ah + ((this.ah - h) >> 1),
        w, h, x, y, w, h,
      );
    }

    repick(i, t, flare) {
      this.band[i] = this.bandFor(i, t);
      this.pick[i] = (Math.random() * 255) | 0;
      if (flare && this.band[i] > 1) {
        this.flare[i] = 1;
        this.flaring.add(i);
      }
      this.draw(i);
    }

    // Returns whether the field still needs ticks.
    tick(t) {
      for (const i of this.flaring) {
        this.flare[i] *= DECAY;
        if (this.flare[i] < 0.12) {
          this.flare[i] = 0;
          this.flaring.delete(i);
        }
        this.draw(i);
      }

      if (!calm()) {
        // The fractional part is a probability, so small windows still move.
        const k = this.n * RATE * this.rate;
        const count = Math.floor(k) + (Math.random() < k % 1 ? 1 : 0);
        for (let j = 0; j < count; j++) {
          this.repick((Math.random() * this.n) | 0, t, Math.random() < FLARE);
        }
      }

      const p = this.pointer;
      if (p) {
        const c0 = Math.max(0, Math.floor(p.col - HOVER_R));
        const c1 = Math.min(this.cols - 1, Math.ceil(p.col + HOVER_R));
        const r0 = Math.max(0, Math.floor(p.row - HOVER_R));
        const r1 = Math.min(this.rows - 1, Math.ceil(p.row + HOVER_R));
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            const d = Math.hypot(c + 0.5 - p.col, (r + 0.5 - p.row) * (CH / CW) * 0.8);
            if (d < HOVER_R && Math.random() < HOVER_P * (1 - d / HOVER_R)) {
              this.repick(r * this.cols + c, t, true);
            }
          }
        }
      }

      return !calm() || !!p || this.flaring.size > 0;
    }
  }

  /* --- Guides along every window edge ------------------------------------ */
  function drawGuides(plate) {
    const field = plate.querySelector(".plate__field");
    if (!field) return;
    const W = field.offsetWidth;
    const H = field.offsetHeight;
    if (!W || !H) return;
    let layer = field.querySelector(".plate__guides");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "plate__guides";
      field.prepend(layer);
    }
    const xs = new Set();
    const ys = new Set();
    field.querySelectorAll(".win").forEach((win) => {
      if (!win.offsetWidth) return;
      const l = win.offsetLeft;
      const t = win.offsetTop;
      for (const x of [l, l + win.offsetWidth]) if (x > 1 && x < W - 1) xs.add(Math.round(x));
      for (const y of [t, t + win.offsetHeight]) if (y > 1 && y < H - 1) ys.add(Math.round(y));
    });
    const html = [];
    xs.forEach((x) => html.push(`<span class="plate__guide plate__guide--v" style="left:${(x / W) * 100}%"></span>`));
    ys.forEach((y) => html.push(`<span class="plate__guide plate__guide--h" style="top:${(y / H) * 100}%"></span>`));
    layer.innerHTML = html.join("");
  }

  /* --- Wiring ------------------------------------------------------------ */
  const all = [];
  const bits = [];
  const byWin = new Map();

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const it = byWin.get(e.target);
        it.visible = e.isIntersecting;
        if (it.visible && !it.ready && !it.busy) it.load();
      }
      wake();
    },
    { rootMargin: "200px 0px" },
  );

  // Guides redraw at once; windows repaint after a resize settles.
  let resizeTimer = 0;
  const ro = new ResizeObserver((entries) => {
    entries.forEach((e) => drawGuides(e.target));
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const it of all) {
        if (!it.ready || it.size === `${it.win.offsetWidth}x${it.win.offsetHeight}`) continue;
        it.ready = false;
        if (it.visible) it.load();
      }
    }, 150);
  });

  plates.forEach((plate) => {
    plate.querySelectorAll(".win[data-src]").forEach((win) => {
      if (!win.querySelector("canvas")) return;
      const it = win.classList.contains("win--bits") ? new Bits(win) : new Blur(win);
      all.push(it);
      if (it.bits) bits.push(it);
      byWin.set(win, it);
      io.observe(win);
    });
    ro.observe(plate);
    // Every plate with a glyph field carries a pause switch for all of them.
    if (motion && plate.querySelector(".win--bits canvas")) {
      const field = plate.querySelector(".plate__field");
      // Beside the field, not in it: the field is aria-hidden.
      if (field) field.after(motion.button());
      else plate.append(motion.button());
    }
  });

  let timer = 0;
  function loop() {
    timer = 0;
    if (document.hidden) return;
    const t = performance.now();
    let more = false;
    for (const f of bits) if (f.visible && f.ready && f.tick(t)) more = true;
    if (more) timer = setTimeout(loop, TICK);
  }

  function wake() {
    if (!timer && !document.hidden && bits.some((f) => f.visible && f.ready)) {
      timer = setTimeout(loop, TICK);
    }
  }

  document.addEventListener("visibilitychange", () => {
    clearTimeout(timer);
    timer = 0;
    wake();
  });
  still.addEventListener("change", wake);
  motion?.on(wake);
})();
