/*
  One pause switch for the site's ambient animation: the plates' glyph
  fields (js/plates.js) and the launch hero's fire (js/binary_fire.js).
  Each animated block gets a toggle button from `halideMotion.button()`;
  any of them pauses everything, and the choice is remembered across pages.
  Animation that answers the pointer keeps working while paused.
*/
(() => {
  const KEY = "halide-motion";
  let paused = false;
  try {
    paused = localStorage.getItem(KEY) === "paused";
  } catch {}

  const listeners = new Set();
  const buttons = new Set();
  const sync = () => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(paused));
  };

  const ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path class="motion-toggle__pause" d="M4 3h3v10H4zM9 3h3v10H9z"/>' +
    '<path class="motion-toggle__play" d="M5 3l8 5-8 5z"/></svg>';

  const motion = {
    get paused() {
      return paused;
    },
    set(next) {
      paused = !!next;
      try {
        if (paused) localStorage.setItem(KEY, "paused");
        else localStorage.removeItem(KEY);
      } catch {}
      sync();
      listeners.forEach((fn) => fn(paused));
    },
    on(fn) {
      listeners.add(fn);
    },
    button() {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "motion-toggle";
      b.setAttribute("aria-label", "Pause animation");
      b.innerHTML = ICON;
      b.addEventListener("click", () => motion.set(!paused));
      buttons.add(b);
      sync();
      return b;
    },
  };

  globalThis.halideMotion = motion;
})();
