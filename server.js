const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

// Serve static files
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Game Rooms State
const rooms = {};

// Helper: Generate 4-digit code
function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', () => {
        const roomId = generateRoomId();
        socket.join(roomId);
        rooms[roomId] = { host: socket.id, players: 1 };

        socket.emit('room_created', roomId);
        console.log(`Room ${roomId} created by ${socket.id}`);
    });

    socket.on('join_room', (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);

        if (!room || room.size === 0) {
            socket.emit('error_msg', "Room not found.");
            return;
        }

        if (room.size >= 2) {
            socket.emit('error_msg', "Room is full.");
            return;
        }

        socket.join(roomId);
        // Notify host that player joined, so host can start initiating WebRTC Offer
        socket.to(roomId).emit('player_joined', socket.id);

        // Notify joiner that success
        socket.emit('joined_success', roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    // Relay WebRTC Signals
    socket.on('signal', (data) => {
        // data = { roomId, signal }
        // Broadcast to everyone else in the room (the opponent)
        socket.to(data.roomId).emit('signal', data.signal);
    });

    // Relay Game Data (if we want to use Socket for game data instead of WebRTC as backup)
    // But we are sticking to WebRTC for "anti-gravity" feel (low latency).
    // However, we can use socket for "end game" or "restart" just in case.

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Pulling gravity on port ${PORT}`);
});
