/**
 * UIController - Handles DOM manipulation and rendering
 * Port of Swift ContentView rendering logic
 */
import { eventBus, Events } from '../core/EventBus.js';
import { settings } from '../managers/SettingsManager.js';

export class UIController {
    constructor(elements) {
        this.elements = elements;
        this.screenSize = { width: window.innerWidth, height: window.innerHeight };

        this.setupEventListeners();
        this.updateFrameOverlays();

        // Subscribe to settings changes
        settings.subscribe('frameTopThickness', () => this.updateFrameOverlays());
        settings.subscribe('frameBottomThickness', () => this.updateFrameOverlays());
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Single tap to open settings
        this.elements.video.addEventListener('click', () => {
            this.showSettings();
        });

        // Close settings button
        this.elements.closeSettings.addEventListener('click', () => {
            eventBus.publish(Events.SETTINGS_CLOSED, {});
            this.hideSettings();
        });

        // Click outside modal to close
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.hideSettings();
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.screenSize = { width: window.innerWidth, height: window.innerHeight };
            this.resizeCanvases();
        });

        // Flash trigger
        eventBus.subscribe(Events.FLASH_TRIGGER, () => this.showFlash());
    }

    /**
     * Resize canvases to match screen
     */
    resizeCanvases() {
        const width = this.screenSize.width;
        const height = this.screenSize.height;

        [this.elements.mainCanvas, this.elements.onionCanvas, this.elements.overlayCanvas].forEach(canvas => {
            canvas.width = width;
            canvas.height = height;
        });
    }

    /**
     * Initialize canvas sizes based on video dimensions
     * @param {number} videoWidth
     * @param {number} videoHeight
     */
    initCanvases(videoWidth, videoHeight) {
        // Display canvases match screen size
        this.resizeCanvases();
    }

    /**
     * Update frame overlay bar heights
     */
    updateFrameOverlays() {
        this.elements.topFrame.style.height = `${settings.frameTopThickness}px`;
        this.elements.bottomFrame.style.height = `${settings.frameBottomThickness}px`;

        // Update debug rect position
        const debugRect = this.elements.debugRect;
        debugRect.style.top = `${settings.frameTopThickness}px`;
        debugRect.style.bottom = `${settings.frameBottomThickness}px`;
    }

    /**
     * Render a frame to the main canvas
     * @param {ImageData} imageData - Frame to render
     */
    renderFrame(imageData) {
        const ctx = this.elements.mainCanvas.getContext('2d');
        const canvas = this.elements.mainCanvas;

        // Create temp canvas for the image data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        tempCanvas.getContext('2d').putImageData(imageData, 0, 0);

        // Clear and draw scaled to fit
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate aspect-fit dimensions
        const { x, y, width, height } = this.calculateAspectFit(
            imageData.width, imageData.height,
            canvas.width, canvas.height
        );

        ctx.drawImage(tempCanvas, x, y, width, height);
    }

    /**
     * Render a canvas to the main display
     * @param {HTMLCanvasElement} sourceCanvas - Canvas to render
     */
    renderCanvas(sourceCanvas) {
        const ctx = this.elements.mainCanvas.getContext('2d');
        const canvas = this.elements.mainCanvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const { x, y, width, height } = this.calculateAspectFit(
            sourceCanvas.width, sourceCanvas.height,
            canvas.width, canvas.height
        );

        ctx.drawImage(sourceCanvas, x, y, width, height);
    }

    /**
     * Clear the main canvas
     */
    clearMainCanvas() {
        const ctx = this.elements.mainCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.elements.mainCanvas.width, this.elements.mainCanvas.height);
    }

    /**
     * Render onion skin (previous frame overlay)
     * @param {ImageData} imageData - Previous frame
     * @param {number} opacity - Opacity (0-1)
     * @param {number} offsetX - X offset
     * @param {number} offsetY - Y offset
     */
    renderOnionSkin(imageData, opacity = 0.6, offsetX = 0, offsetY = 0) {
        const ctx = this.elements.onionCanvas.getContext('2d');
        const canvas = this.elements.onionCanvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!imageData) return;

        // Create temp canvas for the image data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        tempCanvas.getContext('2d').putImageData(imageData, 0, 0);

        // Calculate aspect-fit dimensions
        const { x, y, width, height } = this.calculateAspectFit(
            imageData.width, imageData.height,
            canvas.width, canvas.height
        );

        ctx.globalAlpha = opacity;
        ctx.drawImage(tempCanvas, x + offsetX, y + offsetY, width, height);
        ctx.globalAlpha = 1.0;
    }

    /**
     * Clear onion skin canvas
     */
    clearOnionSkin() {
        const ctx = this.elements.onionCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.elements.onionCanvas.width, this.elements.onionCanvas.height);
    }

    /**
     * Show flash effect
     */
    showFlash() {
        const flash = this.elements.flash;
        flash.classList.remove('hidden');

        setTimeout(() => {
            flash.classList.add('hidden');
        }, 150);
    }

    /**
     * Update status display
     * @param {string} mode - Current mode (Make/Play)
     * @param {number} frameCount - Total frames
     * @param {number} currentIndex - Current frame index (-1 for live feed)
     */
    updateStatus(mode, frameCount, currentIndex = -1) {
        this.elements.modeText.textContent = mode;

        if (mode === 'Make') {
            if (currentIndex === -1) {
                this.elements.frameCount.textContent = `${frameCount} frames`;
            } else {
                this.elements.frameCount.textContent = `${currentIndex + 1}/${frameCount}`;
            }
        } else {
            this.elements.frameCount.textContent = `${currentIndex + 1}/${frameCount}`;
        }
    }

    /**
     * Update display text (QR code content, status messages)
     * @param {string} text - Text to display
     */
    updateDisplayText(text) {
        this.elements.displayText.textContent = text;
    }

    /**
     * Show settings modal
     */
    showSettings() {
        this.elements.settingsModal.classList.remove('hidden');
    }

    /**
     * Hide settings modal
     */
    hideSettings() {
        this.elements.settingsModal.classList.add('hidden');
    }

    /**
     * Calculate aspect-fit dimensions
     * @param {number} srcWidth - Source width
     * @param {number} srcHeight - Source height
     * @param {number} destWidth - Destination width
     * @param {number} destHeight - Destination height
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    calculateAspectFit(srcWidth, srcHeight, destWidth, destHeight) {
        const srcAspect = srcWidth / srcHeight;
        const destAspect = destWidth / destHeight;

        let width, height;

        if (srcAspect > destAspect) {
            // Source is wider - fit to width
            width = destWidth;
            height = destWidth / srcAspect;
        } else {
            // Source is taller - fit to height
            height = destHeight;
            width = destHeight * srcAspect;
        }

        const x = (destWidth - width) / 2;
        const y = (destHeight - height) / 2;

        return { x, y, width, height };
    }

    /**
     * Get screen size
     * @returns {{width: number, height: number}}
     */
    getScreenSize() {
        return this.screenSize;
    }
}
