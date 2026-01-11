/**
 * Audio Manager - Web Audio APIによる効果音生成
 */
class AudioManager {
    constructor() {
        this.context = null;
        this.enabled = true;
    }
    
    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }
    
    resume() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    }
    
    // パドル衝突音
    playPaddleHit() {
        if (!this.enabled || !this.context) return;
        this.playTone(400, 0.1, 'square', 0.3);
    }
    
    // 壁衝突音
    playWallHit() {
        if (!this.enabled || !this.context) return;
        this.playTone(200, 0.05, 'sine', 0.2);
    }
    
    // ゴール音
    playGoal() {
        if (!this.enabled || !this.context) return;
        // 上昇音
        this.playTone(400, 0.15, 'square', 0.4);
        setTimeout(() => this.playTone(600, 0.15, 'square', 0.4), 100);
        setTimeout(() => this.playTone(800, 0.2, 'square', 0.4), 200);
    }
    
    // ゲーム開始音
    playStart() {
        if (!this.enabled || !this.context) return;
        this.playTone(523, 0.1, 'sine', 0.3);
        setTimeout(() => this.playTone(659, 0.1, 'sine', 0.3), 100);
        setTimeout(() => this.playTone(784, 0.15, 'sine', 0.3), 200);
    }
    
    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.context) return;
        
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);
        
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        
        gainNode.gain.setValueAtTime(volume, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
        
        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + duration);
    }
}

const audioManager = new AudioManager();
