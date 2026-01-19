/**
 * BarcodeRecognizer - Barcode detection using BarcodeDetector or QuaggaJS fallback
 */
import { RecognitionTechnique } from './RecognitionTechnique.js';

export class BarcodeRecognizer extends RecognitionTechnique {
    constructor() {
        super();

        this.useNative = 'BarcodeDetector' in window;
        this.quaggaReady = false;

        if (this.useNative) {
            this.detector = new BarcodeDetector({
                formats: ['code_39', 'code_128', 'ean_8', 'ean_13', 'upc_e', 'upc_a']
            });
            console.log('Using native BarcodeDetector');
            setTimeout(() => {
                const debugEl = document.getElementById('barcode-debug');
                if (debugEl) debugEl.textContent = 'Barcode ready (native)';
            }, 1000);
        } else if (typeof Quagga !== 'undefined') {
            console.log('Using QuaggaJS fallback for barcodes');
            this.quaggaReady = true;
            setTimeout(() => {
                const debugEl = document.getElementById('barcode-debug');
                if (debugEl) debugEl.textContent = 'Barcode ready (QuaggaJS)';
            }, 1000);
        } else {
            console.warn('No barcode detection available');
            setTimeout(() => {
                const debugEl = document.getElementById('barcode-debug');
                if (debugEl) debugEl.textContent = 'No barcode support';
            }, 1000);
        }

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    async processFrame(imageData) {
        let results = [];
        const debugEl = document.getElementById('barcode-debug');

        try {
            if (this.useNative) {
                results = await this.detectNative(imageData);
            } else if (this.quaggaReady) {
                results = await this.detectQuagga(imageData);
            }

            if (debugEl) {
                if (results.length > 0) {
                    debugEl.textContent = 'Barcode: "' + results[0] + '"';
                } else {
                    debugEl.textContent = 'Scanning...';
                }
            }
        } catch (error) {
            console.error('Barcode detection error:', error);
            if (debugEl) debugEl.textContent = 'Error: ' + error.message;
        }

        if (results.length > 0) {
            this.triggerDetectData(results[0]);
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

    async detectNative(imageData) {
        this.canvas.width = imageData.width;
        this.canvas.height = imageData.height;
        this.ctx.putImageData(imageData, 0, 0);
        const imageBitmap = await createImageBitmap(this.canvas);
        const barcodes = await this.detector.detect(imageBitmap);
        return barcodes.map(b => b.rawValue);
    }

    async detectQuagga(imageData) {
        return new Promise((resolve) => {
            this.canvas.width = imageData.width;
            this.canvas.height = imageData.height;
            this.ctx.putImageData(imageData, 0, 0);

            Quagga.decodeSingle({
                src: this.canvas.toDataURL('image/png'),
                numOfWorkers: 0,
                locate: true,
                decoder: {
                    readers: ['code_39_reader', 'code_128_reader', 'ean_reader', 'upc_reader']
                }
            }, (result) => {
                if (result && result.codeResult) {
                    resolve([result.codeResult.code]);
                } else {
                    resolve([]);
                }
            });
        });
    }
}
