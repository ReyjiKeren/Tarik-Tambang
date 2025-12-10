class NetworkManager {
    constructor() {
        this.peer = null;
        this.channel = null;
        this.isHost = false;
        this.socket = null;
        this.roomId = null;

        // Public STUN servers
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.onConnect = null;
        this.onData = null;
        this.onRoomCreated = null; // Callback to show ID to host
    }

    init(mode) {
        this.isHost = (mode === 'host');

        try {
            this.socket = io(); // Connect to Replit server
        } catch (e) {
            console.error("Socket.io not found. Run on server!", e);
            alert("Error: Server not found. Are you running via node server.js?");
            return;
        }

        // --- Socket Events ---

        this.socket.on('connect', () => {
            console.log("Connected to server via Socket.io");
            if (this.isHost) {
                this.socket.emit('create_room');
            }
        });

        this.socket.on('room_created', (id) => {
            this.roomId = id;
            if (this.onRoomCreated) this.onRoomCreated(id);
        });

        this.socket.on('error_msg', (msg) => {
            alert(msg);
            window.location.href = 'index.html';
        });

        // For Joiner
        this.socket.on('joined_success', (id) => {
            this.roomId = id;
            console.log("Joined room:", id);
            // Wait for Offer from Host
        });

        // For Host: Player joined, start WebRTC Offer
        this.socket.on('player_joined', (id) => {
            console.log("Player joined! Initiating WebRTC...");
            this.startWebRTC(true); // Initiator
        });

        // Signaling Relay
        this.socket.on('signal', async (signal) => {
            if (!this.peer) this.startWebRTC(false);

            try {
                if (signal.type === 'offer') {
                    await this.peer.setRemoteDescription(signal);
                    const answer = await this.peer.createAnswer();
                    await this.peer.setLocalDescription(answer);
                    this.socket.emit('signal', { roomId: this.roomId, signal: this.peer.localDescription });
                } else if (signal.type === 'answer') {
                    await this.peer.setRemoteDescription(signal);
                } else if (signal.candidate) {
                    await this.peer.addIceCandidate(signal.candidate);
                }
            } catch (err) {
                console.error("Signaling Error", err);
            }
        });
    }

    joinRoom(id) {
        this.socket.emit('join_room', id);
    }

    startWebRTC(isInitiator) {
        this.peer = new RTCPeerConnection(this.config);

        this.peer.onicecandidate = (e) => {
            if (e.candidate) {
                this.socket.emit('signal', {
                    roomId: this.roomId,
                    signal: { candidate: e.candidate }
                }); // Send ICE candidates as they come
            }
        };

        this.peer.onconnectionstatechange = () => {
            if (this.peer.connectionState === 'connected') {
                if (this.onConnect) this.onConnect();
            }
        };

        if (isInitiator) {
            this.channel = this.peer.createDataChannel("game");
            this.setupChannel(this.channel);

            this.peer.createOffer()
                .then(offer => this.peer.setLocalDescription(offer))
                .then(() => {
                    this.socket.emit('signal', { roomId: this.roomId, signal: this.peer.localDescription });
                });
        } else {
            this.peer.ondatachannel = (e) => {
                this.channel = e.channel;
                this.setupChannel(this.channel);
            };
        }
    }

    setupChannel(chan) {
        chan.onopen = () => console.log("DataChannel Open");
        chan.onmessage = (e) => {
            if (this.onData) this.onData(JSON.parse(e.data));
        };
    }

    send(data) {
        if (this.channel && this.channel.readyState === 'open') {
            this.channel.send(JSON.stringify(data));
        }
    }
}

window.Network = new NetworkManager();
