/**
 * Physics Engine - 物理演算・衝突判定
 */

// 論理座標系（仮想解像度）
const VIRTUAL_WIDTH = 1920;  // 1画面分
const VIRTUAL_HEIGHT = 1080;
const TOTAL_WIDTH = VIRTUAL_WIDTH * 2;  // 2画面分

// ゲームオブジェクトサイズ
const PUCK_RADIUS = 30;
const PADDLE_RADIUS = 70;
const GOAL_WIDTH = 20;
const GOAL_HEIGHT = 300;

// 物理定数
const BASE_SPEED = 20; // 基本速度（これより遅くならない）
const MAX_SPEED_MULTIPLIER = 1.6; // 通常の最大速度倍率
const SMASH_SPEED_MULTIPLIER = 2.0; // スマッシュ時の速度倍率
const SPEED_DECAY = 0.985; // 通常の速度減衰率
const SMASH_DECAY = 0.995; // スマッシュ時の緩やかな減衰率
const WALL_BOUNCE = 1.0; // 壁の反射係数（減衰なし）

const SMASH_PADDLE_THRESHOLD = 120; // スマッシュが発生するパドル速度の閾値（難易度調整のため引き上げ）
const SMASH_DURATION = 1.0; // スマッシュの持続時間（秒）
class PhysicsEngine {
    constructor() {
        this.puck = {
            x: TOTAL_WIDTH / 2,
            y: VIRTUAL_HEIGHT / 2,
            vx: 0,
            vy: 0,
            radius: PUCK_RADIUS,
            smashTimeLeft: 0
        };

        this.paddles = {
            left: { x: 200, y: VIRTUAL_HEIGHT / 2, lastX: 200, lastY: VIRTUAL_HEIGHT / 2, radius: PADDLE_RADIUS },
            right: { x: TOTAL_WIDTH - 200, y: VIRTUAL_HEIGHT / 2, lastX: TOTAL_WIDTH - 200, lastY: TOTAL_WIDTH - 200, radius: PADDLE_RADIUS }
        };

        this.goals = {
            left: { x: 0, y: (VIRTUAL_HEIGHT - GOAL_HEIGHT) / 2, width: GOAL_WIDTH, height: GOAL_HEIGHT },
            right: { x: TOTAL_WIDTH - GOAL_WIDTH, y: (VIRTUAL_HEIGHT - GOAL_HEIGHT) / 2, width: GOAL_WIDTH, height: GOAL_HEIGHT }
        };

        this.scores = { left: 0, right: 0 };
        this.lastGoalSide = null;
    }

    update(deltaTime) {
        // 位置更新
        this.puck.x += this.puck.vx;
        this.puck.y += this.puck.vy;

        // 衝突判定 & 補正
        // パドル衝突を先に判定（壁に押し付けられるケース対応）
        const paddleHit = this.checkPaddleCollision();
        const wallHit = this.checkWallCollision(); // パドルで押し出された後に壁判定
        const goalSide = this.checkGoal();

        // スマッシュ持続時間の更新
        if (this.puck.smashTimeLeft > 0) {
            this.puck.smashTimeLeft = Math.max(0, this.puck.smashTimeLeft - deltaTime);
        }

        // 速度の制御
        const currentSpeed = Math.sqrt(this.puck.vx ** 2 + this.puck.vy ** 2);
        const isSmashing = this.puck.smashTimeLeft > 0;
        const targetMinSpeed = isSmashing ? BASE_SPEED * SMASH_SPEED_MULTIPLIER : BASE_SPEED;
        const decayRate = isSmashing ? SMASH_DECAY : SPEED_DECAY;

        if (currentSpeed > targetMinSpeed) {
            this.puck.vx *= decayRate;
            this.puck.vy *= decayRate;

            const newSpeed = Math.sqrt(this.puck.vx ** 2 + this.puck.vy ** 2);
            if (newSpeed < targetMinSpeed) {
                const ratio = targetMinSpeed / newSpeed;
                this.puck.vx *= ratio;
                this.puck.vy *= ratio;
            }
        } else if (currentSpeed > 0.1 && currentSpeed < targetMinSpeed) {
            const ratio = targetMinSpeed / currentSpeed;
            this.puck.vx *= ratio;
            this.puck.vy *= ratio;
        } else if (currentSpeed <= 0.1) {
            this.puck.vx = targetMinSpeed;
            this.puck.vy = 0;
        }

        // パドルの前回位置を更新（次のフレームのCCD用）
        this.paddles.left.lastX = this.paddles.left.x;
        this.paddles.left.lastY = this.paddles.left.y;
        this.paddles.right.lastX = this.paddles.right.x;
        this.paddles.right.lastY = this.paddles.right.y;

        return { wallHit, paddleHit, goalSide, isSmash: isSmashing };
    }

    checkWallCollision() {
        let hit = false;

        // 上下の壁
        if (this.puck.y - PUCK_RADIUS < 0) {
            this.puck.y = PUCK_RADIUS;
            this.puck.vy = Math.abs(this.puck.vy); // 確実に下向きにする
            hit = true;
        }
        if (this.puck.y + PUCK_RADIUS > VIRTUAL_HEIGHT) {
            this.puck.y = VIRTUAL_HEIGHT - PUCK_RADIUS;
            this.puck.vy = -Math.abs(this.puck.vy); // 確実に上向きにする
            hit = true;
        }

        // 左右の壁（ゴール部分を除く）
        const goalTop = this.goals.left.y;
        const goalBottom = this.goals.left.y + GOAL_HEIGHT;

        // 左壁
        if (this.puck.x - PUCK_RADIUS < GOAL_WIDTH) {
            if (this.puck.y < goalTop || this.puck.y > goalBottom) {
                this.puck.x = GOAL_WIDTH + PUCK_RADIUS;
                this.puck.vx = Math.abs(this.puck.vx); // 確実に右向きにする
                hit = true;
            }
        }

        // 右壁
        if (this.puck.x + PUCK_RADIUS > TOTAL_WIDTH - GOAL_WIDTH) {
            if (this.puck.y < goalTop || this.puck.y > goalBottom) {
                this.puck.x = TOTAL_WIDTH - GOAL_WIDTH - PUCK_RADIUS;
                this.puck.vx = -Math.abs(this.puck.vx); // 確実に左向きにする
                hit = true;
            }
        }

        return hit;
    }

    checkPaddleCollision() {
        let hit = null;

        for (const [side, paddle] of Object.entries(this.paddles)) {
            // CCD: パドルの移動軌跡(線分)とパックの距離
            const ax = paddle.lastX;
            const ay = paddle.lastY;
            const bx = paddle.x;
            const by = paddle.y;
            const px = this.puck.x;
            const py = this.puck.y;

            const bax = bx - ax;
            const bay = by - ay;
            const pax = px - ax;
            const pay = py - ay;

            let t = (pax * bax + pay * bay) / (bax * bax + bay * bay);
            if (isNaN(t)) t = 0;
            t = Math.max(0, Math.min(1, t));

            const closestX = ax + bax * t;
            const closestY = ay + bay * t;

            const dx = px - closestX;
            const dy = py - closestY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = PUCK_RADIUS + PADDLE_RADIUS;

            if (dist < minDist) {
                // パドルの速度
                const pvx = bx - ax;
                const pvy = by - ay;

                // 法線
                let nx, ny;
                if (dist < 0.1) {
                    nx = 1; ny = 0;
                } else {
                    nx = dx / dist;
                    ny = dy / dist;
                }

                // 現時点での相対速度
                const rvx = this.puck.vx - pvx;
                const rvy = this.puck.vy - pvy;

                // 相対速度がパドルに向かっている場合のみ反射
                const relDot = rvx * nx + rvy * ny;

                if (relDot < 0) {
                    // 反射 (相対速度を法線基準で反転)
                    const rvx_prime = rvx - 2 * relDot * nx;
                    const rvy_prime = rvy - 2 * relDot * ny;

                    // パックの新しい速度 = 反射した相対速度 + パドルの速度
                    this.puck.vx = rvx_prime + pvx;
                    this.puck.vy = rvy_prime + pvy;

                    // 押し出し
                    const overlap = minDist - dist + 2.0;
                    this.puck.x += nx * overlap;
                    this.puck.y += ny * overlap;

                    // スマッシュ判定：パドルの速度が閾値を超えているか
                    const paddleSpeed = Math.sqrt(pvx ** 2 + pvy ** 2);
                    if (paddleSpeed > SMASH_PADDLE_THRESHOLD) {
                        this.puck.smashTimeLeft = SMASH_DURATION;

                        // スマッシュ速度へ即座にブースト
                        const speed = Math.sqrt(this.puck.vx ** 2 + this.puck.vy ** 2);
                        const targetSpeed = BASE_SPEED * SMASH_SPEED_MULTIPLIER;
                        this.puck.vx = (this.puck.vx / speed) * targetSpeed;
                        this.puck.vy = (this.puck.vy / speed) * targetSpeed;
                    } else {
                        this.puck.smashTimeLeft = 0; // 通常ヒットで上書き
                        // 速度ブースト (最低速度保証含む)
                        const speed = Math.sqrt(this.puck.vx ** 2 + this.puck.vy ** 2);
                        const targetSpeed = Math.max(BASE_SPEED, Math.min(BASE_SPEED * MAX_SPEED_MULTIPLIER, speed + BASE_SPEED * 0.3));
                        const ratio = targetSpeed / speed;
                        this.puck.vx *= ratio;
                        this.puck.vy *= ratio;
                    }

                    hit = side;
                }
            }
        }

        return hit;
    }

    checkGoal() {
        const goalTop = this.goals.left.y;
        const goalBottom = this.goals.left.y + GOAL_HEIGHT;

        // 左ゴール（右プレイヤーの得点）
        if (this.puck.x < 0 && this.puck.y >= goalTop && this.puck.y <= goalBottom) {
            this.scores.right++;
            this.lastGoalSide = 'left';
            this.resetPuck('left');
            return 'left';
        }

        // 右ゴール（左プレイヤーの得点）
        if (this.puck.x > TOTAL_WIDTH && this.puck.y >= goalTop && this.puck.y <= goalBottom) {
            this.scores.left++;
            this.lastGoalSide = 'right';
            this.resetPuck('right');
            return 'right';
        }

        return null;
    }

    resetPuck(scoredGoalSide) {
        // ゴールされた側の中央にパックを配置
        if (scoredGoalSide === 'left') {
            this.puck.x = VIRTUAL_WIDTH / 2;
        } else {
            this.puck.x = VIRTUAL_WIDTH + VIRTUAL_WIDTH / 2;
        }

        this.puck.y = VIRTUAL_HEIGHT / 2;
        this.puck.vy = 0;

        // ゴールされた側から相手側に向かって発射する
        if (scoredGoalSide === 'left') {
            this.puck.vx = BASE_SPEED; // 左ゴールされたので、右へ
        } else {
            this.puck.vx = -BASE_SPEED; // 右ゴールされたので、左へ
        }
    }

    updatePaddle(side, x, y) {
        const paddle = this.paddles[side];
        if (!paddle) return;

        // パドルの移動範囲を制限
        const minX = side === 'left' ? PADDLE_RADIUS + GOAL_WIDTH : VIRTUAL_WIDTH + PADDLE_RADIUS + GOAL_WIDTH;
        const maxX = side === 'left' ? VIRTUAL_WIDTH - PADDLE_RADIUS : TOTAL_WIDTH - PADDLE_RADIUS - GOAL_WIDTH;

        paddle.x = Math.max(minX, Math.min(maxX, x));
        paddle.y = Math.max(PADDLE_RADIUS, Math.min(VIRTUAL_HEIGHT - PADDLE_RADIUS, y));
    }

    getState() {
        return {
            puck: { ...this.puck },
            paddles: {
                left: { ...this.paddles.left },
                right: { ...this.paddles.right }
            },
            scores: { ...this.scores }
        };
    }

    setState(state) {
        if (state.puck) {
            this.puck = { ...this.puck, ...state.puck };
        }
        if (state.paddles) {
            if (state.paddles.left) this.paddles.left = { ...this.paddles.left, ...state.paddles.left };
            if (state.paddles.right) this.paddles.right = { ...this.paddles.right, ...state.paddles.right };
        }
        if (state.scores) {
            this.scores = { ...state.scores };
        }
    }
}
