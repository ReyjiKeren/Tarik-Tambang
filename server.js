const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Room State Structure:
// {
//   id: "1234",
//   status: "LOBBY" | "PLAYING" | "ENDED",
//   hostId: "socketId",
//   players: {
//      "socketId": { username: "Player1", team: "A", score: 0 }
//   },
//   corePosition: 50,
//   winner: null
// }
const rooms = {};

function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. Create Room (Host)
    socket.on('create_room', ({ username }) => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            id: roomId,
            status: 'LOBBY',
            hostId: socket.id,
            players: {},
            corePosition: 50,
            winner: null
        };

        // Host automatically joins but needs to pick team later? 
        // For simplicity, Host is just a manager first, or auto-assigned?
        // Let's say Host joins as a player too.
        rooms[roomId].players[socket.id] = {
            username: username || "Host",
            team: null, // Will select in lobby
            score: 0
        };

        socket.join(roomId);
        socket.emit('room_created', { roomId, isHost: true });
        console.log(`Room ${roomId} created by ${username}`);
    });

    // 2. Join Room (check existence)
    socket.on('check_room', (roomId) => {
        if (rooms[roomId]) {
            socket.emit('room_found', roomId);
        } else {
            socket.emit('error_msg', "Room not found.");
        }
    });

    // 3. Join Lobby (Enter Name & Pick Team)
    socket.on('join_lobby', ({ roomId, username, team }) => {
        const room = rooms[roomId];
        if (!room) return;

        if (room.status !== 'LOBBY') {
            socket.emit('error_msg', "Game already started!");
            return;
        }

        // Check Team Cap (10)
        const teamCount = Object.values(room.players).filter(p => p.team === team).length;
        if (teamCount >= 10) {
            socket.emit('error_msg', `Team ${team} is full!`);
            return;
        }

        // Register Player
        room.players[socket.id] = {
            username: username || `Soldier-${socket.id.substr(0, 4)}`,
            team: team,
            score: 0
        };

        socket.join(roomId);

        // Broadcast Lobby State to everyone
        io.to(roomId).emit('lobby_update', getLobbyState(room));
    });

    // 4. Start Game (Host Only)
    socket.on('start_game', (roomId) => {
        const room = rooms[roomId];
        if (!room) return;
        if (socket.id !== room.hostId) return;

        room.status = 'PLAYING';
        room.corePosition = 50;
        // Reset scores
        Object.values(room.players).forEach(p => p.score = 0);

        io.to(roomId).emit('game_started');
        console.log(`Game started in Room ${roomId}`);
    });

    // 5. Game Action (Click Spam)
    // Client sends: { roomId, clicks: 5 } (batched)
    socket.on('click_action', ({ roomId, clicks }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'PLAYING') return;

        const player = room.players[socket.id];
        if (!player) return;

        player.score += clicks;

        // Apply Logic
        // Team A (Cyan) pulls LEFT (-), Team B (Magenta) pulls RIGHT (+)
        const direction = (player.team === 'A') ? -1 : 1;
        const impact = (clicks * 0.1); // 1 click = 0.1 movement unit

        room.corePosition += (impact * direction);

        // Clamp
        if (room.corePosition < 0) room.corePosition = 0;
        if (room.corePosition > 100) room.corePosition = 100;

        // Broadcast State (Optimized: maybe not every single click, but Socket.io is fast enough for now)
        io.to(roomId).emit('game_update', {
            corePosition: room.corePosition,
            activePower: clicks * 10
        });

        // Win Condition
        if (room.corePosition <= 0 || room.corePosition >= 100) {
            endGame(room);
        }
    });

    socket.on('disconnect', () => {
        // Find room
        for (const rId in rooms) {
            const room = rooms[rId];
            if (room.players[socket.id]) {
                delete room.players[socket.id];

                if (room.status === 'LOBBY') {
                    io.to(rId).emit('lobby_update', getLobbyState(room));
                }

                // If host leaves, maybe end room? ignoring for now.
                break;
            }
        }
    });
});

function getLobbyState(room) {
    // Return lists of players for UI
    const players = Object.values(room.players);
    return {
        teamA: players.filter(p => p.team === 'A'),
        teamB: players.filter(p => p.team === 'B')
    };
}

function endGame(room) {
    room.status = 'ENDED';
    const winner = room.corePosition <= 0 ? 'A' : 'B';

    // Generate Leaderboard
    const sortedPlayers = Object.values(room.players).sort((a, b) => b.score - a.score);

    io.to(room.id).emit('game_over', {
        winner: winner,
        leaderboard: sortedPlayers
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
