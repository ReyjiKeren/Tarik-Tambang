const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

// Serve static files
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Game Rooms State
// { 
//   roomId: { 
//      teamA: [socketId, ...], 
//      teamB: [socketId, ...], 
//      corePosition: 50,
//      winner: null 
//   } 
// }
const rooms = {};

function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Create Room
    socket.on('create_room', () => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            teamA: [],
            teamB: [],
            corePosition: 50,
            winner: null
        };
        // Host doesn't automatically join a team, they must choose in UI
        socket.emit('room_created', roomId);
        console.log(`Room ${roomId} created`);
    });

    // Join Team
    socket.on('join_team', ({ roomId, team }) => {
        const room = rooms[roomId];

        if (!room) {
            socket.emit('error_msg', "Room not found.");
            return;
        }

        // Check if full (10 per team)
        const targetArray = team === 'A' ? room.teamA : room.teamB;
        if (targetArray.length >= 10) {
            socket.emit('error_msg', `Team ${team} is Full (Max 10)!`);
            return;
        }

        // Join
        socket.join(roomId);
        targetArray.push(socket.id);

        // Notify success
        socket.emit('joined_success', { roomId, team });

        // Broadcast Update to everyone in room
        io.to(roomId).emit('player_update', {
            countA: room.teamA.length,
            countB: room.teamB.length
        });

        console.log(`${socket.id} joined Room ${roomId} Team ${team}`);
    });

    // Game Logic: Pull
    socket.on('pull', ({ roomId, force, team }) => {
        const room = rooms[roomId];
        if (!room || room.winner) return;

        // Direction: Team A pulls NEGATIVE (Left/0), Team B pulls POSITIVE (Right/100)
        const direction = (team === 'A') ? -1 : 1;
        const impact = (force / 100) * 0.5; // Balancer multiplier

        room.corePosition += (impact * direction);

        // Clamp
        if (room.corePosition < 0) room.corePosition = 0;
        if (room.corePosition > 100) room.corePosition = 100;

        // Broadcast State
        io.to(roomId).emit('game_update', {
            corePosition: room.corePosition,
            activePower: force // For visual shake
        });

        // Win Check
        if (room.corePosition <= 0) {
            room.winner = 'A';
            io.to(roomId).emit('game_over', { winner: 'A' });
        } else if (room.corePosition >= 100) {
            room.winner = 'B';
            io.to(roomId).emit('game_over', { winner: 'B' });
        }
    });

    socket.on('disconnect', () => {
        // Find room and remove player
        for (const id in rooms) {
            const r = rooms[id];
            if (r.teamA.includes(socket.id)) {
                r.teamA = r.teamA.filter(pid => pid !== socket.id);
                io.to(id).emit('player_update', { countA: r.teamA.length, countB: r.teamB.length });
            } else if (r.teamB.includes(socket.id)) {
                r.teamB = r.teamB.filter(pid => pid !== socket.id);
                io.to(id).emit('player_update', { countA: r.teamA.length, countB: r.teamB.length });
            }
            // Logic to delete empty room could be added here
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
