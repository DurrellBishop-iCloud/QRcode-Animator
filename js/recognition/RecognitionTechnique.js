/**
 * RecognitionTechnique - Base class/interface for recognizers
 * Port of Swift RecognitionTechnique protocol
 */
export class RecognitionTechnique {
    constructor() {
        this.isCurrentlyDetecting = false;

        // Callbacks
        this._onDetectTarget = null;
        this._onLoseTarget = null;
        this._onDetectData = null;
    }

    /**
     * Process a video frame for recognition
     * @param {ImageData} imageData - Frame to process
     */
    processFrame(imageData) {
        throw new Error('processFrame must be implemented by subclass');
    }

    /**
     * Reset recognition state
     */
    reset() {
        this.isCurrentlyDetecting = false;
    }

    /**
     * Set callback for target detection
     * @param {Function} callback
     */
    onDetectTarget(callback) {
        this._onDetectTarget = callback;
    }

    /**
     * Set callback for target loss
     * @param {Function} callback
     */
    onLoseTarget(callback) {
        this._onLoseTarget = callback;
    }

    /**
     * Set callback for data detection
     * @param {Function} callback - Receives detected data string
     */
    onDetectData(callback) {
        this._onDetectData = callback;
    }

    /**
     * Trigger target detected callback
     */
    triggerDetectTarget() {
        if (this._onDetectTarget) {
            this._onDetectTarget();
        }
    }

    /**
     * Trigger target lost callback
     */
    triggerLoseTarget() {
        if (this._onLoseTarget) {
            this._onLoseTarget();
        }
    }

    /**
     * Trigger data detected callback
     * @param {string} data - Detected data
     */
    triggerDetectData(data) {
        if (this._onDetectData) {
            this._onDetectData(data);
        }
    }
}
