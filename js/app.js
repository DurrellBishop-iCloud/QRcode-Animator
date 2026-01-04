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
import { FirebaseSignaling } from './managers/FirebaseSignaling.js';
import { UIController } from './ui/UIController.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { FilterPipeline } from './filters/FilterPipeline.js';
import { MovieExporter } from './export/MovieExporter.js';
import { ServerUploader } from './export/ServerUploader.js';

// TEMP DEBUG - remove later
function dbg(msg) {
    const box = document.getElementById('debug-box');
    if (box) {
        box.innerHTML += '<br>' + msg;
        box.scrollTop = box.scrollHeight;
    }
    console.log('[DBG]', msg);
}
window.dbg = dbg; // Make available globally

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
            debugRect: document.getElementById('debug-rect'),
            // Viewer mode elements
            viewerOverlay: document.getElementById('viewer-overlay'),
            receivedVideo: document.getElementById('received-video'),
            viewerWaiting: document.getElementById('viewer-waiting'),
            viewerChannelDisplay: document.getElementById('viewer-channel-display'),
            viewerModeToggle: document.getElementById('viewer-mode-toggle'),
            broadcastChannel: document.getElementById('broadcast-channel'),
            viewerStatus: document.getElementById('viewer-status')
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

        // Broadcast (WebRTC via Firebase signaling)
        this.broadcastManager = new FirebaseSignaling();

        // UI
        this.uiController = new UIController(this.elements);
        this.settingsPanel = new SettingsPanel();

        // State
        this.isRunning = false;
        this.currentMode = 'Make';
        this.lastFrameTime = 0;
        this.targetFps = 30; // Display processing rate
        this.frameCounter = 0;
        this.recognitionSkip = 3; // Only scan every Nth frame for QR (reduces CPU heat)

        // Bind methods
        this.loop = this.loop.bind(this);

        // Setup event handlers
        this.setupEventHandlers();
        this.setupViewerMode();
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

        // Setup orientation detection
        this.setupOrientationDetection();

        console.log('App started successfully');
    }

    /**
     * Setup device orientation detection for real-time UI rotation
     */
    setupOrientationDetection() {
        // Check if DeviceOrientationEvent is available
        if (!window.DeviceOrientationEvent) {
            console.log('DeviceOrientation not supported');
            return;
        }

        this.orientationPermissionGranted = false;
        this.isUpsideDown = true; // Assume upside down initially

        // iOS 13+ requires permission from user gesture
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // Request on first tap anywhere
            const requestOnTap = async () => {
                if (this.orientationPermissionGranted) return;

                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        this.orientationPermissionGranted = true;
                        this.startOrientationListener();
                    }
                } catch (e) {
                    console.log('Motion permission error:', e);
                }
                // Remove listener after first attempt
                document.removeEventListener('click', requestOnTap);
            };
            document.addEventListener('click', requestOnTap);
        } else {
            // Non-iOS, start directly
            this.orientationPermissionGranted = true;
            this.startOrientationListener();
        }
    }

    /**
     * Start listening for orientation changes
     */
    startOrientationListener() {
        window.addEventListener('deviceorientation', (event) => {
            const beta = event.beta;
            if (beta === null) return;

            // Normal portrait: beta around 90
            // Upside down portrait: beta around -90
            const nowUpsideDown = beta < 0;

            if (nowUpsideDown !== this.isUpsideDown) {
                this.isUpsideDown = nowUpsideDown;
                this.applyOrientationRotation(nowUpsideDown);
            }
        });
    }

    /**
     * Apply rotation to UI elements based on orientation
     */
    applyOrientationRotation(upsideDown) {
        const rotation = upsideDown ? '180deg' : '0deg';

        // Rotate the UI overlay and settings modal
        document.querySelector('.ui-overlay').style.transform = `rotate(${rotation})`;
        document.querySelector('.modal').style.transform = `rotate(${rotation})`;
        document.querySelector('.viewer-overlay').style.transform = `rotate(${rotation})`;

        console.log('Orientation changed, upside down:', upsideDown);
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

        // Share command - broadcast to viewers
        eventBus.subscribe(Events.COMMAND_SHARE, () => {
            this.broadcastVideo();
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
            this.frameCounter++;

            // Only run QR recognition every Nth frame to reduce CPU/heat
            const shouldScanQR = (this.frameCounter % this.recognitionSkip) === 0;

            // Capture frame (needed for both recognition and preview)
            const imageData = shouldScanQR ? this.cameraManager.captureFrame() : null;

            if (imageData) {
                // Process for recognition (throttled to reduce heat)
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

        // Get frames before clearing
        const framesToExport = this.frameManager.getAllFrames();
        const screenSize = this.uiController.getScreenSize();

        // Clear everything immediately so user sees fresh view
        this.frameManager.clear();
        this.filterPipeline.reset();
        this.uiController.clearMainCanvas();
        this.uiController.clearOnionSkin();
        this.updateUI();

        try {
            const blob = await this.movieExporter.exportToBlob(
                framesToExport,
                { screenSize }
            );

            // Download file
            this.movieExporter.saveToFile(blob, `animation_${Date.now()}.webm`);

            // Upload to server
            this.serverUploader.uploadVideo(blob);

            this.uiController.updateDisplayText('Saved!');

            setTimeout(() => {
                this.uiController.updateDisplayText('');
            }, 2000);

        } catch (error) {
            console.error('Save failed:', error);
        }
    }

    /**
     * Broadcast video to viewers via WebRTC
     */
    async broadcastVideo() {
        const frameCount = this.frameManager.count;
        dbg('SENDER: broadcastVideo called, frames=' + frameCount);

        if (frameCount === 0) {
            this.uiController.updateDisplayText('No frames');
            setTimeout(() => this.uiController.updateDisplayText(''), 2000);
            return;
        }

        const channelName = settings.broadcastChannel;
        if (!channelName) {
            this.uiController.updateDisplayText('No channel');
            setTimeout(() => this.uiController.updateDisplayText(''), 2000);
            return;
        }

        this.uiController.updateDisplayText('Exporting...');

        let blob;
        try {
            const frames = this.frameManager.getAllFrames();
            dbg('SENDER: Exporting ' + frames.length + ' frames');
            blob = await this.movieExporter.exportToBlob(
                frames,
                {
                    screenSize: this.uiController.getScreenSize()
                }
            );
            dbg('SENDER: Export done, blob size=' + blob.size);
        } catch (error) {
            console.error('Export failed:', error);
            this.uiController.updateDisplayText('Export fail');
            setTimeout(() => this.uiController.updateDisplayText(''), 2000);
            return;
        }

        this.uiController.updateDisplayText('Connecting...');

        try {
            await this.broadcastManager.sendVideo(blob, channelName);

            this.uiController.updateDisplayText('Sent!');
            setTimeout(() => this.uiController.updateDisplayText(''), 2000);

        } catch (error) {
            console.error('Send failed:', error);
            // Show specific error
            const msg = error.message || String(error);
            this.uiController.updateDisplayText(msg.substring(0, 20));
            setTimeout(() => this.uiController.updateDisplayText(''), 4000);
        }
    }

    /**
     * Setup viewer mode UI and handlers
     */
    setupViewerMode() {
        const { viewerModeToggle, broadcastChannel, viewerStatus } = this.elements;

        // Load saved channel name
        if (settings.broadcastChannel) {
            broadcastChannel.value = settings.broadcastChannel;
        }

        // Channel name input
        broadcastChannel.addEventListener('change', (e) => {
            settings.broadcastChannel = e.target.value.trim();
        });

        broadcastChannel.addEventListener('input', (e) => {
            settings.broadcastChannel = e.target.value.trim();
        });

        // Viewer mode toggle
        viewerModeToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            const channel = broadcastChannel.value.trim();

            console.log('Viewer toggle:', enabled, 'channel:', channel);

            if (enabled) {
                if (!channel) {
                    viewerStatus.textContent = 'Enter a channel name first';
                    viewerModeToggle.checked = false;
                    return;
                }

                settings.broadcastChannel = channel; // Save it
                viewerStatus.textContent = 'Connecting...';

                try {
                    console.log('Starting viewer...');
                    await this.broadcastManager.startViewer(channel);
                    console.log('Viewer started successfully');
                    this.enterViewerMode(channel);
                    viewerStatus.textContent = 'Listening on: ' + channel;
                } catch (error) {
                    console.error('Viewer mode failed:', error);
                    viewerStatus.textContent = 'Error: ' + (error.message || error);
                    viewerModeToggle.checked = false;
                }
            } else {
                this.exitViewerMode();
                viewerStatus.textContent = '';
            }
        });

        // Handle received videos
        eventBus.subscribe(Events.VIDEO_RECEIVED, ({ blob }) => {
            this.playReceivedVideo(blob);
        });

        // Handle broadcast status
        eventBus.subscribe(Events.BROADCAST_STATUS, ({ status, message }) => {
            if (status === 'error') {
                this.elements.viewerStatus.textContent = 'Error: ' + message;
            }
        });
    }

    /**
     * Enter viewer mode - show viewer overlay
     */
    enterViewerMode(channel) {
        this.isRunning = false; // Stop recognition loop
        this.cameraManager.stopSession(); // Stop camera - not needed in viewer mode
        this.elements.viewerOverlay.classList.remove('hidden');
        this.elements.viewerChannelDisplay.textContent = channel;
        this.elements.viewerWaiting.classList.remove('hidden');
        this.elements.settingsModal.classList.add('hidden');

        // Tap to show settings menu (stays in viewer mode)
        this.elements.viewerOverlay.onclick = () => {
            this.elements.settingsModal.classList.remove('hidden');
        };
    }

    /**
     * Exit viewer mode
     */
    async exitViewerMode() {
        this.broadcastManager.stop();
        this.elements.viewerOverlay.classList.add('hidden');
        this.elements.viewerStatus.textContent = '';

        // Restart camera
        await this.cameraManager.startSession();

        this.isRunning = true;
        requestAnimationFrame(this.loop); // Restart recognition loop
    }

    /**
     * Play a received video
     */
    async playReceivedVideo(blob) {
        dbg('VIEWER: playReceivedVideo, size=' + blob.size);

        // Compute simple checksum of first 100 bytes to verify content differs
        const firstBytes = await blob.slice(0, 100).arrayBuffer();
        const arr = new Uint8Array(firstBytes);
        let checksum = 0;
        for (let i = 0; i < arr.length; i++) checksum += arr[i];
        dbg('VIEWER: blob checksum=' + checksum);

        const video = this.elements.receivedVideo;
        const waiting = this.elements.viewerWaiting;

        // Hide waiting message
        waiting.classList.add('hidden');

        // Clean up old video URL
        if (this.currentVideoUrl) {
            dbg('VIEWER: Revoking old URL');
            URL.revokeObjectURL(this.currentVideoUrl);
        }

        // Pause current playback
        video.pause();
        video.removeAttribute('src');
        video.load(); // Clear buffer

        // Create new object URL
        const url = URL.createObjectURL(blob);
        this.currentVideoUrl = url;
        dbg('VIEWER: New URL=' + url.substring(0, 50) + '...');

        // Set attributes
        video.muted = true;
        video.loop = true;
        video.playsInline = true;

        // Use loadeddata event to know when ready
        const playWhenReady = () => {
            dbg('VIEWER: loadeddata fired, playing...');
            video.play().then(() => {
                dbg('VIEWER: Playing!');
            }).catch(e => {
                dbg('VIEWER: Play error=' + e.message);
            });
            video.removeEventListener('loadeddata', playWhenReady);
        };
        video.addEventListener('loadeddata', playWhenReady);

        // Set source and load
        video.src = url;
        video.load();
        dbg('VIEWER: Waiting for loadeddata...');

        // Fallback: try playing after 500ms if loadeddata doesn't fire
        setTimeout(() => {
            if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                dbg('VIEWER: Fallback play (readyState=' + video.readyState + ')');
                video.play().catch(e => dbg('VIEWER: Fallback error=' + e.message));
            } else {
                dbg('VIEWER: readyState=' + video.readyState + ' (not ready)');
            }
        }, 500);
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
