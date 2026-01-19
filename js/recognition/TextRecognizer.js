/**
 * TextRecognizer - OCR-based text recognition using Tesseract.js
 * Experimental alternative to QR code recognition
 */
import { RecognitionTechnique } from './RecognitionTechnique.js';

export class TextRecognizer extends RecognitionTechnique {
    constructor() {
        super();

        this.worker = null;
        this.isProcessing = false;
        this.isReady = false;
        this.lastResult = null;
        this.lastResultTime = 0;
        this.confidenceThreshold = 70; // Only accept high confidence results
        this.resultCooldown = 500; // ms between accepting same result

        // Canvas for image processing
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        // ROI parameters (center portion of frame)
        this.roiWidthPercent = 0.5;  // Use center 50% width
        this.roiHeightPercent = 0.3; // Use center 30% height

        // Initialize the Tesseract worker
        this.initWorker();
    }

    /**
     * Initialize Tesseract worker with optimized settings
     */
    async initWorker() {
        try {
            console.log('Initializing Tesseract worker...');

            // Check if Tesseract is available
            if (typeof Tesseract === 'undefined') {
                console.error('Tesseract.js library not loaded');
                return;
            }

            // Create worker (runs in background thread)
            this.worker = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        // Optionally log progress
                    }
                }
            });

            // Optimize for single words/short text
            await this.worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                tessedit_pageseg_mode: '7', // Treat image as single text line
            });

            this.isReady = true;
            console.log('Tesseract worker ready');
        } catch (error) {
            console.error('Failed to initialize Tesseract worker:', error);
        }
    }

    /**
     * Process a video frame for text recognition
     * @param {ImageData} imageData - Frame to process
     */
    async processFrame(imageData) {
        // Skip if not ready, already processing, or no worker
        if (!this.isReady || this.isProcessing || !this.worker) {
            return;
        }

        this.isProcessing = true;

        try {
            // 1. Extract ROI (center portion of frame)
            const roiCanvas = this.extractROI(imageData);

            // 2. Preprocess image (grayscale + threshold for clean text)
            const processedCanvas = this.preprocess(roiCanvas);

            // 3. Run OCR
            const { data } = await this.worker.recognize(processedCanvas);

            // 4. Process results with confidence gating
            this.handleOCRResult(data);

        } catch (error) {
            console.error('OCR error:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Extract region of interest (center portion of frame)
     * @param {ImageData} imageData - Full frame
     * @returns {HTMLCanvasElement} Canvas with cropped ROI
     */
    extractROI(imageData) {
        const { width, height } = imageData;

        // Calculate ROI dimensions
        const roiWidth = Math.floor(width * this.roiWidthPercent);
        const roiHeight = Math.floor(height * this.roiHeightPercent);
        const startX = Math.floor((width - roiWidth) / 2);
        const startY = Math.floor((height - roiHeight) / 2);

        // Create canvas for ROI
        const roiCanvas = document.createElement('canvas');
        roiCanvas.width = roiWidth;
        roiCanvas.height = roiHeight;
        const roiCtx = roiCanvas.getContext('2d');

        // Draw source ImageData to temp canvas first
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.putImageData(imageData, 0, 0);

        // Extract ROI
        roiCtx.drawImage(
            this.canvas,
            startX, startY, roiWidth, roiHeight,
            0, 0, roiWidth, roiHeight
        );

        return roiCanvas;
    }

    /**
     * Preprocess image for better OCR results
     * Converts to grayscale and applies threshold for clean black/white text
     * @param {HTMLCanvasElement} sourceCanvas - Source image
     * @returns {HTMLCanvasElement} Processed image
     */
    preprocess(sourceCanvas) {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        // Create output canvas
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = width;
        outputCanvas.height = height;
        const outputCtx = outputCanvas.getContext('2d');

        // Get source pixels
        const sourceCtx = sourceCanvas.getContext('2d');
        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Convert to grayscale and apply threshold
        const threshold = 128;

        for (let i = 0; i < data.length; i += 4) {
            // Grayscale using luminosity method
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

            // Apply threshold (binary image)
            const value = gray > threshold ? 255 : 0;

            data[i] = value;     // R
            data[i + 1] = value; // G
            data[i + 2] = value; // B
            // Alpha stays the same
        }

        outputCtx.putImageData(imageData, 0, 0);
        return outputCanvas;
    }

    /**
     * Handle OCR result with confidence gating and deduplication
     * @param {Object} data - Tesseract result data
     */
    handleOCRResult(data) {
        // Check confidence threshold
        if (data.confidence < this.confidenceThreshold) {
            // Low confidence - treat as no detection
            if (this.isCurrentlyDetecting) {
                this.isCurrentlyDetecting = false;
                this.triggerLoseTarget();
            }
            return;
        }

        // Clean up recognized text
        const text = data.text.trim().toLowerCase();

        // Skip empty or very short results
        if (!text || text.length < 2) {
            if (this.isCurrentlyDetecting) {
                this.isCurrentlyDetecting = false;
                this.triggerLoseTarget();
            }
            return;
        }

        const now = Date.now();

        // Check if this is a new result (different from last or cooldown passed)
        const isNewResult = text !== this.lastResult ||
                           (now - this.lastResultTime) > this.resultCooldown;

        if (isNewResult) {
            this.lastResult = text;
            this.lastResultTime = now;

            // Trigger detection callbacks
            this.triggerDetectData(text);

            if (!this.isCurrentlyDetecting) {
                this.isCurrentlyDetecting = true;
                this.triggerDetectTarget();
            }

            console.log('OCR detected: "' + text + '" (confidence: ' + data.confidence.toFixed(1) + '%)');
        }
    }

    /**
     * Reset recognizer state
     */
    reset() {
        super.reset();
        this.lastResult = null;
        this.lastResultTime = 0;
        this.isProcessing = false;
    }

    /**
     * Cleanup worker when done
     */
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isReady = false;
        }
    }
}
