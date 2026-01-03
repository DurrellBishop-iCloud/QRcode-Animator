/**
 * ContrastFilter - Adjust image contrast
 * Port of Swift CIColorControls contrast
 */
export class ContrastFilter {
    /**
     * Apply contrast adjustment
     * @param {ImageData} imageData - Input image
     * @param {number} contrast - Contrast factor (1.0 = normal)
     * @returns {ImageData} Processed image
     */
    apply(imageData, contrast = 1.0) {
        if (contrast === 1.0) {
            return imageData;
        }

        const data = imageData.data;
        const factor = contrast;

        for (let i = 0; i < data.length; i += 4) {
            // Apply contrast formula: (color - 128) * contrast + 128
            data[i] = this.clamp((data[i] - 128) * factor + 128);         // R
            data[i + 1] = this.clamp((data[i + 1] - 128) * factor + 128); // G
            data[i + 2] = this.clamp((data[i + 2] - 128) * factor + 128); // B
            // Alpha unchanged
        }

        return imageData;
    }

    /**
     * Clamp value to 0-255 range
     * @param {number} value
     * @returns {number}
     */
    clamp(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }
}
