/**
 * TransparencyFilter - Remove bright background (chroma key)
 * Port of Swift applyTransparency
 */
export class TransparencyFilter {
    constructor() {
        this.hasCalibrated = false;
        this.transparencyThreshold = 0.7;
    }

    /**
     * Calibrate threshold from live feed
     * @param {ImageData} imageData - Frame to calibrate from
     */
    calibrate(imageData) {
        const data = imageData.data;
        const brightnesses = [];

        // Sample 100 points
        const sampleStep = Math.floor(imageData.width * imageData.height / 100);

        for (let i = 0; i < data.length; i += 4 * sampleStep) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;
            const brightness = (r + g + b) / 3;
            brightnesses.push(brightness);
        }

        // Sort to find median (majority = background)
        brightnesses.sort((a, b) => a - b);
        const backgroundBrightness = brightnesses[Math.floor(brightnesses.length / 2)];

        // Set threshold slightly below background
        this.transparencyThreshold = backgroundBrightness * 0.9;
        this.hasCalibrated = true;

        console.log(`Transparency calibrated: threshold=${this.transparencyThreshold.toFixed(2)}`);
    }

    /**
     * Apply transparency filter
     * @param {ImageData} imageData - Input image
     * @param {number} adjust - Transparency adjustment (-0.2 to 0.2)
     * @param {ImageData|null} background - Background image to composite
     * @returns {ImageData} Processed image
     */
    apply(imageData, adjust = 0, background = null) {
        const data = imageData.data;
        const threshold = this.transparencyThreshold + adjust;

        // Get background data if available
        let bgData = null;
        if (background) {
            bgData = background.data;
        }

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;
            const brightness = (r + g + b) / 3;

            if (brightness > threshold) {
                // Make transparent or replace with background
                if (bgData && i < bgData.length) {
                    data[i] = bgData[i];
                    data[i + 1] = bgData[i + 1];
                    data[i + 2] = bgData[i + 2];
                } else {
                    // Orange background fallback (#FF8C00)
                    data[i] = 255;
                    data[i + 1] = 140;
                    data[i + 2] = 0;
                }
                data[i + 3] = 255; // Keep opaque for display
            }
            // Else keep original pixel
        }

        return imageData;
    }

    /**
     * Reset calibration
     */
    reset() {
        this.hasCalibrated = false;
        this.transparencyThreshold = 0.7;
    }
}
