/**
 * InvertFilter - Invert colors with adaptive threshold
 * Port of Swift applyAdaptiveThreshold
 */
export class InvertFilter {
    /**
     * Apply adaptive threshold inversion
     * @param {ImageData} imageData - Input image
     * @returns {ImageData} Processed image
     */
    apply(imageData) {
        const data = imageData.data;

        // First pass: collect brightness samples to find median
        const brightnesses = [];
        const sampleStep = Math.floor(imageData.width * imageData.height / 100);

        for (let i = 0; i < data.length; i += 4 * sampleStep) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = (r + g + b) / 3 / 255;
            brightnesses.push(brightness);
        }

        // Find median brightness
        brightnesses.sort((a, b) => a - b);
        const medianBrightness = brightnesses[Math.floor(brightnesses.length / 2)] || 0.5;

        // Second pass: apply threshold with inversion
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = (r + g + b) / 3 / 255;

            // Invert around median: dark becomes white, light becomes black
            let output;
            if (brightness < medianBrightness - 0.1) {
                output = 255; // Dark input → white output
            } else if (brightness > medianBrightness + 0.1) {
                output = 0; // Light input → black output
            } else {
                // Transition zone
                const t = (brightness - (medianBrightness - 0.1)) / 0.2;
                output = Math.round(255 * (1 - t));
            }

            data[i] = output;
            data[i + 1] = output;
            data[i + 2] = output;
            // Alpha unchanged
        }

        return imageData;
    }
}
