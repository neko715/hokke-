/**
 * Game Controller - メインゲームロジック
 */

// ===== Effects =====
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 3;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.01;
        this.color = color;
        this.size = Math.random() * 5 + 3;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95; // 減速
        this.vy *= 0.95;
        this.life -= this.decay;
        return this.life > 0;
    }
    render(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class EffectManager {
    constructor() {
        this.particles = [];
        this.shakeTime = 0;
        this.shakeIntensity = 0;
    }

    spawnExplosion(x, y, color = '#ffcc00', isSmash = false) {
        const count = isSmash ? 150 : 50;
        const spread = isSmash ? 15 : 8;
        for (let i = 0; i < count; i++) {
            const particle = new Particle(x, y, color);
            if (isSmash) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 20 + 5;
                particle.vx = Math.cos(angle) * speed;
                particle.vy = Math.sin(angle) * speed;
                particle.size *= 2;
                particle.decay *= 0.5;
            }
            this.particles.push(particle);
        }
        this.shake(isSmash ? 0.8 : 0.5, isSmash ? 30 : 15);
    }

    shake(duration, intensity) {
        this.shakeTime = duration;
        this.shakeIntensity = intensity;
    }

    update(deltaTime) {
        this.particles = this.particles.filter(p => p.update());
        if (this.shakeTime > 0) {
            this.shakeTime -= deltaTime;
            if (this.shakeTime < 0) this.shakeTime = 0;
        }
    }

    render(ctx) {
        this.particles.forEach(p => p.render(ctx));
    }

    getShakeOffset() {
        if (this.shakeTime <= 0) return { x: 0, y: 0 };
        const force = this.shakeIntensity * (this.shakeTime / 0.5); // 減衰
        return {
            x: (Math.random() - 0.5) * force,
            y: (Math.random() - 0.5) * force
        };
    }

    triggerGoalAnimation() {
        const el = document.getElementById('goal-text');
        const overlay = document.getElementById('goal-overlay');

        overlay.classList.remove('hidden');
        el.classList.remove('animate');

        // リフロー強制
        void el.offsetWidth;

        el.classList.add('animate');

        // アニメーション終了後に隠す
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 2500);
    }
}

class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.physics = null;
        this.isRunning = false;
        this.mySide = null;
        this.isHost = false;
        this.lastTime = 0;

        // スケーリング
        this.scale = 1;
        this.offsetX = 0;

        // 入力状態
        this.inputActive = false;
        this.targetX = 0;
        this.targetY = 0;

        // 勝利条件
        this.winScore = 5;

        // 補間用ターゲット（ゲスト用）
        this.targetPuck = null;
        this.targetOpponentPaddle = null;
    }

    init(isHost) {
        this.isHost = isHost;
        this.mySide = isHost ? 'left' : 'right';

        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.physics = new PhysicsEngine();
        this.effectManager = new EffectManager();

        this.setupCanvas();
        this.setupInput();
        this.setupSync();

        window.addEventListener('resize', () => this.setupCanvas());

        audioManager.init();
    }

    setupCanvas() {
        // Canvas をウィンドウサイズに合わせる
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // スケール計算（論理座標 → 画面座標）
        // 各端末は半分（VIRTUAL_WIDTH）を担当
        this.scale = Math.min(
            this.canvas.width / VIRTUAL_WIDTH,
            this.canvas.height / VIRTUAL_HEIGHT
        );

        // センタリング
        this.offsetX = (this.canvas.width - VIRTUAL_WIDTH * this.scale) / 2;
        this.offsetY = (this.canvas.height - VIRTUAL_HEIGHT * this.scale) / 2;
    }

    setupInput() {
        const handleStart = (x, y) => {
            this.inputActive = true;
            this.updateTarget(x, y);
            audioManager.resume();
        };

        const handleMove = (x, y) => {
            if (this.inputActive) {
                this.updateTarget(x, y);
            }
        };

        const handleEnd = () => {
            this.inputActive = false;
        };

        // タッチイベント
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleStart(touch.clientX, touch.clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleMove(touch.clientX, touch.clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchend', handleEnd);
        this.canvas.addEventListener('touchcancel', handleEnd);

        // マウスイベント
        this.canvas.addEventListener('mousedown', (e) => {
            handleStart(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            handleMove(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('mouseup', handleEnd);
        this.canvas.addEventListener('mouseleave', handleEnd);
    }

    updateTarget(screenX, screenY) {
        // 画面座標 → 論理座標（自分の担当領域）
        let localX = (screenX - this.offsetX) / this.scale;
        let localY = (screenY - this.offsetY) / this.scale;

        // 全体座標に変換
        if (this.mySide === 'right') {
            localX += VIRTUAL_WIDTH;
        }

        this.targetX = localX;
        this.targetY = localY;
    }

    setupSync() {
        syncManager.init(this.isHost);

        // ゲスト：ホストからの状態を受信
        syncManager.onStateReceived = (state) => {
            if (!this.isHost) {
                // 全体更新ではなく必要な部分のみ更新 & ターゲット設定
                if (state.puck) {
                    this.targetPuck = state.puck;

                    // 速度と状態は即時同期して予測を合わせる
                    this.physics.puck.vx = state.puck.vx;
                    this.physics.puck.vy = state.puck.vy;
                    this.physics.puck.smashTimeLeft = state.puck.smashTimeLeft || 0;
                }
                if (state.paddles && state.paddles.left) this.targetOpponentPaddle = state.paddles.left;

                // スコアは即時反映
                if (state.scores) this.physics.setState({ scores: state.scores });

                this.updateScoreDisplay();
                this.checkWin();
            }
        };

        // 相手のパドル位置を受信
        syncManager.onPaddleReceived = (side, x, y) => {
            if (side !== this.mySide) {
                if (this.isHost) {
                    // ホストは物理演算のために即時反映
                    this.physics.updatePaddle(side, x, y);
                } else {
                    // ゲストはターゲット更新のみ
                    if (!this.targetOpponentPaddle) this.targetOpponentPaddle = { x, y };
                    this.targetOpponentPaddle.x = x;
                    this.targetOpponentPaddle.y = y;
                }
            }
        };

        // ゲームイベントを受信
        syncManager.onGameEvent = (event, payload) => {
            switch (event) {
                case 'goal':
                    audioManager.playGoal();
                    this.handleGoalEffect(payload.side);
                    break;
                case 'smash':
                    audioManager.playSmashHit();
                    this.handleSmashEffect(payload.x, payload.y);
                    break;
                case 'start':
                    audioManager.playStart();
                    break;
            }
        };
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();

        // 初期パック速度（ランダム方向）
        if (this.isHost) {
            const angle = (Math.random() - 0.5) * Math.PI / 2;
            const direction = Math.random() > 0.5 ? 1 : -1;
            this.physics.puck.vx = Math.cos(angle) * 8 * direction;
            this.physics.puck.vy = Math.sin(angle) * 8;

            syncManager.sendGameEvent('start');
        }

        audioManager.playStart();
        this.loop();
    }

    loop() {
        if (!this.isRunning) return;

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        this.update(deltaTime);
        this.effectManager.update(deltaTime); // エフェクト更新
        this.render();

        requestAnimationFrame(() => this.loop());
    }

    update(deltaTime) {
        // 自分のパドルを更新
        const myPaddle = this.physics.paddles[this.mySide];
        if (this.inputActive) {
            // 入力への追従（少し遅延させることでスムーズに）
            const followSpeed = 0.5;
            const dx = this.targetX - myPaddle.x;
            const dy = this.targetY - myPaddle.y;
            this.physics.updatePaddle(
                this.mySide,
                myPaddle.x + dx * followSpeed,
                myPaddle.y + dy * followSpeed
            );
        }

        // デバイスに関わらず物理演算を実行（クライアントサイド予測）
        const result = this.physics.update(deltaTime);

        // パドル位置を送信
        syncManager.sendPaddlePosition(myPaddle.x, myPaddle.y);

        // 効果音とエフェクトの処理
        if (result.wallHit) audioManager.playWallHit();

        if (result.paddleHit) {
            // 自分のパドルヒット、またはホスト側での相手パドルヒットを検知
            if (result.isSmash) {
                audioManager.playSmashHit();
                this.handleSmashEffect(this.physics.puck.x, this.physics.puck.y);
                if (this.isHost) {
                    syncManager.sendGameEvent('smash', { x: this.physics.puck.x, y: this.physics.puck.y });
                }
            } else {
                audioManager.playPaddleHit();
            }
        }

        if (this.isHost) {
            if (result.goalSide) {
                audioManager.playGoal();
                syncManager.sendGameEvent('goal', { side: result.goalSide });
                this.handleGoalEffect(result.goalSide);
                this.updateScoreDisplay();
                this.checkWin();
            }

            // 状態を送信
            syncManager.sendState(this.physics.getState());
        } else {
            // ゲスト：ホストの状態に緩やかに補正 (Lerp)
            const alpha = 0.2; // 補間を少し弱めて予測を優先

            // 相手パドル(left)
            if (this.targetOpponentPaddle) {
                const current = this.physics.paddles.left;
                current.x += (this.targetOpponentPaddle.x - current.x) * alpha;
                current.y += (this.targetOpponentPaddle.y - current.y) * alpha;
            }

            // パック位置の補正
            if (this.targetPuck) {
                const current = this.physics.puck;
                // 位置のズレを少しずつ修正
                current.x += (this.targetPuck.x - current.x) * alpha;
                current.y += (this.targetPuck.y - current.y) * alpha;
            }
        }
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 背景クリア
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, w, h);

        ctx.save();

        // 画面シェイク適用
        const shake = this.effectManager.getShakeOffset();
        ctx.translate(this.offsetX + shake.x, this.offsetY + shake.y);

        ctx.scale(this.scale, this.scale);

        // 自分の担当領域のみ描画
        const viewOffsetX = this.mySide === 'left' ? 0 : -VIRTUAL_WIDTH;
        ctx.translate(viewOffsetX, 0);

        // フィールド背景
        this.drawField();

        // ゴール
        this.drawGoals();

        // 中央線
        this.drawCenterLine();

        // パドル
        this.drawPaddle(this.physics.paddles.left, '#00d9ff');
        this.drawPaddle(this.physics.paddles.right, '#00ff88');

        // パック
        this.drawPuck();

        // エフェクト描画（座標系変換後）
        this.effectManager.render(ctx);

        ctx.restore();
    }

    drawField() {
        const ctx = this.ctx;

        // フィールド境界
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, TOTAL_WIDTH, VIRTUAL_HEIGHT);
    }

    drawGoals() {
        const ctx = this.ctx;
        const goals = this.physics.goals;

        // 左ゴール（グラデーション）
        const leftGrad = ctx.createLinearGradient(0, goals.left.y, GOAL_WIDTH, goals.left.y);
        leftGrad.addColorStop(0, 'rgba(255, 100, 100, 0.8)');
        leftGrad.addColorStop(1, 'rgba(255, 100, 100, 0.2)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, goals.left.y, GOAL_WIDTH, GOAL_HEIGHT);

        // 右ゴール
        const rightGrad = ctx.createLinearGradient(TOTAL_WIDTH - GOAL_WIDTH, goals.right.y, TOTAL_WIDTH, goals.right.y);
        rightGrad.addColorStop(0, 'rgba(255, 100, 100, 0.2)');
        rightGrad.addColorStop(1, 'rgba(255, 100, 100, 0.8)');
        ctx.fillStyle = rightGrad;
        ctx.fillRect(TOTAL_WIDTH - GOAL_WIDTH, goals.right.y, GOAL_WIDTH, GOAL_HEIGHT);
    }

    drawCenterLine() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 20]);
        ctx.beginPath();
        ctx.moveTo(VIRTUAL_WIDTH, 0);
        ctx.lineTo(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
        ctx.stroke();
        ctx.setLineDash([]);

        // 中央サークル
        ctx.beginPath();
        ctx.arc(VIRTUAL_WIDTH, VIRTUAL_HEIGHT / 2, 100, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawPaddle(paddle, color) {
        const ctx = this.ctx;

        // グロー効果
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;

        // パドル本体
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, PADDLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // 内側の円
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, PADDLE_RADIUS * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    drawPuck() {
        const ctx = this.ctx;
        const puck = this.physics.puck;
        const isSmashing = puck.smashTimeLeft > 0;

        // グロー効果
        ctx.shadowColor = isSmashing ? '#ff4400' : '#fff';
        ctx.shadowBlur = isSmashing ? 40 : 15;

        // パック本体
        ctx.beginPath();
        ctx.arc(puck.x, puck.y, PUCK_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isSmashing ? '#ffcc00' : '#fff';
        ctx.fill();

        // スマッシュ時のオーラ
        if (isSmashing) {
            ctx.beginPath();
            ctx.arc(puck.x, puck.y, PUCK_RADIUS + 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff4400';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // 内側のパターン
        ctx.beginPath();
        ctx.arc(puck.x, puck.y, PUCK_RADIUS * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.shadowBlur = 0;
    }

    handleSmashEffect(x, y) {
        this.effectManager.spawnExplosion(x, y, '#ff4400', true);
    }

    updateScoreDisplay() {
        if (!this.isHost) {
            document.getElementById('score-display').style.visibility = 'hidden';
            return;
        }
        document.getElementById('score-display').style.visibility = 'visible';

        const scores = this.physics.scores;
        document.getElementById('my-score').textContent =
            this.mySide === 'left' ? scores.left : scores.right;
        document.getElementById('opponent-score').textContent =
            this.mySide === 'left' ? scores.right : scores.left;
    }

    checkWin() {
        const scores = this.physics.scores;
        if (scores.left >= this.winScore || scores.right >= this.winScore) {
            this.isRunning = false;

            // どちらが勝ったか（left=ホスト、right=ゲスト）
            const winnerSide = scores.left >= this.winScore ? 'left' : 'right';
            const isWinner = winnerSide === this.mySide;

            const overlay = document.getElementById('result-overlay');
            const resultTitle = document.getElementById('result-title');
            const resultMessage = document.getElementById('result-message');

            resultTitle.textContent = isWinner ? 'YOU WIN!' : 'You Lose...';
            resultMessage.textContent = `${scores.left} - ${scores.right}`;

            overlay.classList.remove('hidden');
        }
    }

    stop() {
        this.isRunning = false;
    }

    handleGoalEffect(goalSide) {
        // goalSide は「ゴールされた側」。エフェクトはゴール位置（左右端）に出す
        // leftゴールにパックが入った（＝右プレイヤーの得点）

        const isLeftGoal = goalSide === 'left';
        const x = isLeftGoal ? GOAL_WIDTH : TOTAL_WIDTH - GOAL_WIDTH;
        const y = (VIRTUAL_HEIGHT / 2); // ゴール中央

        // パーティクル発生
        this.effectManager.spawnExplosion(x, y, isLeftGoal ? '#ff4444' : '#4444ff');

        // 文字演出
        this.effectManager.triggerGoalAnimation();
    }
}

// ===== UI Controller =====
const game = new Game();

document.addEventListener('DOMContentLoaded', () => {
    const connectionScreen = document.getElementById('connection-screen');
    const gameScreen = document.getElementById('game-screen');
    const hostBtn = document.getElementById('host-btn');
    const guestBtn = document.getElementById('guest-btn');
    const hostUI = document.getElementById('host-ui');
    const guestUI = document.getElementById('guest-ui');
    const statusEl = document.getElementById('connection-status');
    const resetBtn = document.getElementById('reset-btn');

    // リセット（戻る）ボタン
    resetBtn.addEventListener('click', () => {
        location.reload();
    });

    document.getElementById('restart-game-btn').addEventListener('click', () => {
        location.reload();
    });

    // ミュートボタンの制御
    const muteToggle = document.getElementById('mute-toggle');
    if (muteToggle) muteToggle.style.display = 'none';

    // ===== ホストとして開始 =====
    hostBtn.addEventListener('click', async () => {
        hostBtn.disabled = true;
        guestBtn.disabled = true;
        statusEl.textContent = 'ルームID生成中...';
        statusEl.className = 'status connecting';

        try {
            const roomId = await connectionManager.initHost();
            document.getElementById('my-room-id').textContent = roomId;
            hostUI.classList.remove('hidden');
            resetBtn.classList.remove('hidden');

            // 待機中スピナー表示
            document.getElementById('host-loading').classList.remove('hidden');
            statusEl.textContent = 'ゲストの接続を待っています...';
        } catch (e) {
            console.error(e);
            statusEl.textContent = 'エラー: ' + e.message;
            statusEl.className = 'status error';
            hostBtn.disabled = false;
            guestBtn.disabled = false;
        }
    });

    // ===== ゲストとして参加 =====
    guestBtn.addEventListener('click', () => {
        hostBtn.disabled = true;
        guestBtn.disabled = true;
        guestUI.classList.remove('hidden');
        resetBtn.classList.remove('hidden');
        statusEl.textContent = 'ルームIDを入力してください';
    });

    // ===== ゲスト: IDで接続 =====
    document.getElementById('connect-btn').addEventListener('click', async () => {
        const paramsInput = document.getElementById('room-id-input');
        const roomId = paramsInput.value.trim();

        if (roomId.length !== 4 || !/^\d+$/.test(roomId)) {
            statusEl.textContent = '4桁の数字を入力してください';
            statusEl.className = 'status error';
            return;
        }

        statusEl.textContent = '接続中...';
        statusEl.className = 'status connecting';
        document.getElementById('connect-btn').disabled = true;

        try {
            await connectionManager.connectToHost(roomId);
            statusEl.textContent = 'ホストに接続中...';
        } catch (e) {
            console.error(e);
            statusEl.textContent = '接続失敗: ' + e.message;
            statusEl.className = 'status error';
            document.getElementById('connect-btn').disabled = false;
        }
    });

    // ===== 接続成功時 =====
    connectionManager.onConnected = () => {
        statusEl.textContent = '接続完了!';
        statusEl.className = 'status connected';

        // UI切り替え
        setTimeout(() => {
            connectionScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            game.init(connectionManager.isHost);

            // 少し待ってから開始
            setTimeout(() => game.start(), 1000);
        }, 500);
    };

    // 切断時
    connectionManager.onDisconnected = () => {
        if (!game.isRunning) return;
        game.stop();
        const msg = document.getElementById('game-message');
        msg.textContent = '接続が切断されました';
        msg.classList.remove('hidden');

        setTimeout(() => {
            location.reload();
        }, 3000);
    };
});
