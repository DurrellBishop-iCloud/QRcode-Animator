/**
 * EventBus - Central pub/sub event system
 * Replaces Swift's Combine and NotificationCenter patterns
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => {
            const eventListeners = this.listeners.get(event);
            if (eventListeners) {
                eventListeners.delete(callback);
                if (eventListeners.size === 0) {
                    this.listeners.delete(event);
                }
            }
        };
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     */
    once(event, callback) {
        const unsubscribe = this.subscribe(event, (data) => {
            unsubscribe();
            callback(data);
        });
    }

    /**
     * Publish an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    publish(event, data) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// Event names constants
export const Events = {
    // Frame events
    FRAME_CAPTURED: 'frame:captured',
    FRAME_DELETED: 'frame:deleted',
    FRAME_NAVIGATED: 'frame:navigated',

    // Mode events
    MODE_CHANGED: 'mode:changed',

    // Recognition events
    RECOGNITION_DETECTED: 'recognition:detected',
    RECOGNITION_LOST: 'recognition:lost',
    RECOGNITION_DATA: 'recognition:data',

    // Playback events
    PLAYBACK_STARTED: 'playback:started',
    PLAYBACK_STOPPED: 'playback:stopped',
    PLAYBACK_FRAME: 'playback:frame',

    // Command events (from QR codes)
    COMMAND_PLAY: 'command:play',
    COMMAND_SAVE: 'command:save',
    COMMAND_SHARE: 'command:share',
    COMMAND_BACK: 'command:back',
    COMMAND_FORWARD: 'command:forward',
    COMMAND_DELETE: 'command:delete',
    COMMAND_KALEIDOSCOPE: 'command:kaleidoscope',
    COMMAND_LONG_CAPTURE: 'command:longCapture',
    COMMAND_BACKGROUND: 'command:background',
    COMMAND_CAPTURE: 'command:capture',

    // Export events
    EXPORT_STARTED: 'export:started',
    EXPORT_COMPLETE: 'export:complete',
    EXPORT_ERROR: 'export:error',

    // Upload events
    UPLOAD_STARTED: 'upload:started',
    UPLOAD_COMPLETE: 'upload:complete',
    UPLOAD_ERROR: 'upload:error',

    // Settings events
    SETTINGS_CHANGED: 'settings:changed',

    // UI events
    FLASH_TRIGGER: 'ui:flash',
    DISPLAY_TEXT: 'ui:displayText'
};

// Singleton instance
export const eventBus = new EventBus();
