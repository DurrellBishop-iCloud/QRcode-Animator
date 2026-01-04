/**
 * RecognitionManager - Orchestrates recognition and routes commands
 * Port of Swift RecognitionManager
 */
import { eventBus, Events } from '../core/EventBus.js';
import { settings } from './SettingsManager.js';
import { QRCodeRecognizer } from '../recognition/QRCodeRecognizer.js';
import { BarcodeRecognizer } from '../recognition/BarcodeRecognizer.js';
import { ColorSampleRecognizer } from '../recognition/ColorSampleRecognizer.js';

// QR code command lookup
const QR_COMMANDS = {
    'play': Events.COMMAND_PLAY,
    'back': Events.COMMAND_BACK,
    'forward': Events.COMMAND_FORWARD,
    'delete': Events.COMMAND_DELETE,
    'save': Events.COMMAND_SAVE,
    'share': Events.COMMAND_SHARE,
    'kaleidoscope': Events.COMMAND_KALEIDOSCOPE,
    'long': Events.COMMAND_LONG_CAPTURE,
    'background': Events.COMMAND_BACKGROUND
};

// Display text mapping
const DISPLAY_TEXT = {
    'save': 'Saved - Start again',
    'share': 'Share'
};

// Hidden commands (no display text)
const HIDDEN_COMMANDS = ['play', 'back', 'forward', 'delete', 'kaleidoscope', 'long', 'background'];

export class RecognitionManager {
    constructor(audioManager) {
        this.audioManager = audioManager;

        // Recognizers
        this.qrCodeRecognizer = new QRCodeRecognizer();
        this.barcodeRecognizer = new BarcodeRecognizer();
        this.colorSampleRecognizer = new ColorSampleRecognizer();

        this.currentRecognizer = null;

        // State
        this.currentMode = 'Make'; // 'Make' | 'Play'
        this.lastDetectedCode = '';
        this.displayText = '';
        this.lostTargetTimer = null;
        this.lastShareTime = 0;

        // Setup recognizers
        this.setupRecognizers();
        this.switchToRecognizer(settings.recognitionType);

        // Subscribe to settings changes
        settings.subscribe('recognitionType', (type) => {
            this.switchToRecognizer(type);
        });
    }

    /**
     * Setup all recognizer callbacks
     */
    setupRecognizers() {
        const setupRecognizer = (recognizer) => {
            recognizer.onDetectTarget(() => this.handleDetectTarget());
            recognizer.onLoseTarget(() => this.handleLoseTarget());
            recognizer.onDetectData((data) => this.handleDetectData(data));
        };

        setupRecognizer(this.qrCodeRecognizer);
        setupRecognizer(this.barcodeRecognizer);
        setupRecognizer(this.colorSampleRecognizer);
    }

    /**
     * Switch to a different recognizer
     * @param {string} type - Recognition type
     */
    switchToRecognizer(type) {
        // Reset current recognizer
        if (this.currentRecognizer) {
            this.currentRecognizer.reset();
        }

        // Clear any pending timers
        if (this.lostTargetTimer) {
            clearTimeout(this.lostTargetTimer);
            this.lostTargetTimer = null;
        }

        this.audioManager.reset();

        // Switch to new recognizer
        switch (type) {
            case 'qrCode':
                this.currentRecognizer = this.qrCodeRecognizer;
                break;
            case 'barcode':
                this.currentRecognizer = this.barcodeRecognizer;
                break;
            case 'colorSample':
                this.currentRecognizer = this.colorSampleRecognizer;
                break;
            default:
                this.currentRecognizer = this.qrCodeRecognizer;
        }

        this.displayText = '';
        console.log(`Switched to ${type} recognition`);
    }

    /**
     * Process a video frame
     * @param {ImageData} imageData - Frame to process
     */
    processFrame(imageData) {
        if (this.currentRecognizer) {
            this.currentRecognizer.processFrame(imageData);
        }
    }

    /**
     * Handle target detection
     */
    handleDetectTarget() {
        // Clear any pending timer
        if (this.lostTargetTimer) {
            clearTimeout(this.lostTargetTimer);
            this.lostTargetTimer = null;
        }

        const code = this.lastDetectedCode.toLowerCase();

        if (code === 'play') {
            this.setMode('Play');
        } else {
            this.audioManager.startHumming();
        }

        eventBus.publish(Events.RECOGNITION_DETECTED, { code: this.lastDetectedCode });
    }

    /**
     * Handle target loss
     */
    handleLoseTarget() {
        this.audioManager.stopHumming();

        const code = this.lastDetectedCode.toLowerCase();

        // Handle command codes immediately
        if (code === 'play') {
            console.log('Switching back to Make mode');
            this.setMode('Make');
            this.clearDisplayText();
            return;
        }

        // Navigation commands
        if (['back', 'forward', 'delete'].includes(code)) {
            const event = QR_COMMANDS[code];
            if (event) {
                eventBus.publish(event, {});
            }
            this.clearDisplayText();
            return;
        }

        // Save command
        if (code === 'save') {
            eventBus.publish(Events.COMMAND_SAVE, {});
            this.clearDisplayText();
            return;
        }

        // Share command (with cooldown)
        if (code === 'share') {
            const now = Date.now();
            if (now - this.lastShareTime > 2000) {
                this.lastShareTime = now;
                eventBus.publish(Events.COMMAND_SHARE, {});
            }
            this.clearDisplayText();
            return;
        }

        // Kaleidoscope toggle
        if (code === 'kaleidoscope') {
            settings.kaleidoscopeEnabled = !settings.kaleidoscopeEnabled;
            // Generate new random rotation
            settings.kaleidoscopeRotation = Math.random() * Math.PI * 2;
            this.clearDisplayText();
            return;
        }

        // Long capture (delayed)
        if (code === 'long') {
            this.lostTargetTimer = setTimeout(() => {
                eventBus.publish(Events.COMMAND_LONG_CAPTURE, {});
            }, settings.captureDelay * 1000);
            this.clearDisplayText();
            return;
        }

        // Background capture (delayed)
        if (code === 'background') {
            this.lostTargetTimer = setTimeout(() => {
                eventBus.publish(Events.COMMAND_BACKGROUND, {});
            }, settings.captureDelay * 1000);
            this.clearDisplayText();
            return;
        }

        // Regular capture (in Make mode, viewing live feed)
        if (this.currentMode === 'Make') {
            this.lostTargetTimer = setTimeout(() => {
                eventBus.publish(Events.FLASH_TRIGGER, {});
                this.audioManager.playShutterSound();

                setTimeout(() => {
                    eventBus.publish(Events.COMMAND_CAPTURE, { code: this.lastDetectedCode });
                    this.clearDisplayText();
                }, 100);
            }, settings.captureDelay * 1000);
        } else {
            this.clearDisplayText();
        }

        eventBus.publish(Events.RECOGNITION_LOST, { code: this.lastDetectedCode });
    }

    /**
     * Handle data detection
     * @param {string} data - Detected data
     */
    handleDetectData(data) {
        this.lastDetectedCode = data;

        const code = data.toLowerCase();

        // Handle channel setting (CH-ChannelName)
        if (data.toUpperCase().startsWith('CH-')) {
            const channelName = data.substring(3); // Remove "CH-" prefix
            if (channelName) {
                settings.broadcastChannel = channelName;
                this.displayText = 'Channel: ' + channelName;
                eventBus.publish(Events.DISPLAY_TEXT, { text: this.displayText });
                // Clear after a moment
                setTimeout(() => {
                    this.displayText = '';
                    eventBus.publish(Events.DISPLAY_TEXT, { text: '' });
                }, 2000);
            }
            return;
        }

        if (code === 'play') {
            this.displayText = '';
            if (this.currentMode !== 'Play') {
                console.log('Switching to Play mode');
                this.setMode('Play');
            }
        } else {
            this.displayText = this.lookupDisplayText(data);
        }

        eventBus.publish(Events.RECOGNITION_DATA, { data, displayText: this.displayText });
        eventBus.publish(Events.DISPLAY_TEXT, { text: this.displayText });
    }

    /**
     * Look up display text for a QR code
     * @param {string} code - QR code content
     * @returns {string} Display text
     */
    lookupDisplayText(code) {
        const lowerCode = code.toLowerCase();

        // Hide system commands
        if (HIDDEN_COMMANDS.includes(lowerCode)) {
            return '';
        }

        // In Play mode, hide all text
        if (this.currentMode === 'Play') {
            return '';
        }

        // Return mapped display text or the code itself
        return DISPLAY_TEXT[lowerCode] || code;
    }

    /**
     * Clear display text after delay
     */
    clearDisplayText() {
        setTimeout(() => {
            this.displayText = '';
            eventBus.publish(Events.DISPLAY_TEXT, { text: '' });
        }, 300);
    }

    /**
     * Set current mode
     * @param {'Make' | 'Play'} mode
     */
    setMode(mode) {
        if (this.currentMode !== mode) {
            this.currentMode = mode;
            eventBus.publish(Events.MODE_CHANGED, { mode });
        }
    }

    /**
     * Reset recognition state
     */
    reset() {
        if (this.currentRecognizer) {
            this.currentRecognizer.reset();
        }

        if (this.lostTargetTimer) {
            clearTimeout(this.lostTargetTimer);
            this.lostTargetTimer = null;
        }

        this.audioManager.reset();
        this.displayText = '';
    }

    /**
     * Get current mode
     * @returns {'Make' | 'Play'}
     */
    getMode() {
        return this.currentMode;
    }
}
