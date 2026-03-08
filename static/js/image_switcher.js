class ImageSwitcher {
  constructor(containerID, images, subtitles, args) {
    this.containerID = containerID;
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
    if (!this.container) {
      throw new Error(
        `Image switcher container not found: ${this.containerID}`,
      );
    }

    const switcherContainer = document.createElement("div");
    switcherContainer.className = "image-switcher-container";
    this.imgElement = document.createElement("img");
    this.imgElement.src = this.images[0];
    this.imgElement.alt = this.container.dataset.alt || "Iris WebP comparison";
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

function parseSwitcherData(container, key) {
  const value = container.dataset[key];
  if (!value) {
    throw new Error(`Missing data-${key} for #${container.id}`);
  }

  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Invalid data-${key} for #${container.id}`);
  }

  return parsed;
}

function initConfiguredImageSwitchers() {
  const switcherContainers = document.querySelectorAll("[data-image-switcher]");

  switcherContainers.forEach((container, index) => {
    if (!container.id) {
      container.id = `image-switcher-${index + 1}`;
    }

    try {
      const images = parseSwitcherData(container, "images");
      const subtitles = parseSwitcherData(container, "subtitles");
      const labels = parseSwitcherData(container, "labels");

      if (
        images.length !== subtitles.length ||
        images.length !== labels.length
      ) {
        throw new Error(`Mismatched data lengths for #${container.id}`);
      }

      container.innerHTML = "";
      new ImageSwitcher(container.id, images, subtitles, labels);
    } catch (error) {
      console.error("Failed to initialize image switcher:", error);
      container.innerHTML = "<p>Failed to load image comparison tool.</p>";
    }
  });
}

globalThis.ImageSwitcher = ImageSwitcher;

document.addEventListener("DOMContentLoaded", function () {
  initConfiguredImageSwitchers();
});
