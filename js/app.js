/**
 * Stop Motion Web App - Main Application Bootstrap
 * Port of Swift Overhead_iPhone_Animations
 */
import { eventBus, Events } from './core/EventBus.js';
import { settings } from './managers/SettingsManager.js';
import { CameraManager } from './managers/CameraManager.js';
import { FrameManager } from './managers/FrameManager.js';
import { PlaybackManager } from './managers/PlaybackManager.js';
import { AudioManager } from './managers/AudioManager.js';
import { RecognitionManager } from './managers/RecognitionManager.js';
import { UIController } from './ui/UIController.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { FilterPipeline } from './filters/FilterPipeline.js';
import { MovieExporter } from './export/MovieExporter.js';
import { ServerUploader } from './export/ServerUploader.js';

class App {
    constructor() {
        // DOM elements
        this.elements = {
            video: document.getElementById('camera-preview'),
            mainCanvas: document.getElementById('main-canvas'),
            onionCanvas: document.getElementById('onion-canvas'),
            overlayCanvas: document.getElementById('overlay-canvas'),
            topFrame: document.getElementById('top-frame'),
            bottomFrame: document.getElementById('bottom-frame'),
            flash: document.getElementById('flash-overlay'),
            modeText: document.getElementById('mode-text'),
            frameCount: document.getElementById('frame-count'),
            displayText: document.getElementById('display-text'),
            settingsModal: document.getElementById('settings-modal'),
            closeSettings: document.getElementById('close-settings'),
            debugRect: document.getElementById('debug-rect')
        };

        // Hidden capture canvas
        this.captureCanvas = document.createElement('canvas');

        // Managers
        this.cameraManager = new CameraManager(this.elements.video, this.captureCanvas);
        this.frameManager = new FrameManager();
        this.playbackManager = new PlaybackManager();
        this.audioManager = new AudioManager();
        this.filterPipeline = new FilterPipeline();
        this.movieExporter = new MovieExporter();
        this.serverUploader = new ServerUploader();

        // Recognition (needs audio manager)
        this.recognitionManager = new RecognitionManager(this.audioManager);

        // UI
        this.uiController = new UIController(this.elements);
        this.settingsPanel = new SettingsPanel();

        // State
        this.isRunning = false;
        this.currentMode = 'Make';
        this.lastFrameTime = 0;
        this.targetFps = 30; // Recognition processing rate

        // Bind methods
        this.loop = this.loop.bind(this);

        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Initialize and start the app
     */
    async init() {
        console.log('Starting Stop Motion Web App...');

        // Start camera
        const cameraStarted = await this.cameraManager.startSession();

        if (!cameraStarted) {
            // Error already shown by CameraManager
            return;
        }

        // Initialize canvases
        const dims = this.cameraManager.getDimensions();
        this.uiController.initCanvases(dims.width, dims.height);

        // Start recognition loop
        this.isRunning = true;
        requestAnimationFrame(this.loop);

        // Update initial UI
        this.updateUI();

        console.log('App started successfully');
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Mode changes
        eventBus.subscribe(Events.MODE_CHANGED, ({ mode }) => {
            this.handleModeChange(mode);
        });

        // Display text updates
        eventBus.subscribe(Events.DISPLAY_TEXT, ({ text }) => {
            this.uiController.updateDisplayText(text);
        });

        // Frame capture command
        eventBus.subscribe(Events.COMMAND_CAPTURE, () => {
            this.capturePhoto();
        });

        // Long capture command
        eventBus.subscribe(Events.COMMAND_LONG_CAPTURE, () => {
            this.captureLongPhoto();
        });

        // Navigation commands
        eventBus.subscribe(Events.COMMAND_BACK, () => {
            this.frameManager.moveBack();
            this.updateUI();
        });

        eventBus.subscribe(Events.COMMAND_FORWARD, () => {
            this.frameManager.moveForward();
            this.updateUI();
        });

        eventBus.subscribe(Events.COMMAND_DELETE, () => {
            this.frameManager.deleteCurrentFrame();
            this.renderCurrentView();
            this.updateUI();
        });

        // Save command
        eventBus.subscribe(Events.COMMAND_SAVE, () => {
            this.saveAndReset();
        });

        // Share command
        eventBus.subscribe(Events.COMMAND_SHARE, () => {
            this.shareToServer();
        });

        // Background capture
        eventBus.subscribe(Events.COMMAND_BACKGROUND, () => {
            this.captureBackground();
        });

        // Playback frame updates
        eventBus.subscribe(Events.PLAYBACK_FRAME, ({ frame }) => {
            if (frame) {
                this.uiController.renderFrame(frame);
            }
            this.updateUI();
        });

        // Frame navigation
        eventBus.subscribe(Events.FRAME_NAVIGATED, () => {
            this.renderCurrentView();
            this.updateUI();
        });

        // Settings changes that affect display
        settings.subscribe('onionSkinEnabled', () => this.renderCurrentView());
        settings.subscribe('onionSkinOpacity', () => this.renderCurrentView());
        settings.subscribe('kaleidoscopeEnabled', () => {});
    }

    /**
     * Main animation/recognition loop
     */
    loop(timestamp) {
        if (!this.isRunning) return;

        const elapsed = timestamp - this.lastFrameTime;
        const frameInterval = 1000 / this.targetFps;

        if (elapsed >= frameInterval) {
            this.lastFrameTime = timestamp;

            // Always capture frame for recognition (even in Play mode)
            // This allows detecting when "play" QR is removed to exit Play mode
            const imageData = this.cameraManager.captureFrame();

            if (imageData) {
                // Process for recognition (always - to detect mode changes)
                this.recognitionManager.processFrame(imageData);

                // Only render preview in Make mode when viewing live feed
                if (this.currentMode === 'Make' && this.frameManager.isViewingLiveFeed) {
                    // Render kaleidoscope preview if enabled
                    if (settings.kaleidoscopeEnabled) {
                        const canvas = this.cameraManager.captureFrameAsCanvas();
                        if (canvas) {
                            const filtered = this.filterPipeline.applyKaleidoscopeToCanvas(canvas);
                            this.uiController.renderCanvas(filtered);
                        }
                    } else {
                        // Clear main canvas when not using kaleidoscope
                        // (video element shows live feed)
                        this.uiController.clearMainCanvas();
                    }

                    // Render onion skin
                    this.renderOnionSkin();
                }
            }
        }

        requestAnimationFrame(this.loop);
    }

    /**
     * Handle mode change (Make/Play)
     */
    handleModeChange(mode) {
        this.currentMode = mode;

        if (mode === 'Play') {
            // Enter playback mode
            if (this.frameManager.count > 0) {
                // Export video to documents (for potential save)
                this.exportToDocuments();

                // Start playback
                this.frameManager.resetToLastFrame();
                this.playbackManager.setFrames(
                    this.frameManager.getAllFrames(),
                    this.frameManager.currentFrameIndex
                );
                this.playbackManager.startPlayback();
            }
        } else {
            // Exit playback mode
            this.playbackManager.stopPlayback();
            this.frameManager.returnToLiveFeed();
            this.uiController.clearMainCanvas();
            this.uiController.clearOnionSkin();
        }

        this.updateUI();
    }

    /**
     * Capture a photo
     */
    capturePhoto() {
        // Get raw frame
        let imageData = this.cameraManager.captureFrame();

        if (!imageData) {
            console.warn('Could not capture frame');
            return;
        }

        // Apply filters
        imageData = this.filterPipeline.applyFilters(imageData);

        // Store frame
        this.frameManager.addFrame(imageData);

        // Play shutter sound
        this.audioManager.playShutterSound();

        // Flash effect
        eventBus.publish(Events.FLASH_TRIGGER, {});

        // Clear main canvas to show live feed (frame is stored, not displayed)
        this.uiController.clearMainCanvas();

        // Update UI
        this.updateUI();
    }

    /**
     * Capture long photo (4 copies)
     */
    captureLongPhoto() {
        let imageData = this.cameraManager.captureFrame();

        if (!imageData) return;

        // Apply filters
        imageData = this.filterPipeline.applyFilters(imageData);

        // Store 4 copies
        this.frameManager.addLongCapture(imageData);

        // Play shutter sound
        this.audioManager.playShutterSound();

        // Flash effect
        eventBus.publish(Events.FLASH_TRIGGER, {});

        // Clear main canvas to show live feed
        this.uiController.clearMainCanvas();

        this.updateUI();
    }

    /**
     * Capture background for transparency
     */
    captureBackground() {
        const imageData = this.cameraManager.captureFrame();

        if (imageData) {
            this.frameManager.setBackground(imageData);
            this.filterPipeline.setBackground(imageData);
            this.filterPipeline.calibrateTransparency(imageData);

            // Flash to confirm
            eventBus.publish(Events.FLASH_TRIGGER, {});
        }
    }

    /**
     * Render onion skin overlay
     */
    renderOnionSkin() {
        if (!settings.onionSkinEnabled || this.currentMode !== 'Make') {
            this.uiController.clearOnionSkin();
            return;
        }

        if (!this.frameManager.isViewingLiveFeed) {
            this.uiController.clearOnionSkin();
            return;
        }

        const lastFrame = this.frameManager.getLastFrame();
        if (lastFrame) {
            this.uiController.renderOnionSkin(
                lastFrame,
                settings.onionSkinOpacity,
                settings.onionSkinOffsetX,
                settings.onionSkinOffsetY
            );
        }
    }

    /**
     * Render current view based on state
     */
    renderCurrentView() {
        if (this.currentMode === 'Make') {
            if (this.frameManager.isViewingLiveFeed) {
                // Live feed - video element shows this
                this.uiController.clearMainCanvas();
                this.renderOnionSkin();
            } else {
                // Viewing static frame
                const frame = this.frameManager.getCurrentFrame();
                if (frame) {
                    this.uiController.renderFrame(frame);
                }
                this.uiController.clearOnionSkin();
            }
        }
    }

    /**
     * Export current session to blob (for save)
     */
    async exportToDocuments() {
        if (this.frameManager.count === 0) return null;

        try {
            const blob = await this.movieExporter.exportToBlob(
                this.frameManager.getAllFrames(),
                {
                    screenSize: this.uiController.getScreenSize()
                }
            );
            return blob;
        } catch (error) {
            console.error('Export failed:', error);
            return null;
        }
    }

    /**
     * Save and reset session
     */
    async saveAndReset() {
        if (this.frameManager.count === 0) return;

        try {
            const blob = await this.movieExporter.exportToBlob(
                this.frameManager.getAllFrames(),
                {
                    screenSize: this.uiController.getScreenSize()
                }
            );

            // Download file
            this.movieExporter.saveToFile(blob, `animation_${Date.now()}.webm`);

            // Upload to server
            this.serverUploader.uploadVideo(blob);

            // Reset session
            this.frameManager.clear();
            this.filterPipeline.reset();

            // Clear canvases for fresh start
            this.uiController.clearMainCanvas();
            this.uiController.clearOnionSkin();

            this.uiController.updateDisplayText('Saved!');

            setTimeout(() => {
                this.uiController.updateDisplayText('');
            }, 2000);

            this.updateUI();

        } catch (error) {
            console.error('Save failed:', error);
        }
    }

    /**
     * Share to server (without reset)
     */
    async shareToServer() {
        if (this.frameManager.count === 0) return;

        try {
            const blob = await this.movieExporter.exportToBlob(
                this.frameManager.getAllFrames(),
                {
                    screenSize: this.uiController.getScreenSize()
                }
            );

            await this.serverUploader.uploadVideo(blob);

        } catch (error) {
            console.error('Share failed:', error);
        }
    }

    /**
     * Update UI status
     */
    updateUI() {
        const mode = this.currentMode;
        const count = this.frameManager.count;
        const index = this.frameManager.isViewingLiveFeed ? -1 : this.frameManager.currentFrameIndex;

        if (mode === 'Play') {
            this.uiController.updateStatus(mode, this.playbackManager.frameCount, this.playbackManager.currentFrameIndex);
        } else {
            this.uiController.updateStatus(mode, count, index);
        }
    }

    /**
     * Stop the app
     */
    stop() {
        this.isRunning = false;
        this.cameraManager.stopSession();
        this.playbackManager.stopPlayback();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();

    // Expose for debugging
    window.stopMotionApp = app;
});
