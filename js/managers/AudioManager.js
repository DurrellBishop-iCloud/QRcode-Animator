/**
 * AudioManager - Web Audio API sound effects
 * Port of Swift AudioFeedbackManager
 */
export class AudioManager {
    constructor() {
        this.audioContext = null;
        this.isHumming = false;
        this.hummingOscillator = null;
        this.hummingGain = null;
    }

    /**
     * Initialize audio context (must be called after user interaction)
     */
    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Resume if suspended (autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    /**
     * Play shutter sound
     */
    playShutterSound() {
        this.init();

        // Create a short click/shutter sound
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = 1000;
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    /**
     * Start humming sound (while target detected)
     */
    startHumming() {
        if (this.isHumming) return;

        this.init();
        this.isHumming = true;

        this.hummingOscillator = this.audioContext.createOscillator();
        this.hummingGain = this.audioContext.createGain();

        this.hummingOscillator.connect(this.hummingGain);
        this.hummingGain.connect(this.audioContext.destination);

        this.hummingOscillator.frequency.value = 440; // A4 note
        this.hummingOscillator.type = 'sine';

        this.hummingGain.gain.setValueAtTime(0.1, this.audioContext.currentTime);

        this.hummingOscillator.start();
    }

    /**
     * Stop humming sound
     */
    stopHumming() {
        if (!this.isHumming) return;

        this.isHumming = false;

        if (this.hummingGain) {
            this.hummingGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        }

        if (this.hummingOscillator) {
            this.hummingOscillator.stop(this.audioContext.currentTime + 0.1);
            this.hummingOscillator = null;
            this.hummingGain = null;
        }

        // Play click sound after stopping hum
        setTimeout(() => this.playClickSound(), 100);
    }

    /**
     * Play click sound
     */
    playClickSound() {
        this.init();

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.05);
    }

    /**
     * Reset audio state
     */
    reset() {
        this.stopHumming();
    }
}
