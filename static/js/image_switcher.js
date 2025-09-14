class ImageSwitcher {
  constructor(containerID, images, subtitles, args) {
    this.container = document.getElementById(containerID);
    this.images = images;
    this.subtitles = subtitles;
    this.args = args;
    this.currentIndex = 0;
    this.init();
  }

  switchImage(index) {
    const buttons = this.buttonContainer.querySelectorAll(".switcher-button");
    buttons.forEach((button) => button.classList.remove("active"));
    buttons[index].classList.add("active");
    this.currentIndex = index;
    this.imgElement.style.opacity = "0.7";
    this.imgElement.src = this.images[index];
    this.subtitleElement.textContent = this.subtitles[index];
    this.imgElement.onload = () => {
      this.imgElement.style.opacity = "1";
    };
  }

  init() {
    const switcherContainer = document.createElement("div");
    switcherContainer.className = "image-switcher-container";
    this.imgElement = document.createElement("img");
    this.imgElement.src = this.images[0];
    this.imgElement.alt = "Iris WebP comparison";
    this.imgElement.loading = "lazy";
    this.imgElement.onerror = () => {
      console.warn("Failed to load image:", this.images[this.currentIndex]);
      this.subtitleElement.textContent = "Image failed to load";
    };
    this.subtitleElement = document.createElement("p");
    this.subtitleElement.className = "image-caption";
    this.subtitleElement.textContent = this.subtitles[0];
    this.buttonContainer = document.createElement("div");
    this.buttonContainer.className = "switcher-buttons";
    this.args.forEach((codec, index) => {
      const button = document.createElement("button");
      button.textContent = codec;
      button.className = "switcher-button";
      if (index === 0) {
        button.classList.add("active");
      }
      button.addEventListener("click", () => this.switchImage(index));
      this.buttonContainer.appendChild(button);
    });
    switcherContainer.appendChild(this.imgElement);
    switcherContainer.appendChild(this.subtitleElement);
    switcherContainer.appendChild(this.buttonContainer);

    this.container.appendChild(switcherContainer);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const switcherContainer = document.getElementById("iris-switcher");
  if (switcherContainer) {
    switcherContainer.innerHTML = "";
    const images = [
      "/img/eos3-libwebp.webp",
      "/img/eos3-iris.webp",
      "/img/eos3-jpegli.jpg",
      "/img/eos3-source.png",
    ];
    const subtitles = [
      "113,446 bytes | 50.90 SSIMULACRA2 | 2.73 Butteraugli (3-norm, i203)",
      "113,450 bytes | 60.10 SSIMULACRA2 | 2.30 Butteraugli (3-norm, i203)",
      "113,678 bytes | 54.57 SSIMULACRA2 | 2.41 Butteraugli (3-norm, i203)",
      "1,532,759 bytes",
    ];
    const args = [
      "libwebp",
      "Iris-WebP",
      "libjpegli",
      "Source",
    ];
    try {
      new ImageSwitcher("iris-switcher", images, subtitles, args);
    } catch (error) {
      console.error("Failed to initialize image switcher:", error);
      switcherContainer.innerHTML =
        "<p>Failed to load image comparison tool.</p>";
    }
  }
});
