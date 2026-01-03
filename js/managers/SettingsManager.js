/**
 * SettingsManager - Manages all app settings with localStorage persistence
 * Direct port of Swift SettingsManager
 */
import { eventBus, Events } from '../core/EventBus.js';

const STORAGE_KEY = 'stopMotionSettings';

const DEFAULT_SETTINGS = {
    // Recognition
    recognitionType: 'qrCode', // 'qrCode' | 'barcode' | 'colorSample'
    captureDelay: 0.5, // seconds

    // Color targeting
    targetColor: { r: 1.0, g: 0.0, b: 0.0 }, // RGB 0-1

    // Frame overlay
    frameTopThickness: 80, // pixels
    frameBottomThickness: 80, // pixels

    // Playback
    frameRate: 12, // fps
    reverseMovie: false,

    // Camera (limited in web)
    zoomFactor: 1.3,

    // Effects
    kaleidoscopeEnabled: false,
    kaleidoscopeRotation: 0,

    // Onion skinning
    onionSkinEnabled: true,
    onionSkinOpacity: 0.6,
    onionSkinOffsetX: 0,
    onionSkinOffsetY: 0,

    // Image adjustments
    contrast: 1.0,
    saturation: 1.0,
    invertColors: false,
    threshold: 0,

    // Transparency
    backgroundTransparent: false,
    transparencyAdjust: 0,
    useBackground: false,

    // Network
    serverAddress: '192.168.1.198:8080'
};

class SettingsManagerClass {
    constructor() {
        this._settings = { ...DEFAULT_SETTINGS };
        this._listeners = new Map();
        this.load();
    }

    /**
     * Load settings from localStorage
     */
    load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this._settings = { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
            this._settings = { ...DEFAULT_SETTINGS };
        }
    }

    /**
     * Save settings to localStorage
     */
    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    /**
     * Reset all settings to defaults
     */
    reset() {
        this._settings = { ...DEFAULT_SETTINGS };
        this.save();
        eventBus.publish(Events.SETTINGS_CHANGED, { all: true });
    }

    /**
     * Get a setting value
     * @param {string} key - Setting key
     * @returns {*} Setting value
     */
    get(key) {
        return this._settings[key];
    }

    /**
     * Set a setting value
     * @param {string} key - Setting key
     * @param {*} value - New value
     */
    set(key, value) {
        if (this._settings[key] !== value) {
            this._settings[key] = value;
            this.save();

            // Notify listeners
            const listeners = this._listeners.get(key);
            if (listeners) {
                listeners.forEach(callback => callback(value));
            }

            eventBus.publish(Events.SETTINGS_CHANGED, { key, value });
        }
    }

    /**
     * Subscribe to changes for a specific setting
     * @param {string} key - Setting key
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }
        this._listeners.get(key).add(callback);

        return () => {
            const listeners = this._listeners.get(key);
            if (listeners) {
                listeners.delete(callback);
            }
        };
    }

    /**
     * Get all settings as an object
     * @returns {Object} All settings
     */
    getAll() {
        return { ...this._settings };
    }

    // Convenience getters for common settings
    get recognitionType() { return this._settings.recognitionType; }
    set recognitionType(v) { this.set('recognitionType', v); }

    get captureDelay() { return this._settings.captureDelay; }
    set captureDelay(v) { this.set('captureDelay', v); }

    get targetColor() { return this._settings.targetColor; }
    set targetColor(v) { this.set('targetColor', v); }

    get frameTopThickness() { return this._settings.frameTopThickness; }
    set frameTopThickness(v) { this.set('frameTopThickness', v); }

    get frameBottomThickness() { return this._settings.frameBottomThickness; }
    set frameBottomThickness(v) { this.set('frameBottomThickness', v); }

    get frameRate() { return this._settings.frameRate; }
    set frameRate(v) { this.set('frameRate', v); }

    get reverseMovie() { return this._settings.reverseMovie; }
    set reverseMovie(v) { this.set('reverseMovie', v); }

    get zoomFactor() { return this._settings.zoomFactor; }
    set zoomFactor(v) { this.set('zoomFactor', v); }

    get kaleidoscopeEnabled() { return this._settings.kaleidoscopeEnabled; }
    set kaleidoscopeEnabled(v) { this.set('kaleidoscopeEnabled', v); }

    get kaleidoscopeRotation() { return this._settings.kaleidoscopeRotation; }
    set kaleidoscopeRotation(v) { this.set('kaleidoscopeRotation', v); }

    get onionSkinEnabled() { return this._settings.onionSkinEnabled; }
    set onionSkinEnabled(v) { this.set('onionSkinEnabled', v); }

    get onionSkinOpacity() { return this._settings.onionSkinOpacity; }
    set onionSkinOpacity(v) { this.set('onionSkinOpacity', v); }

    get onionSkinOffsetX() { return this._settings.onionSkinOffsetX; }
    set onionSkinOffsetX(v) { this.set('onionSkinOffsetX', v); }

    get onionSkinOffsetY() { return this._settings.onionSkinOffsetY; }
    set onionSkinOffsetY(v) { this.set('onionSkinOffsetY', v); }

    get contrast() { return this._settings.contrast; }
    set contrast(v) { this.set('contrast', v); }

    get saturation() { return this._settings.saturation; }
    set saturation(v) { this.set('saturation', v); }

    get invertColors() { return this._settings.invertColors; }
    set invertColors(v) { this.set('invertColors', v); }

    get threshold() { return this._settings.threshold; }
    set threshold(v) { this.set('threshold', v); }

    get backgroundTransparent() { return this._settings.backgroundTransparent; }
    set backgroundTransparent(v) { this.set('backgroundTransparent', v); }

    get transparencyAdjust() { return this._settings.transparencyAdjust; }
    set transparencyAdjust(v) { this.set('transparencyAdjust', v); }

    get useBackground() { return this._settings.useBackground; }
    set useBackground(v) { this.set('useBackground', v); }

    get serverAddress() { return this._settings.serverAddress; }
    set serverAddress(v) { this.set('serverAddress', v); }
}

// Singleton instance
export const settings = new SettingsManagerClass();
