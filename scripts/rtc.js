class NetworkManager {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.username = null;
        this.myTeam = null;

        // Callbacks
        this.onRoomCreated = null;
        this.onRoomFound = null;
        this.onLobbyUpdate = null; // { teamA: [], teamB: [] }
        this.onGameStarted = null;
        this.onGameUpdate = null;   // { corePosition, activePower }
        this.onGameOver = null;     // { winner, leaderboard }
        this.onRoundOver = null;    // New: { winner, stats }
        this.onError = null;        // msg
    }

    init() {
        try {
            this.socket = io();
        } catch (e) {
            console.error("Socket.io missing", e);
            if (this.onError) this.onError("Server connection failed!");
            return;
        }

        // --- Socket Events ---
        this.socket.on('connect', () => {
            console.log("Connected to server");
        });

        this.socket.on('room_created', (data) => {
            this.roomId = data.roomId;
            if (this.onRoomCreated) this.onRoomCreated(data.roomId);
        });

        this.socket.on('room_found', (id) => {
            if (this.onRoomFound) this.onRoomFound(id);
        });

        this.socket.on('lobby_update', (data) => {
            if (this.onLobbyUpdate) this.onLobbyUpdate(data);
        });

        this.socket.on('game_started', (data) => {
            if (this.onGameStarted) this.onGameStarted(data);
        });

        this.socket.on('error_msg', (msg) => {
            if (this.onError) this.onError(msg);
        });

        this.socket.on('game_update', (data) => {
            if (this.onGameUpdate) this.onGameUpdate(data);
        });

        this.socket.on('round_over', (data) => {
            if (this.onRoundOver) this.onRoundOver(data);
        });

        this.socket.on('game_over', (data) => {
            if (this.onGameOver) this.onGameOver(data);
        });
    }

    // Actions
    createRoom(username) {
        this.username = username;
        this.socket.emit('create_room', { username });
    }

    checkRoom(roomId) {
        this.socket.emit('check_room', roomId);
    }

    joinLobby(roomId, username, team) {
        this.roomId = roomId;
        this.username = username;
        this.myTeam = team;
        this.socket.emit('join_lobby', { roomId, username, team });
    }

    startGame() {
        if (!this.roomId) return;
        this.socket.emit('start_game', this.roomId);
    }

    sendClickSpam(clicks) {
        if (!this.roomId) return;
        this.socket.emit('click_action', { roomId: this.roomId, clicks });
    }
}

window.Network = new NetworkManager();
