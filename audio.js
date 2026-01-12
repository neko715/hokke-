/**
 * Audio Manager - Web Audio APIによる効果音生成
 */
class AudioManager {
    constructor() {
        this.context = null;
        this.isMuted = false;
        this.masterVolume = 0.5;
    }

    init() {
        if (this.context) return;
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    resume() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    // パドル衝突音（アタックの強いサウンド）
    playPaddleHit() {
        if (this.isMuted || !this.context) return;
        this.playTone(600, 0.1, 'triangle', 0.4);
        this.playNoise(8000, 0.02, 0.2); // 「コツン」という高域ノイズ
    }

    // 壁衝突音（低域の効いたサウンド）
    playWallHit() {
        if (this.isMuted || !this.context) return;
        this.playTone(150, 0.1, 'sine', 0.5);
    }

    // ゴール音（上昇アルペジオ + 爆発音）
    playGoal() {
        if (this.isMuted || !this.context) return;

        // 上昇音
        const now = this.context.currentTime;
        const freqs = [440, 554.37, 659.25, 880];
        freqs.forEach((f, i) => {
            this.playTone(f, 0.3, 'square', 0.2, now + i * 0.1);
        });

        // 衝撃音（ノイズ）
        this.playNoise(100, 0.5, 0.3);
    }

    // ゲーム開始音
    playStart() {
        if (this.isMuted || !this.context) return;
        const now = this.context.currentTime;
        this.playTone(523.25, 0.1, 'sine', 0.3, now);
        this.playTone(659.25, 0.1, 'sine', 0.3, now + 0.1);
        this.playTone(783.99, 0.2, 'sine', 0.3, now + 0.2);
    }

    playTone(frequency, duration, type = 'sine', volume = 0.3, startTime = null) {
        if (!this.context) return;
        const start = startTime || this.context.currentTime;

        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);

        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(volume * this.masterVolume, start + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

        oscillator.start(start);
        oscillator.stop(start + duration);
    }

    // ノイズ（打撃音などの質感を出す用）
    playNoise(filterFreq, duration, volume = 0.2) {
        if (!this.context) return;
        const now = this.context.currentTime;

        const bufferSize = this.context.sampleRate * duration;
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.context.createBufferSource();
        noise.buffer = buffer;

        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, now);

        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(volume * this.masterVolume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.context.destination);

        noise.start(now);
        noise.stop(now + duration);
    }
}

const audioManager = new AudioManager();
