/**
 * FilterPipeline - Orchestrates filter chain
 * Port of Swift CameraManager filter application
 */
import { settings } from '../managers/SettingsManager.js';
import { BrightnessFilter } from './BrightnessFilter.js';
import { ContrastFilter } from './ContrastFilter.js';
import { SaturationFilter } from './SaturationFilter.js';
import { InvertFilter } from './InvertFilter.js';
import { TransparencyFilter } from './TransparencyFilter.js';
import { KaleidoscopeFilter } from './KaleidoscopeFilter.js';

export class FilterPipeline {
    constructor() {
        this.brightnessFilter = new BrightnessFilter();
        this.contrastFilter = new ContrastFilter();
        this.saturationFilter = new SaturationFilter();
        this.invertFilter = new InvertFilter();
        this.transparencyFilter = new TransparencyFilter();
        this.kaleidoscopeFilter = new KaleidoscopeFilter();

        this.backgroundImage = null;
    }

    /**
     * Set background image for transparency filter
     * @param {ImageData} imageData
     */
    setBackground(imageData) {
        this.backgroundImage = imageData;
    }

    /**
     * Calibrate transparency from live feed
     * @param {ImageData} imageData
     */
    calibrateTransparency(imageData) {
        this.transparencyFilter.calibrate(imageData);
    }

    /**
     * Apply all enabled filters to image data
     * @param {ImageData} imageData - Input image
     * @param {Object} options - Override options
     * @returns {ImageData} Processed image
     */
    applyFilters(imageData, options = {}) {
        // Clone image data to avoid modifying original
        let result = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );

        const opts = {
            skipTransparency: options.skipTransparency || false,
            ...options
        };

        // 1. Transparency (if enabled and not skipped)
        if (settings.backgroundTransparent && !opts.skipTransparency) {
            // Calibrate if not done yet
            if (!this.transparencyFilter.hasCalibrated) {
                this.transparencyFilter.calibrate(result);
            }

            const bgImage = settings.useBackground ? this.backgroundImage : null;
            result = this.transparencyFilter.apply(
                result,
                settings.transparencyAdjust,
                bgImage
            );

            // Return early - transparency is the final effect
            return result;
        }

        // 2. Invert colors (if enabled)
        if (settings.invertColors) {
            result = this.invertFilter.apply(result);
            // Return early - invert is a terminal effect
            return result;
        }

        // 3. Brightness adjustment
        if (settings.brightness !== 1.0) {
            result = this.brightnessFilter.apply(result, settings.brightness);
        }

        // 4. Contrast adjustment
        if (settings.contrast !== 1.0) {
            result = this.contrastFilter.apply(result, settings.contrast);
        }

        // 5. Saturation adjustment
        if (settings.saturation !== 1.0) {
            result = this.saturationFilter.apply(result, settings.saturation);
        }

        // 5. Kaleidoscope (if enabled)
        if (settings.kaleidoscopeEnabled) {
            this.kaleidoscopeFilter.setRotation(settings.kaleidoscopeRotation);
            result = this.kaleidoscopeFilter.applyToImageData(result);
        }

        return result;
    }

    /**
     * Apply kaleidoscope only (for live preview)
     * @param {HTMLCanvasElement} canvas - Input canvas
     * @returns {HTMLCanvasElement} Processed canvas
     */
    applyKaleidoscopeToCanvas(canvas) {
        if (!settings.kaleidoscopeEnabled) {
            return canvas;
        }

        this.kaleidoscopeFilter.setRotation(settings.kaleidoscopeRotation);
        return this.kaleidoscopeFilter.apply(canvas);
    }

    /**
     * Reset filter states
     */
    reset() {
        this.transparencyFilter.reset();
        this.backgroundImage = null;
    }
}
