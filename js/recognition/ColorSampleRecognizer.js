/**
 * ColorSampleRecognizer - Color sampling from center of frame
 * Port of Swift ColorSampleRecognizer
 */
import { RecognitionTechnique } from './RecognitionTechnique.js';
import { settings } from '../managers/SettingsManager.js';

export class ColorSampleRecognizer extends RecognitionTechnique {
    constructor() {
        super();

        this.sampleSize = 50; // 50x50 pixel sample area
        this.colorThreshold = 0.3; // Tolerance for color matching (0-1 range)
    }

    /**
     * Get target color from settings
     * @returns {{r: number, g: number, b: number}}
     */
    get targetColor() {
        return settings.targetColor;
    }

    /**
     * Process frame for color detection
     * @param {ImageData} imageData - Frame to process
     */
    processFrame(imageData) {
        // Calculate center sample area
        const centerX = Math.floor(imageData.width / 2);
        const centerY = Math.floor(imageData.height / 2);
        const halfSize = Math.floor(this.sampleSize / 2);

        // Get average color of center area
        const avgColor = this.getAverageColor(
            imageData,
            centerX - halfSize,
            centerY - halfSize,
            this.sampleSize,
            this.sampleSize
        );

        // Check if color matches target
        const isMatch = this.isColorMatch(avgColor, this.targetColor);

        // Handle detection state
        if (isMatch) {
            this.triggerDetectData(''); // Color match doesn't have data payload

            if (!this.isCurrentlyDetecting) {
                this.isCurrentlyDetecting = true;
                this.triggerDetectTarget();
            }
        } else {
            if (this.isCurrentlyDetecting) {
                this.isCurrentlyDetecting = false;
                this.triggerLoseTarget();
            }
        }
    }

    /**
     * Calculate average color in a region
     * @param {ImageData} imageData - Image data
     * @param {number} startX - Start X coordinate
     * @param {number} startY - Start Y coordinate
     * @param {number} width - Region width
     * @param {number} height - Region height
     * @returns {{r: number, g: number, b: number}} Average color (0-1 range)
     */
    getAverageColor(imageData, startX, startY, width, height) {
        const data = imageData.data;
        const imgWidth = imageData.width;

        let totalR = 0, totalG = 0, totalB = 0;
        let count = 0;

        // Clamp bounds
        const endX = Math.min(startX + width, imageData.width);
        const endY = Math.min(startY + height, imageData.height);
        startX = Math.max(0, startX);
        startY = Math.max(0, startY);

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = (y * imgWidth + x) * 4;
                totalR += data[idx];
                totalG += data[idx + 1];
                totalB += data[idx + 2];
                count++;
            }
        }

        if (count === 0) {
            return { r: 0, g: 0, b: 0 };
        }

        return {
            r: totalR / count / 255,
            g: totalG / count / 255,
            b: totalB / count / 255
        };
    }

    /**
     * Check if color matches target within threshold
     * @param {{r: number, g: number, b: number}} color - Measured color
     * @param {{r: number, g: number, b: number}} target - Target color
     * @returns {boolean} True if colors match
     */
    isColorMatch(color, target) {
        const redDiff = Math.abs(color.r - target.r);
        const greenDiff = Math.abs(color.g - target.g);
        const blueDiff = Math.abs(color.b - target.b);

        return (
            redDiff < this.colorThreshold &&
            greenDiff < this.colorThreshold &&
            blueDiff < this.colorThreshold
        );
    }
}
