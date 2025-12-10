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
//      "socketId": { username: "Player1", team: "unassigned" | "A" | "B", score: 0 }
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

        // Host joins as Unassigned first
        rooms[roomId].players[socket.id] = {
            username: username || "Host",
            team: 'unassigned',
            score: 0
        };

        socket.join(roomId);
        socket.emit('room_created', { roomId, isHost: true });

        // Immediate Update
        io.to(roomId).emit('lobby_update', getLobbyState(rooms[roomId]));
        console.log(`Room ${roomId} created by ${username}`);
    });

    // 2. Check Room
    socket.on('check_room', (roomId) => {
        if (rooms[roomId]) {
            socket.emit('room_found', roomId);
        } else {
            socket.emit('error_msg', "Room not found.");
        }
    });

    // 3. Join Lobby (Enter Name & Pick Team)
    // Now call join_lobby with team=null/unassigned initially
    socket.on('join_lobby', ({ roomId, username, team }) => {
        const room = rooms[roomId];
        if (!room) return;

        if (room.status !== 'LOBBY') {
            socket.emit('error_msg', "Game already started!");
            return;
        }

        const targetTeam = team || 'unassigned';

        // Check Team Cap (10) - Only if joining a specific team
        if (targetTeam !== 'unassigned') {
            const teamCount = Object.values(room.players).filter(p => p.team === targetTeam).length;
            if (teamCount >= 10) {
                socket.emit('error_msg', `Team ${targetTeam} is full!`);
                return;
            }
        }

        // Register/Update Player
        room.players[socket.id] = {
            username: username || `Soldier-${socket.id.substr(0, 4)}`,
            team: targetTeam,
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

        // Check availability
        const players = Object.values(room.players);
        const countA = players.filter(p => p.team === 'A').length;
        const countB = players.filter(p => p.team === 'B').length;

        if (countA === 0 || countB === 0) {
            socket.emit('error_msg', "Need players in both teams!");
            return;
        }

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
        // Only assigned players can play
        if (!player || player.team === 'unassigned') return;

        player.score += clicks;

        // Apply Logic
        // Team A (Cyan) pulls LEFT (-), Team B (Magenta) pulls RIGHT (+)
        const direction = (player.team === 'A') ? -1 : 1;
        const impact = (clicks * 0.1);

        room.corePosition += (impact * direction);

        // Clamp
        if (room.corePosition < 0) room.corePosition = 0;
        if (room.corePosition > 100) room.corePosition = 100;

        // Broadcast State
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
                break;
            }
        }
    });
});

function getLobbyState(room) {
    const players = Object.values(room.players);
    return {
        unassigned: players.filter(p => p.team === 'unassigned'),
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
