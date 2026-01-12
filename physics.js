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
const MAX_SPEED_MULTIPLIER = 1.6; // 最大速度倍率
const SPEED_DECAY = 0.985; // 速度の減衰率（1フレームごとの掛け合わせ）
const WALL_BOUNCE = 1.0; // 壁の反射係数（減衰なし）

class PhysicsEngine {
    constructor() {
        this.puck = {
            x: TOTAL_WIDTH / 2,
            y: VIRTUAL_HEIGHT / 2,
            vx: 0,
            vy: 0,
            radius: PUCK_RADIUS
        };

        this.paddles = {
            left: { x: 200, y: VIRTUAL_HEIGHT / 2, radius: PADDLE_RADIUS },
            right: { x: TOTAL_WIDTH - 200, y: VIRTUAL_HEIGHT / 2, radius: PADDLE_RADIUS }
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

        // 速度の制御
        const currentSpeed = Math.sqrt(this.puck.vx ** 2 + this.puck.vy ** 2);

        if (currentSpeed > BASE_SPEED) {
            // 基本速度を超えている場合は徐々に減衰させる
            this.puck.vx *= SPEED_DECAY;
            this.puck.vy *= SPEED_DECAY;

            // 減衰しすぎて基本速度を下回らないように補正
            const newSpeed = Math.sqrt(this.puck.vx ** 2 + this.puck.vy ** 2);
            if (newSpeed < BASE_SPEED) {
                const ratio = BASE_SPEED / newSpeed;
                this.puck.vx *= ratio;
                this.puck.vy *= ratio;
            }
        } else if (currentSpeed > 0.1 && currentSpeed < BASE_SPEED) {
            // 基本速度を下回っている場合は基本速度に引き上げる
            const ratio = BASE_SPEED / currentSpeed;
            this.puck.vx *= ratio;
            this.puck.vy *= ratio;
        } else if (currentSpeed <= 0.1) {
            // 止まっている場合は強制的に動きを与える
            this.puck.vx = BASE_SPEED;
            this.puck.vy = 0;
        }

        return { wallHit, paddleHit, goalSide };
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
            const dx = this.puck.x - paddle.x;
            const dy = this.puck.y - paddle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = PUCK_RADIUS + PADDLE_RADIUS;

            if (dist < minDist) {
                // 衝突応答

                // 法線ベクトル (パドル中心 -> パック中心)
                let nx, ny;
                if (dist === 0) {
                    // 完全に重なった場合はランダムに弾く
                    nx = 1;
                    ny = 0;
                } else {
                    nx = dx / dist;
                    ny = dy / dist;
                }

                // 押し出し（めり込み解消）
                // 少し余裕を持って押し出す (+1.0)
                const overlap = minDist - dist + 1.0;
                this.puck.x += nx * overlap;
                this.puck.y += ny * overlap;

                // 反射ベクトル計算
                // 速度成分のうち、法線方向の成分を反転させる
                const dotProduct = this.puck.vx * nx + this.puck.vy * ny;

                // パックがパドルに向かって進んでいる場合のみ反射処理を行う
                // (すでに離れようとしている場合は処理しない＝二重衝突防止)
                if (dotProduct < 0) {
                    this.puck.vx = this.puck.vx - 2 * dotProduct * nx;
                    this.puck.vy = this.puck.vy - 2 * dotProduct * ny;

                    // 速度ブースト：基本速度の1.6倍まで加速
                    const currentSpeed = Math.sqrt(this.puck.vx ** 2 + this.puck.vy ** 2);
                    const targetSpeed = Math.min(BASE_SPEED * MAX_SPEED_MULTIPLIER, currentSpeed + BASE_SPEED * 0.4);

                    const boostRatio = targetSpeed / currentSpeed;
                    this.puck.vx *= boostRatio;
                    this.puck.vy *= boostRatio;

                    hit = side;
                }

                // ここで速度加算（this.puck.vx += ...）は行わない。
                // 速度はupdateの最後でCONST_SPEEDに正規化されるため、
                // 重要なのは「方向」だけを変えること。
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
