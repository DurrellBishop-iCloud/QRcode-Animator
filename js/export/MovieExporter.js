/**
 * MovieExporter - Export frames as video using MediaRecorder
 * Port of Swift MovieExporter
 */
import { eventBus, Events } from '../core/EventBus.js';
import { settings } from '../managers/SettingsManager.js';

export class MovieExporter {
    constructor() {
        this.isExporting = false;
    }

    /**
     * Export frames to video blob
     * @param {ImageData[]} frames - Array of frames
     * @param {Object} options - Export options
     * @returns {Promise<Blob>} Video blob
     */
    async exportToBlob(frames, options = {}) {
        if (this.isExporting) {
            throw new Error('Export already in progress');
        }

        if (!frames || frames.length === 0) {
            throw new Error('No frames to export');
        }

        const {
            frameRate = settings.frameRate,
            cropTop = settings.frameTopThickness,
            cropBottom = settings.frameBottomThickness,
            screenSize = { width: window.innerWidth, height: window.innerHeight },
            reverse = settings.reverseMovie
        } = options;

        this.isExporting = true;
        eventBus.publish(Events.EXPORT_STARTED, { frameCount: frames.length });

        try {
            // Calculate crop values (port of Swift crop calculation)
            const crop = this.calculateCrop(
                { width: frames[0].width, height: frames[0].height },
                screenSize,
                cropTop,
                cropBottom
            );

            // Create canvas for video
            const canvas = document.createElement('canvas');
            canvas.width = frames[0].width;
            canvas.height = frames[0].height - crop.top - crop.bottom;
            const ctx = canvas.getContext('2d');

            // Setup MediaRecorder
            const stream = canvas.captureStream(frameRate);
            const mimeType = this.getSupportedMimeType();
            const recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 10000000 // 10 Mbps
            });

            const chunks = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            // Reverse frames if needed
            const framesToRender = reverse ? [...frames].reverse() : frames;

            return new Promise((resolve, reject) => {
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    this.isExporting = false;
                    eventBus.publish(Events.EXPORT_COMPLETE, { blob, size: blob.size });
                    resolve(blob);
                };

                recorder.onerror = (e) => {
                    this.isExporting = false;
                    eventBus.publish(Events.EXPORT_ERROR, { error: e.error });
                    reject(e.error);
                };

                recorder.start();

                // Draw frames at the correct rate
                let frameIndex = 0;
                const frameDuration = 1000 / frameRate;

                const drawNextFrame = () => {
                    if (frameIndex >= framesToRender.length) {
                        // Wait a bit to ensure last frame is captured
                        setTimeout(() => recorder.stop(), frameDuration);
                        return;
                    }

                    const frame = framesToRender[frameIndex];
                    this.drawCroppedFrame(ctx, frame, crop, canvas.width, canvas.height);

                    frameIndex++;
                    setTimeout(drawNextFrame, frameDuration);
                };

                drawNextFrame();
            });

        } catch (error) {
            this.isExporting = false;
            eventBus.publish(Events.EXPORT_ERROR, { error });
            throw error;
        }
    }

    /**
     * Draw cropped frame to canvas (rotated 180 degrees for upside-down phone)
     * @param {CanvasRenderingContext2D} ctx
     * @param {ImageData} frame
     * @param {Object} crop
     * @param {number} destWidth
     * @param {number} destHeight
     */
    drawCroppedFrame(ctx, frame, crop, destWidth, destHeight) {
        // Create temp canvas for source frame
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = frame.width;
        tempCanvas.height = frame.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(frame, 0, 0);

        // Save context state
        ctx.save();

        // Rotate 180 degrees around center
        ctx.translate(destWidth / 2, destHeight / 2);
        ctx.rotate(Math.PI);
        ctx.translate(-destWidth / 2, -destHeight / 2);

        // Draw cropped region (rotated)
        ctx.drawImage(
            tempCanvas,
            0, crop.top,                              // Source x, y
            frame.width, frame.height - crop.top - crop.bottom, // Source w, h
            0, 0,                                     // Dest x, y
            destWidth, destHeight                     // Dest w, h
        );

        // Restore context state
        ctx.restore();
    }

    /**
     * Calculate crop values (port of Swift MovieExporter logic)
     * @param {Object} frameSize - {width, height}
     * @param {Object} screenSize - {width, height}
     * @param {number} cropTop - Top crop in screen pixels
     * @param {number} cropBottom - Bottom crop in screen pixels
     * @returns {{top: number, bottom: number}} Crop in frame pixels
     */
    calculateCrop(frameSize, screenSize, cropTop, cropBottom) {
        const photoWidth = frameSize.width;
        const photoHeight = frameSize.height;
        const cameraAspectRatio = photoWidth / photoHeight;
        const screenAspectRatio = screenSize.width / screenSize.height;

        // Calculate displayed camera size with resizeAspect
        let displayedHeight;
        if (cameraAspectRatio > screenAspectRatio) {
            // Camera wider than screen - fit to width
            displayedHeight = screenSize.width / cameraAspectRatio;
        } else {
            // Camera taller - fit to height
            displayedHeight = screenSize.height;
        }

        // Camera is centered vertically
        const cameraOffsetY = (screenSize.height - displayedHeight) / 2;

        // Effective crop (accounting for letterbox offset)
        const effectiveCropTop = Math.max(0, cropTop - cameraOffsetY);
        const effectiveCropBottom = Math.max(0, cropBottom - cameraOffsetY);

        // Scale from displayed size to actual photo size
        const displayToPhotoScale = photoHeight / displayedHeight;

        return {
            top: effectiveCropTop * displayToPhotoScale,
            bottom: effectiveCropBottom * displayToPhotoScale
        };
    }

    /**
     * Get supported MIME type for video recording
     * @returns {string} MIME type
     */
    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return 'video/webm'; // Fallback
    }

    /**
     * Save blob - uses Share API on iOS (save to Photos), download on desktop
     * @param {Blob} blob - Video blob
     * @param {string} filename - Filename
     */
    async saveToFile(blob, filename = 'animation.webm') {
        // Try Web Share API first (works great on iOS - shows "Save Video" option)
        if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] })) {
            try {
                const file = new File([blob], filename, { type: blob.type });
                await navigator.share({
                    files: [file],
                    title: 'Animation'
                });
                return; // Success
            } catch (e) {
                // User cancelled or share failed - fall through to download
                if (e.name === 'AbortError') {
                    return; // User cancelled, don't try download
                }
                console.log('Share failed, trying download:', e);
            }
        }

        // Fallback to download (desktop browsers)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
