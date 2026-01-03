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

        // Zoomed capture canvas (stores cropped/zoomed frames)
        this.zoomedCanvas = document.createElement('canvas');
        this.zoomedCtx = this.zoomedCanvas.getContext('2d', { willReadFrequently: true });

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

        // Subscribe to zoom changes so display updates in real-time
        settings.subscribe('zoomFactor', (value) => {
            this.applyZoom(value);
        });

        // Subscribe to image adjustment changes for live preview
        this.applyImageFilters();
        settings.subscribe('brightness', () => this.applyImageFilters());
        settings.subscribe('contrast', () => this.applyImageFilters());
        settings.subscribe('saturation', () => this.applyImageFilters());
    }

    /**
     * Apply CSS filters to video element for real-time preview
     */
    applyImageFilters() {
        const brightness = settings.brightness;
        const contrast = settings.contrast;
        const saturation = settings.saturation;

        this.video.style.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
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
     * Capture current video frame as ImageData (with zoom applied)
     * Zoom works by cropping a centered region from the full frame,
     * simulating the camera hardware zoom in the Swift app.
     * @returns {ImageData|null} Captured frame (zoomed)
     */
    captureFrame() {
        if (!this.isRunning || this.videoWidth === 0) {
            return null;
        }

        const zoomFactor = Math.max(1, settings.zoomFactor);

        // Draw full video to capture canvas (flip horizontally to match mirror view)
        this.captureCtx.save();
        this.captureCtx.translate(this.videoWidth, 0);
        this.captureCtx.scale(-1, 1);
        this.captureCtx.drawImage(this.video, 0, 0, this.videoWidth, this.videoHeight);
        this.captureCtx.restore();

        // If zoom is 1, return the full frame
        if (zoomFactor <= 1) {
            return this.captureCtx.getImageData(0, 0, this.videoWidth, this.videoHeight);
        }

        // Apply zoom by cropping a centered region
        // Zoom 1.3 means we see 1/1.3 = 76.9% of the original image
        const cropWidth = this.videoWidth / zoomFactor;
        const cropHeight = this.videoHeight / zoomFactor;
        const cropX = (this.videoWidth - cropWidth) / 2;
        const cropY = (this.videoHeight - cropHeight) / 2;

        // Set zoomed canvas to match video dimensions (zoomed frame fills same size)
        this.zoomedCanvas.width = this.videoWidth;
        this.zoomedCanvas.height = this.videoHeight;

        // Draw the cropped center region scaled up to fill the canvas
        this.zoomedCtx.drawImage(
            this.captureCanvas,
            cropX, cropY, cropWidth, cropHeight,  // Source: cropped center
            0, 0, this.videoWidth, this.videoHeight  // Dest: full canvas
        );

        return this.zoomedCtx.getImageData(0, 0, this.videoWidth, this.videoHeight);
    }

    /**
     * Capture frame as canvas (for filter processing, with zoom applied)
     * @returns {HTMLCanvasElement|null} Canvas with frame
     */
    captureFrameAsCanvas() {
        if (!this.isRunning || this.videoWidth === 0) {
            return null;
        }

        const zoomFactor = Math.max(1, settings.zoomFactor);
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

        // If no zoom, return as-is
        if (zoomFactor <= 1) {
            return canvas;
        }

        // Apply zoom by cropping center and scaling up
        const cropWidth = this.videoWidth / zoomFactor;
        const cropHeight = this.videoHeight / zoomFactor;
        const cropX = (this.videoWidth - cropWidth) / 2;
        const cropY = (this.videoHeight - cropHeight) / 2;

        const zoomedCanvas = document.createElement('canvas');
        zoomedCanvas.width = this.videoWidth;
        zoomedCanvas.height = this.videoHeight;
        const zoomedCtx = zoomedCanvas.getContext('2d');

        zoomedCtx.drawImage(
            canvas,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, this.videoWidth, this.videoHeight
        );

        return zoomedCanvas;
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
