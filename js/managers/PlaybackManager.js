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
        this.playDirection = 1; // 1 = forward, -1 = backward

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
            this.advanceFrame();
        }, interval);

        console.log(`Playback restarted at ${settings.frameRate} fps`);
    }

    /**
     * Advance to next frame, handling bounce and reverse modes
     */
    advanceFrame() {
        const bounce = settings.bounceEnabled;
        const lastIndex = this.frames.length - 1;

        // Calculate next index
        let nextIndex = this.currentFrameIndex + this.playDirection;

        if (bounce) {
            // Bounce mode: reverse direction at ends
            if (nextIndex > lastIndex) {
                this.playDirection = -1;
                nextIndex = lastIndex - 1;
            } else if (nextIndex < 0) {
                this.playDirection = 1;
                nextIndex = 1;
            }
            // Handle single frame case
            if (this.frames.length <= 1) {
                nextIndex = 0;
            }
        } else {
            // Non-bounce: wrap around
            nextIndex = (nextIndex + this.frames.length) % this.frames.length;
        }

        this.currentFrameIndex = nextIndex;
        this.currentFrame = this.frames[this.currentFrameIndex];

        eventBus.publish(Events.PLAYBACK_FRAME, {
            index: this.currentFrameIndex,
            total: this.frames.length,
            frame: this.currentFrame
        });
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

        // Set initial direction based on reverse setting
        // If reverse is on, start playing backward (-1), otherwise forward (1)
        this.playDirection = settings.reverseMovie ? -1 : 1;

        // Set starting frame based on direction
        if (this.playDirection === -1) {
            this.currentFrameIndex = this.frames.length - 1;
        } else {
            this.currentFrameIndex = 0;
        }
        this.currentFrame = this.frames[this.currentFrameIndex];

        eventBus.publish(Events.PLAYBACK_STARTED, {
            frameCount: this.frames.length,
            frameRate: settings.frameRate
        });

        // Show first frame immediately
        eventBus.publish(Events.PLAYBACK_FRAME, {
            index: this.currentFrameIndex,
            total: this.frames.length,
            frame: this.currentFrame
        });

        this.timer = setInterval(() => {
            this.advanceFrame();
        }, interval);

        console.log(`Playback started at ${settings.frameRate} fps, direction: ${this.playDirection === 1 ? 'forward' : 'backward'}, bounce: ${settings.bounceEnabled}`);
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
