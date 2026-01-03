/**
 * BrightnessFilter - Adjusts image brightness
 */
export class BrightnessFilter {
    /**
     * Apply brightness adjustment
     * @param {ImageData} imageData - Input image
     * @param {number} brightness - Brightness multiplier (0.5 = darker, 1.0 = normal, 1.5 = brighter)
     * @returns {ImageData} Processed image
     */
    apply(imageData, brightness = 1.0) {
        const data = imageData.data;

        // Convert brightness to offset (-128 to +128 range feels more natural)
        // brightness 0.5 = -64, brightness 1.0 = 0, brightness 1.5 = +64
        const offset = (brightness - 1.0) * 128;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, data[i] + offset));     // R
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + offset)); // G
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + offset)); // B
            // Alpha unchanged
        }

        return imageData;
    }
}
