class ImageSwitcher {
  constructor(containerID, images, subtitles, args) {
    this.containerID = containerID;
    this.container = document.getElementById(containerID);
    this.images = images;
    this.subtitles = subtitles;
    this.args = args;
    this.currentIndex = 0;
    this.decoded = new Map();
    this.init();
  }

  async switchImage(index) {
    const buttons = this.buttonContainer.querySelectorAll(".switcher-button");
    buttons.forEach((button) => button.classList.remove("active"));
    buttons[index].classList.add("active");
    this.currentIndex = index;
    this.subtitleElement.textContent = this.subtitles[index];

    const src = this.images[index];
    try {
      await this.preload(src);
    } catch {
      console.warn("Failed to load image:", src);
      this.subtitleElement.textContent = "Image failed to load";
      return;
    }

    // A later click may have landed while we were decoding.
    if (this.currentIndex !== index) return;
    this.imgElement.src = src;
  }

  preload(src) {
    let pending = this.decoded.get(src);
    if (!pending) {
      const image = new Image();
      image.src = src;
      pending = image.decode().then(() => image);
      this.decoded.set(src, pending);
    }
    return pending;
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
    // Present the swapped-in frame atomically rather than on a later paint.
    this.imgElement.decoding = "sync";
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

    const warm = () =>
      this.images.forEach((src) => this.preload(src).catch(() => {}));
    if ("requestIdleCallback" in globalThis) {
      requestIdleCallback(warm, { timeout: 3000 });
    } else {
      setTimeout(warm, 1000);
    }
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
