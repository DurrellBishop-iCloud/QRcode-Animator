/**
 * KaleidoscopeFilter - Triangle kaleidoscope effect
 * Port of Swift CITriangleKaleidoscope
 */
export class KaleidoscopeFilter {
    constructor() {
        this.rotation = 0;
        this.segments = 6; // Number of kaleidoscope segments
    }

    /**
     * Set rotation angle
     * @param {number} rotation - Rotation in radians
     */
    setRotation(rotation) {
        this.rotation = rotation;
    }

    /**
     * Apply kaleidoscope effect
     * @param {HTMLCanvasElement} sourceCanvas - Input canvas
     * @returns {HTMLCanvasElement} Processed canvas
     */
    apply(sourceCanvas) {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const size = Math.min(width, height);
        const centerX = width / 2;
        const centerY = height / 2;

        // Create output canvas
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = width;
        outputCanvas.height = height;
        const ctx = outputCanvas.getContext('2d');

        // Fill with black background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        // Draw kaleidoscope segments
        const segmentAngle = (Math.PI * 2) / this.segments;

        for (let i = 0; i < this.segments; i++) {
            ctx.save();

            // Move to center
            ctx.translate(centerX, centerY);

            // Rotate for this segment
            ctx.rotate(i * segmentAngle + this.rotation);

            // Flip every other segment for mirror effect
            if (i % 2 === 1) {
                ctx.scale(-1, 1);
            }

            // Create clipping path for this segment (triangle)
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const r = size;
            ctx.lineTo(r * Math.cos(-segmentAngle / 2), r * Math.sin(-segmentAngle / 2));
            ctx.lineTo(r * Math.cos(segmentAngle / 2), r * Math.sin(segmentAngle / 2));
            ctx.closePath();
            ctx.clip();

            // Draw source image
            ctx.drawImage(
                sourceCanvas,
                -centerX, -centerY,
                width, height
            );

            ctx.restore();
        }

        return outputCanvas;
    }

    /**
     * Apply to ImageData (converts to canvas and back)
     * @param {ImageData} imageData - Input image data
     * @returns {ImageData} Processed image data
     */
    applyToImageData(imageData) {
        // Create temp canvas from ImageData
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        // Apply effect
        const resultCanvas = this.apply(tempCanvas);

        // Get result as ImageData
        return resultCanvas.getContext('2d').getImageData(
            0, 0, resultCanvas.width, resultCanvas.height
        );
    }
}
