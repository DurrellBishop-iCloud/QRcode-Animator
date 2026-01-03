/**
 * CameraManager - Handles camera access and video stream
 * Port of Swift CameraManager (camera-related parts)
 */
import { eventBus, Events } from '../core/EventBus.js';
import { settings } from './SettingsManager.js';

export class CameraManager {
    constructor(videoElement, captureCanvas) {
        this.video = videoElement;
        this.captureCanvas = captureCanvas;
        this.captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });

        this.stream = null;
        this.isRunning = false;
        this.videoWidth = 0;
        this.videoHeight = 0;

        // Bind methods
        this.onVideoReady = this.onVideoReady.bind(this);
    }

    /**
     * Start camera session
     * @returns {Promise<boolean>} Success status
     */
    async startSession() {
        try {
            // Check if camera API is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera API not available. Make sure you are using http://localhost:8080 (not an IP address) and not in Private Browsing mode.');
            }

            // Request camera access (front camera for overhead use)
            const constraints = {
                video: {
                    facingMode: 'user', // Front camera
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play()
                        .then(resolve)
                        .catch(reject);
                };
                this.video.onerror = reject;
            });

            this.onVideoReady();
            this.isRunning = true;

            console.log('Camera started:', this.videoWidth, 'x', this.videoHeight);
            return true;

        } catch (error) {
            console.error('Failed to start camera:', error);

            // Show specific error to user
            let message = 'Could not access camera. ';
            if (error.name === 'NotAllowedError') {
                message += 'Permission denied. Check Safari → Settings → Websites → Camera.';
            } else if (error.name === 'NotFoundError') {
                message += 'No camera found on this device.';
            } else if (error.name === 'NotReadableError') {
                message += 'Camera is in use by another app. Close other apps using the camera.';
            } else if (error.name === 'OverconstrainedError') {
                message += 'Camera does not support requested settings.';
            } else {
                message += error.message || 'Unknown error.';
            }

            alert(message);
            return false;
        }
    }

    /**
     * Called when video is ready
     */
    onVideoReady() {
        this.videoWidth = this.video.videoWidth;
        this.videoHeight = this.video.videoHeight;

        // Set capture canvas to video dimensions
        this.captureCanvas.width = this.videoWidth;
        this.captureCanvas.height = this.videoHeight;

        // Apply initial zoom
        this.applyZoom(settings.zoomFactor);
    }

    /**
     * Stop camera session
     */
    stopSession() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.video.srcObject = null;
        this.isRunning = false;
    }

    /**
     * Apply zoom factor (CSS transform since web doesn't have native zoom)
     * @param {number} factor - Zoom factor (1.0 = no zoom)
     */
    applyZoom(factor) {
        const clampedZoom = Math.max(1, Math.min(factor, 3));
        this.video.style.transform = `translate(-50%, -50%) scaleX(-1) scale(${clampedZoom})`;
    }

    /**
     * Capture current video frame as ImageData
     * @returns {ImageData|null} Captured frame
     */
    captureFrame() {
        if (!this.isRunning || this.videoWidth === 0) {
            return null;
        }

        // Draw video to canvas (flip horizontally to match mirror view)
        this.captureCtx.save();
        this.captureCtx.translate(this.videoWidth, 0);
        this.captureCtx.scale(-1, 1);
        this.captureCtx.drawImage(this.video, 0, 0, this.videoWidth, this.videoHeight);
        this.captureCtx.restore();

        return this.captureCtx.getImageData(0, 0, this.videoWidth, this.videoHeight);
    }

    /**
     * Capture frame as canvas (for filter processing)
     * @returns {HTMLCanvasElement|null} Canvas with frame
     */
    captureFrameAsCanvas() {
        if (!this.isRunning || this.videoWidth === 0) {
            return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = this.videoWidth;
        canvas.height = this.videoHeight;
        const ctx = canvas.getContext('2d');

        // Draw video (flip horizontally)
        ctx.save();
        ctx.translate(this.videoWidth, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.video, 0, 0, this.videoWidth, this.videoHeight);
        ctx.restore();

        return canvas;
    }

    /**
     * Get video dimensions
     * @returns {{width: number, height: number}} Video dimensions
     */
    getDimensions() {
        return {
            width: this.videoWidth,
            height: this.videoHeight
        };
    }

    /**
     * Get video stream
     * @returns {MediaStream|null} Video stream
     */
    getStream() {
        return this.stream;
    }
}
