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
     * Play shutter sound - realistic camera shutter using noise + resonance
     */
    playShutterSound() {
        this.init();
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Create white noise buffer for mechanical click
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        // Noise source (mechanical click)
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        // Bandpass filter to shape the click
        const clickFilter = ctx.createBiquadFilter();
        clickFilter.type = 'bandpass';
        clickFilter.frequency.value = 4000;
        clickFilter.Q.value = 1.5;

        // Click envelope
        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0.4, now);
        clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        noise.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(ctx.destination);

        // Low thump for body resonance
        const thump = ctx.createOscillator();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(150, now);
        thump.frequency.exponentialRampToValueAtTime(60, now + 0.05);

        const thumpGain = ctx.createGain();
        thumpGain.gain.setValueAtTime(0.3, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        thump.connect(thumpGain);
        thumpGain.connect(ctx.destination);

        // Second click (mirror slap)
        const noise2 = ctx.createBufferSource();
        noise2.buffer = noiseBuffer;
        const click2Filter = ctx.createBiquadFilter();
        click2Filter.type = 'highpass';
        click2Filter.frequency.value = 2000;
        const click2Gain = ctx.createGain();
        click2Gain.gain.setValueAtTime(0, now);
        click2Gain.gain.setValueAtTime(0.15, now + 0.03);
        click2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        noise2.connect(click2Filter);
        click2Filter.connect(click2Gain);
        click2Gain.connect(ctx.destination);

        // Start all
        noise.start(now);
        noise.stop(now + 0.08);
        thump.start(now);
        thump.stop(now + 0.1);
        noise2.start(now);
        noise2.stop(now + 0.1);
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
