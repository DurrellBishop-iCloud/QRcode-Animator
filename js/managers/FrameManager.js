/**
 * FrameManager - Manages captured frames array and navigation
 * Port of Swift CameraManager (frame storage) + CameraManager+Navigation
 * v55: Added IndexedDB persistence for frames (survive page reload / recharge)
 */
import { eventBus, Events } from '../core/EventBus.js';

const MAX_FRAMES = 300; // Memory limit
const DB_NAME = 'stopMotionFrames';
const DB_VERSION = 1;
const STORE_NAME = 'frames';

export class FrameManager {
    constructor() {
        this.frames = [];
        this.currentFrameIndex = 0;
        this.isViewingLiveFeed = true;
        this.backgroundImage = null;
        this.db = null;
        this._saveTimer = null;
    }

    /**
     * Open IndexedDB connection
     * @returns {Promise<IDBDatabase>}
     */
    async openDB() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Save all frames to IndexedDB
     * Debounced to avoid hammering the DB on rapid captures
     */
    scheduleSave() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
        }
        this._saveTimer = setTimeout(() => {
            this.saveToDB();
        }, 500);
    }

    /**
     * Save frames to IndexedDB
     */
    async saveToDB() {
        try {
            const db = await this.openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            // Convert ImageData to serializable format
            const serialized = this.frames.map(frame => ({
                width: frame.width,
                height: frame.height,
                data: Array.from(frame.data)
            }));

            store.put(serialized, 'currentFrames');
            store.put(this.currentFrameIndex, 'currentIndex');

            await new Promise((resolve, reject) => {
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });

            console.log(`Saved ${this.frames.length} frames to IndexedDB`);
        } catch (error) {
            console.error('Failed to save frames to IndexedDB:', error);
        }
    }

    /**
     * Load frames from IndexedDB
     * @returns {Promise<boolean>} True if frames were restored
     */
    async loadFromDB() {
        try {
            const db = await this.openDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);

            const framesRequest = store.get('currentFrames');
            const indexRequest = store.get('currentIndex');

            return new Promise((resolve) => {
                tx.oncomplete = () => {
                    const serialized = framesRequest.result;
                    const savedIndex = indexRequest.result;

                    if (!serialized || serialized.length === 0) {
                        resolve(false);
                        return;
                    }

                    // Restore ImageData objects
                    this.frames = serialized.map(frame => {
                        return new ImageData(
                            new Uint8ClampedArray(frame.data),
                            frame.width,
                            frame.height
                        );
                    });

                    this.currentFrameIndex = Math.min(
                        savedIndex || this.frames.length - 1,
                        this.frames.length - 1
                    );
                    this.isViewingLiveFeed = true;

                    console.log(`Restored ${this.frames.length} frames from IndexedDB`);
                    resolve(true);
                };

                tx.onerror = () => {
                    console.error('Failed to load frames:', tx.error);
                    resolve(false);
                };
            });
        } catch (error) {
            console.error('Failed to load frames from IndexedDB:', error);
            return false;
        }
    }

    /**
     * Clear saved frames from IndexedDB
     */
    async clearDB() {
        try {
            const db = await this.openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete('currentFrames');
            store.delete('currentIndex');
            await new Promise((resolve, reject) => {
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
            console.log('Cleared frames from IndexedDB');
        } catch (error) {
            console.error('Failed to clear IndexedDB:', error);
        }
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

        this.scheduleSave();
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

        this.scheduleSave();
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

        this.scheduleSave();
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
     * Clear all frames and reset (memory only, does not clear DB)
     */
    clear() {
        this.frames = [];
        this.currentFrameIndex = 0;
        this.isViewingLiveFeed = true;
        this.backgroundImage = null;
    }

    /**
     * Clear all frames, reset, and clear DB
     */
    async clearAll() {
        this.clear();
        await this.clearDB();
    }

    /**
     * Get frame count
     * @returns {number} Number of frames
     */
    get count() {
        return this.frames.length;
    }
}
