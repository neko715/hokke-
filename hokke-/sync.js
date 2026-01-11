/**
 * Sync Manager - ゲーム状態の同期
 */
class SyncManager {
    constructor() {
        this.isHost = false;
        this.mySide = null;  // 'left' or 'right'
        this.lastSyncTime = 0;
        this.syncInterval = 1000 / 60;  // 60fps
        this.onStateReceived = null;
        this.onPaddleReceived = null;
        this.onGameEvent = null;
    }

    init(isHost) {
        this.isHost = isHost;
        this.mySide = isHost ? 'left' : 'right';

        connectionManager.onMessage = (data) => this.handleMessage(data);
    }

    handleMessage(data) {
        switch (data.type) {
            case 'state':
                // ホストからの全体状態（ゲスト用）
                if (this.onStateReceived) {
                    this.onStateReceived(data.state);
                }
                break;

            case 'paddle':
                // 相手のパドル位置
                if (this.onPaddleReceived) {
                    this.onPaddleReceived(data.side, data.x, data.y);
                }
                break;

            case 'event':
                // ゲームイベント（開始、ゴールなど）
                if (this.onGameEvent) {
                    this.onGameEvent(data.event, data.payload);
                }
                break;
        }
    }

    // ホスト：全体状態を送信
    sendState(state) {
        if (!this.isHost) return;

        connectionManager.send({
            type: 'state',
            state: state,
            timestamp: Date.now()
        });
    }

    // 自分のパドル位置を送信
    sendPaddlePosition(x, y) {
        connectionManager.send({
            type: 'paddle',
            side: this.mySide,
            x: x,
            y: y
        });
    }

    // ゲームイベントを送信
    sendGameEvent(event, payload = {}) {
        connectionManager.send({
            type: 'event',
            event: event,
            payload: payload
        });
    }

    getMySide() {
        return this.mySide;
    }

    getOpponentSide() {
        return this.mySide === 'left' ? 'right' : 'left';
    }
}

const syncManager = new SyncManager();
