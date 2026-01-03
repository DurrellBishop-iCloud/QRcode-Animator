/**
 * SaturationFilter - Adjust image saturation
 * Port of Swift CIColorControls saturation
 */
export class SaturationFilter {
    /**
     * Apply saturation adjustment
     * @param {ImageData} imageData - Input image
     * @param {number} saturation - Saturation factor (1.0 = normal, 0 = grayscale)
     * @returns {ImageData} Processed image
     */
    apply(imageData, saturation = 1.0) {
        if (saturation === 1.0) {
            return imageData;
        }

        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Calculate grayscale (luminance)
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;

            // Interpolate between grayscale and original color
            data[i] = this.clamp(gray + saturation * (r - gray));
            data[i + 1] = this.clamp(gray + saturation * (g - gray));
            data[i + 2] = this.clamp(gray + saturation * (b - gray));
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
