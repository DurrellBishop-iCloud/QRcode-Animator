/**
 * FrameManager - Manages captured frames array and navigation
 * Port of Swift CameraManager (frame storage) + CameraManager+Navigation
 */
import { eventBus, Events } from '../core/EventBus.js';

const MAX_FRAMES = 300; // Memory limit

export class FrameManager {
    constructor() {
        this.frames = [];
        this.currentFrameIndex = 0;
        this.isViewingLiveFeed = true;
        this.backgroundImage = null;
    }

    /**
     * Add a captured frame
     * @param {ImageData} imageData - Frame to add
     * @returns {boolean} Success status
     */
    addFrame(imageData) {
        if (this.frames.length >= MAX_FRAMES) {
            console.warn('Frame limit reached');
            return false;
        }

        this.frames.push(imageData);
        this.currentFrameIndex = this.frames.length - 1;
        this.isViewingLiveFeed = true; // Return to live feed after capture

        eventBus.publish(Events.FRAME_CAPTURED, {
            index: this.currentFrameIndex,
            total: this.frames.length
        });

        console.log(`Frame captured. Total: ${this.frames.length}`);
        return true;
    }

    /**
     * Add long capture (4 copies of same frame)
     * @param {ImageData} imageData - Frame to duplicate
     */
    addLongCapture(imageData) {
        for (let i = 0; i < 4; i++) {
            // Clone the ImageData for each frame
            const clone = new ImageData(
                new Uint8ClampedArray(imageData.data),
                imageData.width,
                imageData.height
            );
            this.frames.push(clone);
        }

        this.currentFrameIndex = this.frames.length - 1;
        this.isViewingLiveFeed = true;

        eventBus.publish(Events.FRAME_CAPTURED, {
            index: this.currentFrameIndex,
            total: this.frames.length,
            longCapture: true
        });

        console.log(`Long capture: added 4 frames. Total: ${this.frames.length}`);
    }

    /**
     * Delete frame at index
     * @param {number} index - Frame index to delete
     */
    deleteFrame(index = this.currentFrameIndex) {
        if (index < 0 || index >= this.frames.length) {
            return;
        }

        this.frames.splice(index, 1);

        // Adjust current index if needed
        if (this.frames.length === 0) {
            this.currentFrameIndex = 0;
            this.isViewingLiveFeed = true;
        } else if (this.currentFrameIndex >= this.frames.length) {
            this.currentFrameIndex = this.frames.length - 1;
        }

        eventBus.publish(Events.FRAME_DELETED, {
            index,
            total: this.frames.length
        });

        console.log(`Frame deleted. Total: ${this.frames.length}`);
    }

    /**
     * Delete current frame (when viewing static frame)
     */
    deleteCurrentFrame() {
        if (!this.isViewingLiveFeed && this.frames.length > 0) {
            this.deleteFrame(this.currentFrameIndex);
        }
    }

    /**
     * Get frame at index
     * @param {number} index - Frame index
     * @returns {ImageData|null} Frame data
     */
    getFrame(index) {
        if (index < 0 || index >= this.frames.length) {
            return null;
        }
        return this.frames[index];
    }

    /**
     * Get current frame
     * @returns {ImageData|null} Current frame
     */
    getCurrentFrame() {
        return this.getFrame(this.currentFrameIndex);
    }

    /**
     * Get last captured frame (for onion skin)
     * @returns {ImageData|null} Last frame
     */
    getLastFrame() {
        if (this.frames.length === 0) {
            return null;
        }
        return this.frames[this.frames.length - 1];
    }

    /**
     * Get all frames
     * @returns {ImageData[]} All frames
     */
    getAllFrames() {
        return this.frames;
    }

    /**
     * Navigate to previous frame
     * Port of Swift moveBack()
     */
    moveBack() {
        if (this.frames.length === 0) return;

        if (this.isViewingLiveFeed) {
            // From live feed, go to last frame
            this.isViewingLiveFeed = false;
            this.currentFrameIndex = this.frames.length - 1;
        } else if (this.currentFrameIndex > 0) {
            // Go to previous frame
            this.currentFrameIndex--;
        } else {
            // At first frame, wrap to last
            this.currentFrameIndex = this.frames.length - 1;
        }

        eventBus.publish(Events.FRAME_NAVIGATED, {
            index: this.currentFrameIndex,
            total: this.frames.length,
            isLiveFeed: this.isViewingLiveFeed
        });
    }

    /**
     * Navigate to next frame
     * Port of Swift moveForward()
     */
    moveForward() {
        if (this.frames.length === 0) return;

        if (this.isViewingLiveFeed) {
            // Already at live feed, stay there
            return;
        }

        if (this.currentFrameIndex < this.frames.length - 1) {
            // Go to next frame
            this.currentFrameIndex++;
        } else {
            // At last frame, return to live feed
            this.isViewingLiveFeed = true;
        }

        eventBus.publish(Events.FRAME_NAVIGATED, {
            index: this.currentFrameIndex,
            total: this.frames.length,
            isLiveFeed: this.isViewingLiveFeed
        });
    }

    /**
     * Reset to last frame (for entering Play mode)
     * Port of Swift resetToLastFrame()
     */
    resetToLastFrame() {
        if (this.frames.length > 0) {
            this.currentFrameIndex = this.frames.length - 1;
            this.isViewingLiveFeed = false;
        }
    }

    /**
     * Return to live feed
     * Port of Swift returnToLiveFeed()
     */
    returnToLiveFeed() {
        this.isViewingLiveFeed = true;
        if (this.frames.length > 0) {
            this.currentFrameIndex = this.frames.length - 1;
        }
    }

    /**
     * Set background image for chroma key
     * @param {ImageData} imageData - Background frame
     */
    setBackground(imageData) {
        this.backgroundImage = imageData;
        console.log('Background image set');
    }

    /**
     * Get background image
     * @returns {ImageData|null} Background image
     */
    getBackground() {
        return this.backgroundImage;
    }

    /**
     * Clear all frames and reset
     */
    clear() {
        this.frames = [];
        this.currentFrameIndex = 0;
        this.isViewingLiveFeed = true;
        this.backgroundImage = null;
    }

    /**
     * Get frame count
     * @returns {number} Number of frames
     */
    get count() {
        return this.frames.length;
    }
}
