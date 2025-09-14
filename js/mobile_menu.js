document.addEventListener("DOMContentLoaded", () => {
  const mobileMenuButton = document.querySelector(".mobile-menu-button");
  const mainNav = document.querySelector(".main-nav");

  if (mobileMenuButton && mainNav) {
    mobileMenuButton.addEventListener("click", () => {
      mainNav.classList.toggle("is-active");
    });
  }
});
