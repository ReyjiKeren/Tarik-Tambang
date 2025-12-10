class NetworkManager {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.myTeam = null;

        // Callbacks
        this.onRoomCreated = null;
        this.onJoinSuccess = null;
        this.onPlayerUpdate = null; // { countA, countB }
        this.onGameUpdate = null;   // { corePosition, activePower }
        this.onGameOver = null;     // { winner }
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

        this.socket.on('room_created', (id) => {
            this.roomId = id;
            if (this.onRoomCreated) this.onRoomCreated(id);
        });

        this.socket.on('joined_success', (data) => {
            this.roomId = data.roomId;
            this.myTeam = data.team;
            console.log("Joined Team:", this.myTeam);
            if (this.onJoinSuccess) this.onJoinSuccess(data);
        });

        this.socket.on('error_msg', (msg) => {
            if (this.onError) this.onError(msg);
        });

        this.socket.on('player_update', (data) => {
            if (this.onPlayerUpdate) this.onPlayerUpdate(data);
        });

        this.socket.on('game_update', (data) => {
            if (this.onGameUpdate) this.onGameUpdate(data);
        });

        this.socket.on('game_over', (data) => {
            if (this.onGameOver) this.onGameOver(data);
        });
    }

    // Actions
    createRoom() {
        this.socket.emit('create_room');
    }

    joinTeam(roomId, team) {
        this.socket.emit('join_team', { roomId, team });
    }

    sendPullForce(force) {
        if (!this.roomId || !this.myTeam) return;
        this.socket.emit('pull', {
            roomId: this.roomId,
            force: force,
            team: this.myTeam
        });
    }
}

window.Network = new NetworkManager();
