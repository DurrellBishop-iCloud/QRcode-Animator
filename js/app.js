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

        // Show version in debug area with copy button
        this.elements.displayText.innerHTML = '<button id="copy-debug" style="float:right;background:#555;color:#0f0;border:1px solid #0f0;padding:2px 8px;font-size:12px;border-radius:3px;">Copy</button>v37 ready';
        this.setupCopyButton();

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

        this.uiController.updateDisplayText('Exporting...');

        try {
            const blob = await this.movieExporter.exportToBlob(
                framesToExport,
                { screenSize }
            );

            // Upload to server in background
            this.serverUploader.uploadVideo(blob);

            // Show save prompt (user tap required for share API on iOS)
            this.showSavePrompt(blob);

        } catch (error) {
            console.error('Save failed:', error);
            this.uiController.updateDisplayText('Export failed');
            setTimeout(() => this.uiController.updateDisplayText(''), 2000);
        }
    }

    /**
     * Show save prompt overlay - requires user tap for share API
     */
    showSavePrompt(blob) {
        const prompt = document.getElementById('save-prompt');
        const button = document.getElementById('save-button');

        this.uiController.updateDisplayText('');
        prompt.classList.remove('hidden');

        // Handle tap (user gesture required for share API)
        const handleTap = async () => {
            button.removeEventListener('click', handleTap);
            prompt.classList.add('hidden');

            // Use correct extension based on blob type (mp4 for iOS, webm for others)
            const ext = this.movieExporter.getFileExtension(blob.type);
            const filename = `animation_${Date.now()}.${ext}`;
            await this.movieExporter.saveToFile(blob, filename);

            this.uiController.updateDisplayText('Saved!');
            setTimeout(() => this.uiController.updateDisplayText(''), 2000);
        };

        button.addEventListener('click', handleTap);
    }

    /**
     * Setup copy button handler
     */
    setupCopyButton() {
        const btn = document.getElementById('copy-debug');
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                const clone = this.elements.displayText.cloneNode(true);
                clone.querySelector('#copy-debug')?.remove();
                const text = clone.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = 'Copy'; }, 1000);
                });
            };
        }
    }

    /**
     * Debug log helper - appends to display text
     */
    debugLog(msg) {
        const el = this.elements.displayText;
        if (el) {
            // Append text node to preserve the copy button
            el.appendChild(document.createTextNode(msg + '\n'));
            el.scrollTop = el.scrollHeight;
        }
        console.log('[DEBUG]', msg);
    }

    /**
     * Broadcast video to viewers via WebRTC
     */
    async broadcastVideo() {
        // Clear debug area and show version (keep copy button)
        this.elements.displayText.innerHTML = '<button id="copy-debug" style="float:right;background:#555;color:#0f0;border:1px solid #0f0;padding:2px 8px;font-size:12px;border-radius:3px;">Copy</button>v37\n';
        this.setupCopyButton();

        const frameCount = this.frameManager.count;
        this.debugLog(`Frames: ${frameCount}`);
        this.debugLog(`Bounce: ${settings.bounceEnabled}`);
        this.debugLog(`Reverse: ${settings.reverseMovie}`);

        if (frameCount === 0) {
            this.debugLog('ERROR: No frames');
            return;
        }

        const channelName = settings.broadcastChannel;
        this.debugLog(`Channel: ${channelName || '(none)'}`);

        if (!channelName) {
            this.debugLog('ERROR: No channel set');
            return;
        }

        this.debugLog('Exporting...');

        let blob;
        try {
            const allFrames = this.frameManager.getAllFrames();
            this.debugLog(`Raw frames: ${allFrames.length}`);

            blob = await this.movieExporter.exportToBlob(
                allFrames,
                {
                    screenSize: this.uiController.getScreenSize()
                }
            );

            this.debugLog(`Blob size: ${blob.size} bytes`);
            this.debugLog(`Blob type: ${blob.type}`);
        } catch (error) {
            console.error('Export failed:', error);
            this.debugLog(`EXPORT ERROR: ${error.message}`);
            return;
        }

        this.debugLog('Connecting...');

        try {
            await this.broadcastManager.sendVideo(blob, channelName, (msg) => this.debugLog(msg));

            this.debugLog('SUCCESS: Sent!');

        } catch (error) {
            console.error('Send failed:', error);
            this.debugLog(`SEND ERROR: ${error.message}`);
        }
    }

    /**
     * Setup viewer mode UI and handlers
     */
    setupViewerMode() {
        const { viewerModeToggle, broadcastChannel, viewerStatus } = this.elements;

        // Always start with viewer mode disabled
        viewerModeToggle.checked = false;

        // Load saved channel name (but not the toggle state)
        if (settings.broadcastChannel) {
            broadcastChannel.value = settings.broadcastChannel;
        }

        // Save channel when settings close (Done button)
        eventBus.subscribe(Events.SETTINGS_CLOSED, () => {
            settings.broadcastChannel = broadcastChannel.value.trim();
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
        this.elements.viewerChannelDisplay.textContent = 'CH-' + channel;
        this.elements.viewerWaiting.classList.remove('hidden');
        this.elements.settingsModal.classList.add('hidden');

        // Generate QR code for the channel
        this.generateChannelQRCode(channel);

        // Tap to show settings menu (stays in viewer mode)
        this.elements.viewerOverlay.onclick = () => {
            this.elements.settingsModal.classList.remove('hidden');
        };
    }

    /**
     * Generate QR code displaying the channel name
     */
    generateChannelQRCode(channel) {
        const qrContainer = document.getElementById('channel-qr-code');
        qrContainer.innerHTML = ''; // Clear previous

        // Create QR code with "CH-" prefix
        const qrData = 'CH-' + channel;

        // Use qrcode-generator library
        const qr = qrcode(0, 'M'); // Type 0 = auto, Error correction M
        qr.addData(qrData);
        qr.make();

        // Create image
        const img = document.createElement('img');
        img.src = qr.createDataURL(8); // Cell size 8
        img.alt = qrData;
        qrContainer.appendChild(img);
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
    playReceivedVideo(blob) {
        const video = this.elements.receivedVideo;
        const waiting = this.elements.viewerWaiting;

        // Hide waiting message
        waiting.classList.add('hidden');

        // Clean up old video URL
        if (this.currentVideoUrl) {
            URL.revokeObjectURL(this.currentVideoUrl);
        }

        // Pause current playback and clear buffer
        video.pause();
        video.removeAttribute('src');
        video.load();

        // Create new object URL
        const url = URL.createObjectURL(blob);
        this.currentVideoUrl = url;

        // Set attributes and source
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.src = url;
        video.load();

        // Play when ready
        video.addEventListener('loadeddata', () => {
            video.play().catch(e => console.error('Play error:', e));
        }, { once: true });

        // Fallback play after 500ms
        setTimeout(() => {
            if (video.readyState >= 2) {
                video.play().catch(() => {});
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
