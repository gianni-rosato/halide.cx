class MetricSwitcher {
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
    this.imgElement.alt = "Iris WebP metrics";
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
  const switcherContainer = document.getElementById("metrics-switcher");
  if (switcherContainer) {
    switcherContainer.innerHTML = "";
    const images = [
      "/img/metrics/ssimu2.svg",
      "/img/metrics/butter.svg",
      "/img/metrics/psnrhvs.svg",
      "/img/metrics/msssim.svg",
    ];
    const subtitles = [
      "SSIMULACRA2",
      "Butteraugli 3-norm, intensity target 203",
      "PSNR-HVS",
      "MS-SSIM",
    ];
    const args = [
      "SSIMULACRA2",
      "Butteraugli",
      "PSNR-HVS",
      "MS-SSIM",
    ];
    try {
      new MetricSwitcher("metrics-switcher", images, subtitles, args);
    } catch (error) {
      console.error("Failed to initialize metric switcher:", error);
      switcherContainer.innerHTML =
        "<p>Failed to load metric comparison tool.</p>";
    }
  }
});
