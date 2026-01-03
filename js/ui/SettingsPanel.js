/**
 * SettingsPanel - Binds settings UI to SettingsManager
 * Port of Swift SettingsView
 */
import { settings } from '../managers/SettingsManager.js';

export class SettingsPanel {
    constructor() {
        this.elements = {};
        this.bindElements();
        this.setupListeners();
        this.loadSettings();
    }

    /**
     * Bind DOM elements
     */
    bindElements() {
        this.elements = {
            // Recognition
            recognitionType: document.getElementById('recognition-type'),
            captureDelay: document.getElementById('capture-delay'),
            captureDelayValue: document.getElementById('capture-delay-value'),

            // Color target
            colorTargetSection: document.getElementById('color-target-section'),
            targetColor: document.getElementById('target-color'),

            // Camera
            zoomFactor: document.getElementById('zoom-factor'),
            zoomFactorValue: document.getElementById('zoom-factor-value'),
            kaleidoscopeToggle: document.getElementById('kaleidoscope-toggle'),
            onionSkinToggle: document.getElementById('onion-skin-toggle'),
            onionOpacity: document.getElementById('onion-opacity'),
            onionOpacityValue: document.getElementById('onion-opacity-value'),

            // Image quality
            invertToggle: document.getElementById('invert-toggle'),
            transparentToggle: document.getElementById('transparent-toggle'),
            transparencyAdjust: document.getElementById('transparency-adjust'),
            transparencyValue: document.getElementById('transparency-value'),
            contrast: document.getElementById('contrast'),
            contrastValue: document.getElementById('contrast-value'),
            saturation: document.getElementById('saturation'),
            saturationValue: document.getElementById('saturation-value'),

            // Frame overlay
            frameTop: document.getElementById('frame-top'),
            frameTopValue: document.getElementById('frame-top-value'),
            frameBottom: document.getElementById('frame-bottom'),
            frameBottomValue: document.getElementById('frame-bottom-value'),

            // Playback
            frameRate: document.getElementById('frame-rate'),
            frameRateValue: document.getElementById('frame-rate-value'),
            reverseToggle: document.getElementById('reverse-toggle'),

            // Network
            serverAddress: document.getElementById('server-address')
        };
    }

    /**
     * Setup event listeners
     */
    setupListeners() {
        const { elements } = this;

        // Recognition type
        elements.recognitionType?.addEventListener('change', (e) => {
            settings.recognitionType = e.target.value;
            this.updateColorTargetVisibility();
        });

        // Capture delay
        elements.captureDelay?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            settings.captureDelay = value;
            elements.captureDelayValue.textContent = `${value.toFixed(1)}s`;
        });

        // Target color
        elements.targetColor?.addEventListener('input', (e) => {
            const hex = e.target.value;
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            settings.targetColor = { r, g, b };
        });

        // Zoom factor
        elements.zoomFactor?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            settings.zoomFactor = value;
            elements.zoomFactorValue.textContent = `${value.toFixed(1)}x`;
        });

        // Kaleidoscope
        elements.kaleidoscopeToggle?.addEventListener('change', (e) => {
            settings.kaleidoscopeEnabled = e.target.checked;
            if (e.target.checked) {
                settings.kaleidoscopeRotation = Math.random() * Math.PI * 2;
            }
        });

        // Onion skin
        elements.onionSkinToggle?.addEventListener('change', (e) => {
            settings.onionSkinEnabled = e.target.checked;
        });

        elements.onionOpacity?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            settings.onionSkinOpacity = value;
            elements.onionOpacityValue.textContent = value.toFixed(2);
        });

        // Invert
        elements.invertToggle?.addEventListener('change', (e) => {
            settings.invertColors = e.target.checked;
        });

        // Transparent background
        elements.transparentToggle?.addEventListener('change', (e) => {
            settings.backgroundTransparent = e.target.checked;
        });

        elements.transparencyAdjust?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            settings.transparencyAdjust = value;
            elements.transparencyValue.textContent = value.toFixed(2);
        });

        // Contrast
        elements.contrast?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            settings.contrast = value;
            elements.contrastValue.textContent = value.toFixed(1);
        });

        // Saturation
        elements.saturation?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            settings.saturation = value;
            elements.saturationValue.textContent = value.toFixed(1);
        });

        // Frame overlays
        elements.frameTop?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            settings.frameTopThickness = value;
            elements.frameTopValue.textContent = `${value}px`;
        });

        elements.frameBottom?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            settings.frameBottomThickness = value;
            elements.frameBottomValue.textContent = `${value}px`;
        });

        // Frame rate
        elements.frameRate?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            settings.frameRate = value;
            elements.frameRateValue.textContent = `${value} fps`;
        });

        // Reverse
        elements.reverseToggle?.addEventListener('change', (e) => {
            settings.reverseMovie = e.target.checked;
        });

        // Server address
        elements.serverAddress?.addEventListener('change', (e) => {
            settings.serverAddress = e.target.value;
        });
    }

    /**
     * Load settings into UI
     */
    loadSettings() {
        const { elements } = this;

        // Recognition
        if (elements.recognitionType) {
            elements.recognitionType.value = settings.recognitionType;
        }
        if (elements.captureDelay) {
            elements.captureDelay.value = settings.captureDelay;
            elements.captureDelayValue.textContent = `${settings.captureDelay.toFixed(1)}s`;
        }

        // Target color
        if (elements.targetColor) {
            const { r, g, b } = settings.targetColor;
            const hex = '#' +
                Math.round(r * 255).toString(16).padStart(2, '0') +
                Math.round(g * 255).toString(16).padStart(2, '0') +
                Math.round(b * 255).toString(16).padStart(2, '0');
            elements.targetColor.value = hex;
        }
        this.updateColorTargetVisibility();

        // Zoom factor
        if (elements.zoomFactor) {
            elements.zoomFactor.value = settings.zoomFactor;
            elements.zoomFactorValue.textContent = `${settings.zoomFactor.toFixed(1)}x`;
        }

        // Kaleidoscope
        if (elements.kaleidoscopeToggle) {
            elements.kaleidoscopeToggle.checked = settings.kaleidoscopeEnabled;
        }

        // Onion skin
        if (elements.onionSkinToggle) {
            elements.onionSkinToggle.checked = settings.onionSkinEnabled;
        }
        if (elements.onionOpacity) {
            elements.onionOpacity.value = settings.onionSkinOpacity;
            elements.onionOpacityValue.textContent = settings.onionSkinOpacity.toFixed(2);
        }

        // Image quality
        if (elements.invertToggle) {
            elements.invertToggle.checked = settings.invertColors;
        }
        if (elements.transparentToggle) {
            elements.transparentToggle.checked = settings.backgroundTransparent;
        }
        if (elements.transparencyAdjust) {
            elements.transparencyAdjust.value = settings.transparencyAdjust;
            elements.transparencyValue.textContent = settings.transparencyAdjust.toFixed(2);
        }
        if (elements.contrast) {
            elements.contrast.value = settings.contrast;
            elements.contrastValue.textContent = settings.contrast.toFixed(1);
        }
        if (elements.saturation) {
            elements.saturation.value = settings.saturation;
            elements.saturationValue.textContent = settings.saturation.toFixed(1);
        }

        // Frame overlays
        if (elements.frameTop) {
            elements.frameTop.value = settings.frameTopThickness;
            elements.frameTopValue.textContent = `${settings.frameTopThickness}px`;
        }
        if (elements.frameBottom) {
            elements.frameBottom.value = settings.frameBottomThickness;
            elements.frameBottomValue.textContent = `${settings.frameBottomThickness}px`;
        }

        // Playback
        if (elements.frameRate) {
            elements.frameRate.value = settings.frameRate;
            elements.frameRateValue.textContent = `${settings.frameRate} fps`;
        }
        if (elements.reverseToggle) {
            elements.reverseToggle.checked = settings.reverseMovie;
        }

        // Network
        if (elements.serverAddress) {
            elements.serverAddress.value = settings.serverAddress;
        }
    }

    /**
     * Show/hide color target section based on recognition type
     */
    updateColorTargetVisibility() {
        if (this.elements.colorTargetSection) {
            if (settings.recognitionType === 'colorSample') {
                this.elements.colorTargetSection.classList.remove('hidden');
            } else {
                this.elements.colorTargetSection.classList.add('hidden');
            }
        }
    }
}
