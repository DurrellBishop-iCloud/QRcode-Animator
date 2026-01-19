/**
 * BarcodeRecognizer - Barcode detection using BarcodeDetector
 * Port of Swift BarcodeRecognizer
 */
import { RecognitionTechnique } from './RecognitionTechnique.js';

export class BarcodeRecognizer extends RecognitionTechnique {
    constructor() {
        super();

        // Check for native BarcodeDetector support
        this.useNative = 'BarcodeDetector' in window;

        if (this.useNative) {
            // Supported barcode formats (matching Swift)
            this.detector = new BarcodeDetector({
                formats: [
                    'code_39',  // Prioritized - wider bars, better for distance
                    'ean_8',
                    'ean_13',
                    'upc_e',
                    
                    'code_93',
                    'code_128',
                    'itf'
                ]
            });
            console.log('Using native BarcodeDetector for barcodes');
        } else {
            console.warn('BarcodeDetector not available - barcode detection disabled');
        }

        // Canvas for processing
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    /**
     * Process frame for barcode detection
     * @param {ImageData} imageData - Frame to process
     */
    async processFrame(imageData) {
        if (!this.useNative) {
            return; // No fallback for barcodes
        }

        let results = [];

        try {
            // Create ImageBitmap from ImageData
            this.canvas.width = imageData.width;
            this.canvas.height = imageData.height;
            this.ctx.putImageData(imageData, 0, 0);

            const imageBitmap = await createImageBitmap(this.canvas);
            const barcodes = await this.detector.detect(imageBitmap);

            results = barcodes.map(barcode => barcode.rawValue);

            // Debug output
            const debugEl = document.getElementById('barcode-debug');
            if (debugEl) {
                if (barcodes.length > 0) {
                    debugEl.textContent = 'Barcode: "' + results[0] + '" (' + barcodes[0].format + ')'; 
                } else {
                    debugEl.textContent = 'Scanning...'; 
                }
            }
        } catch (error) {
            console.error('Barcode detection error:', error);
        }

        // Handle detection state
        if (results.length > 0) {
            const payload = results[0];
            this.triggerDetectData(payload);

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
}
