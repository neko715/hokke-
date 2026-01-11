/**
 * WebRTC Connection Manager - PeerJSを使用したID接続
 */
class ConnectionManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.isConnected = false;
        this.onMessage = null;
        this.onConnected = null;
        this.onDisconnected = null;

        // PeerIDのプレフィックス（他のアプリと被らないように長めに）
        this.PREFIX = 'hokke-game-v1-';
    }

    // ホストとして初期化 (RoomID生成)
    initHost() {
        this.isHost = true;
        // 4桁のランダム数字ID生成
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        const fullId = this.PREFIX + roomId;

        console.log('Initializing host with ID:', fullId);

        // Peerオブジェクト作成
        this.peer = new Peer(fullId, {
            debug: 2
        });

        return new Promise((resolve, reject) => {
            this.peer.on('open', (id) => {
                console.log('My peer ID is: ' + id);

                // 接続待ち
                this.peer.on('connection', (conn) => {
                    console.log('Incoming connection...');
                    this.setupConnection(conn);
                });

                resolve(roomId);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                // IDが被った場合などはリトライすべきだが、今回は簡易的にエラー
                reject(err);
            });

            // タイムアウト設定（オプション）
            setTimeout(() => {
                if (!this.peer.open) reject(new Error('Connection timeout'));
            }, 10000);
        });
    }

    // ゲストとして接続
    connectToHost(roomId) {
        this.isHost = false;
        const fullId = this.PREFIX + roomId;

        console.log('Connecting to host:', fullId);

        // ゲストはID指定なし
        this.peer = new Peer({
            debug: 2
        });

        return new Promise((resolve, reject) => {
            this.peer.on('open', () => {
                const conn = this.peer.connect(fullId);

                // 接続確立待ちをconnイベントで検知
                conn.on('open', () => {
                    this.setupConnection(conn);
                    resolve();
                });

                conn.on('error', (err) => {
                    reject(err);
                });

                // connect呼び出し後のconnオブジェクト自体にエラーハンドラ等をつける
                // 数秒待ってもopenしなければエラーとみなす
                setTimeout(() => {
                    if (!conn.open) reject(new Error('Connection failed or timeout'));
                }, 5000);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                reject(err);
            });
        });
    }

    setupConnection(conn) {
        // 既存の接続があれば閉じる
        if (this.conn) {
            this.conn.close();
        }

        this.conn = conn;

        // 既にopenしている場合もあるためチェック
        if (conn.open) {
            this.handleOpen();
        } else {
            this.conn.on('open', () => this.handleOpen());
        }

        this.conn.on('data', (data) => {
            if (this.onMessage) {
                this.onMessage(data);
            }
        });

        this.conn.on('close', () => {
            this.handleClose();
        });

        this.conn.on('error', (err) => {
            console.error('Connection error:', err);
            this.handleClose();
        });
    }

    handleOpen() {
        console.log('DataConnection opened!');
        this.isConnected = true;
        if (this.onConnected) this.onConnected();
    }

    handleClose() {
        console.log('Connection closed');
        this.isConnected = false;
        if (this.onDisconnected) this.onDisconnected();
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }

    close() {
        if (this.conn) {
            this.conn.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.isConnected = false;
    }
}

const connectionManager = new ConnectionManager();
