/**
 * QRCodeRecognizer - QR code detection using BarcodeDetector or jsQR fallback
 * Port of Swift QRCodeRecognizer
 */
import { RecognitionTechnique } from './RecognitionTechnique.js';

export class QRCodeRecognizer extends RecognitionTechnique {
    constructor() {
        super();

        // Check for native BarcodeDetector support
        this.useNative = 'BarcodeDetector' in window;

        if (this.useNative) {
            this.detector = new BarcodeDetector({ formats: ['qr_code'] });
            console.log('Using native BarcodeDetector for QR codes');
        } else {
            console.log('Using jsQR fallback for QR codes');
        }

        // Canvas for processing
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    /**
     * Process frame for QR code detection
     * @param {ImageData} imageData - Frame to process
     */
    async processFrame(imageData) {
        let results = [];

        try {
            if (this.useNative) {
                results = await this.detectNative(imageData);
            } else {
                results = this.detectFallback(imageData);
            }
        } catch (error) {
            console.error('QR detection error:', error);
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

    /**
     * Detect using native BarcodeDetector
     * @param {ImageData} imageData
     * @returns {Promise<string[]>} Detected QR code values
     */
    async detectNative(imageData) {
        // Create ImageBitmap from ImageData
        this.canvas.width = imageData.width;
        this.canvas.height = imageData.height;
        this.ctx.putImageData(imageData, 0, 0);

        const imageBitmap = await createImageBitmap(this.canvas);
        const barcodes = await this.detector.detect(imageBitmap);

        return barcodes.map(barcode => barcode.rawValue);
    }

    /**
     * Detect using jsQR fallback
     * @param {ImageData} imageData
     * @returns {string[]} Detected QR code values
     */
    detectFallback(imageData) {
        // jsQR expects ImageData directly
        if (typeof jsQR === 'undefined') {
            console.warn('jsQR library not loaded');
            return [];
        }

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
            return [code.data];
        }

        return [];
    }
}
