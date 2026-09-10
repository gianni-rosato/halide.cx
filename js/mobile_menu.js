document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector(".mobile-menu-button");
  const nav = document.querySelector(".main-nav");

  if (!button || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("is-active", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  const isOpen = () => button.getAttribute("aria-expanded") === "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(!isOpen());
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false);
      button.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (isOpen() && !nav.contains(event.target)) {
      setOpen(false);
    }
  });

  // Following a link inside the sheet should leave it closed behind you.
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  // The sheet is mobile-only; if the viewport grows past the nav breakpoint
  // while it is open, drop the open state so it does not linger.
  const desktop = window.matchMedia("(min-width: 768px)");
  desktop.addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
});
