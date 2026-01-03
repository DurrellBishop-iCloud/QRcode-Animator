/**
 * PlaybackManager - Handles frame playback animation
 * Direct port of Swift PlaybackManager
 */
import { eventBus, Events } from '../core/EventBus.js';
import { settings } from './SettingsManager.js';

export class PlaybackManager {
    constructor() {
        this.frames = [];
        this.currentFrameIndex = 0;
        this.currentFrame = null;
        this.isPlaying = false;
        this.timer = null;

        // Subscribe to frame rate changes for real-time updates
        settings.subscribe('frameRate', () => {
            if (this.isPlaying) {
                this.restartTimer();
            }
        });
    }

    /**
     * Restart timer with current frame rate
     */
    restartTimer() {
        if (this.timer) {
            clearInterval(this.timer);
        }

        const interval = 1000 / settings.frameRate;
        this.timer = setInterval(() => {
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
            this.currentFrame = this.frames[this.currentFrameIndex];

            eventBus.publish(Events.PLAYBACK_FRAME, {
                index: this.currentFrameIndex,
                total: this.frames.length,
                frame: this.currentFrame
            });
        }, interval);

        console.log(`Playback restarted at ${settings.frameRate} fps`);
    }

    /**
     * Set frames for playback
     * @param {ImageData[]} frames - Array of frames
     * @param {number} startIndex - Starting frame index
     */
    setFrames(frames, startIndex = 0) {
        this.frames = frames;
        this.currentFrameIndex = Math.min(startIndex, frames.length - 1);

        if (this.frames.length > 0) {
            this.currentFrame = this.frames[this.currentFrameIndex];
        }
    }

    /**
     * Start playback loop
     */
    startPlayback() {
        if (this.frames.length === 0) {
            console.warn('No frames to play');
            return;
        }

        this.isPlaying = true;
        const interval = 1000 / settings.frameRate;

        eventBus.publish(Events.PLAYBACK_STARTED, {
            frameCount: this.frames.length,
            frameRate: settings.frameRate
        });

        this.timer = setInterval(() => {
            // Advance to next frame (loop)
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
            this.currentFrame = this.frames[this.currentFrameIndex];

            eventBus.publish(Events.PLAYBACK_FRAME, {
                index: this.currentFrameIndex,
                total: this.frames.length,
                frame: this.currentFrame
            });
        }, interval);

        console.log(`Playback started at ${settings.frameRate} fps`);
    }

    /**
     * Stop playback
     */
    stopPlayback() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isPlaying = false;

        eventBus.publish(Events.PLAYBACK_STOPPED, {});

        console.log('Playback stopped');
    }

    /**
     * Show specific frame (for scrubbing)
     * @param {number} index - Frame index
     */
    showFrame(index) {
        if (index < 0 || index >= this.frames.length) {
            return;
        }

        this.currentFrameIndex = index;
        this.currentFrame = this.frames[index];

        eventBus.publish(Events.PLAYBACK_FRAME, {
            index: this.currentFrameIndex,
            total: this.frames.length,
            frame: this.currentFrame
        });
    }

    /**
     * Reset playback to beginning
     */
    reset() {
        this.stopPlayback();
        this.currentFrameIndex = 0;

        if (this.frames.length > 0) {
            this.currentFrame = this.frames[0];
        }
    }

    /**
     * Get current frame
     * @returns {ImageData|null} Current frame
     */
    getCurrentFrame() {
        return this.currentFrame;
    }

    /**
     * Get frame count
     * @returns {number} Number of frames
     */
    get frameCount() {
        return this.frames.length;
    }
}
