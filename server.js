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
//   players: { ... },
//   corePosition: 50,
//   winner: null,
//   settings: { targetWins: 3 },
//   stats: { winsA: 0, winsB: 0, currentRound: 1 }
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
            winner: null,
            settings: { targetWins: 3 },
            stats: { winsA: 0, winsB: 0, currentRound: 1 }
        };

        // Host joins as Unassigned first
        rooms[roomId].players[socket.id] = {
            id: socket.id,
            username: username || "Host",
            team: 'unassigned',
            score: 0
        };

        socket.join(roomId);
        socket.emit('room_created', { roomId, isHost: true });

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

    // 3. Join Lobby
    socket.on('join_lobby', ({ roomId, username, team }) => {
        const room = rooms[roomId];
        if (!room) return;

        if (room.status !== 'LOBBY') {
            socket.emit('error_msg', "Game already started!");
            return;
        }

        const targetTeam = team || 'unassigned';

        // Check Team Cap (10)
        if (targetTeam !== 'unassigned') {
            const teamCount = Object.values(room.players).filter(p => p.team === targetTeam).length;
            if (teamCount >= 10) {
                socket.emit('error_msg', `Team ${targetTeam} is full!`);
                return;
            }
        }

        // Register Player
        room.players[socket.id] = {
            id: socket.id,
            username: username || `Soldier-${socket.id.substr(0, 4)}`,
            team: targetTeam,
            score: 0
        };

        socket.join(roomId);
        io.to(roomId).emit('lobby_update', getLobbyState(room));
    });

    // --- ADMIN CONTROLS ---

    // Host moves a player
    socket.on('admin_move_player', ({ roomId, targetId, team }) => {
        const room = rooms[roomId];
        if (!room || socket.id !== room.hostId) return; // Host only

        const targetPlayer = room.players[targetId];
        if (targetPlayer) {
            targetPlayer.team = team;
            io.to(roomId).emit('lobby_update', getLobbyState(room));
        }
    });

    // Host updates settings
    socket.on('update_settings', ({ roomId, targetWins }) => {
        const room = rooms[roomId];
        if (!room || socket.id !== room.hostId) return;

        if (targetWins > 0) {
            room.settings.targetWins = targetWins;
            io.to(roomId).emit('lobby_update', getLobbyState(room));
        }
    });

    // 4. Start Game (Host Only)
    socket.on('start_game', (roomId) => {
        const room = rooms[roomId];
        if (!room) return;
        if (socket.id !== room.hostId) return;

        const players = Object.values(room.players);
        const countA = players.filter(p => p.team === 'A').length;
        const countB = players.filter(p => p.team === 'B').length;

        if (countA === 0 || countB === 0) {
            socket.emit('error_msg', "Need players in both teams!");
            return;
        }

        startRound(room);
    });

    // 5. Game Action
    socket.on('click_action', ({ roomId, clicks }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'PLAYING') return;

        const player = room.players[socket.id];
        if (!player || player.team === 'unassigned') return;

        player.score += clicks;

        const direction = (player.team === 'A') ? -1 : 1;
        const impact = (clicks * 0.2);

        room.corePosition += (impact * direction);

        if (room.corePosition < 0) room.corePosition = 0;
        if (room.corePosition > 100) room.corePosition = 100;

        io.to(roomId).emit('game_update', {
            corePosition: room.corePosition,
            activePower: clicks * 10
        });

        // Win Condition
        if (room.corePosition <= 0) {
            handleRoundEnd(room, 'A');
        } else if (room.corePosition >= 100) {
            handleRoundEnd(room, 'B');
        }
    });

    socket.on('disconnect', () => {
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
        teamB: players.filter(p => p.team === 'B'),
        settings: room.settings,
        stats: room.stats
    };
}

function startRound(room) {
    room.status = 'PLAYING';
    room.corePosition = 50;

    // Do NOT reset accumulated scores if tracking MVP across match?
    // User probably wants Round Score vs Match Score.
    // For MVP simplicity, let's keep accumulating score across rounds.
    // Or reset? Usually "Round" implies fresh start.
    // Let's reset scores specifically for the round to make it fair?
    // Detailed plan didn't specify. Assuming "Match Leaderboard" -> Accumulate.
    // BUT "MVP" on game over screen implies visual feedback.

    // Let's keep score accumulating for "Match" leaderboard.

    io.to(room.id).emit('game_started', {
        stats: room.stats,
        settings: room.settings
    });
    console.log(`Round ${room.stats.currentRound} started in Room ${room.id}`);
}

function handleRoundEnd(room, winnerTeam) {
    room.status = 'ROUND_OVER';

    if (winnerTeam === 'A') room.stats.winsA++;
    else room.stats.winsB++;

    // Check Match Win
    if (room.stats.winsA >= room.settings.targetWins || room.stats.winsB >= room.settings.targetWins) {
        endMatch(room, winnerTeam);
    } else {
        // Just Round Over
        const cooldown = 5; // Seconds
        io.to(room.id).emit('round_over', {
            winner: winnerTeam,
            stats: room.stats,
            cooldown: cooldown
        });

        // Auto-start next round after delay
        setTimeout(() => {
            if (room.status === 'ROUND_OVER') { // Check if not disconnected/interrupted
                room.stats.currentRound++;
                startRound(room);
            }
        }, cooldown * 1000);
    }
}

function endMatch(room, finalWinner) {
    room.status = 'ENDED';
    const sortedPlayers = Object.values(room.players).sort((a, b) => b.score - a.score);

    io.to(room.id).emit('game_over', {
        winner: finalWinner,
        leaderboard: sortedPlayers,
        stats: room.stats
    });

    // Reset stats for next match if they stay in room?
    // For now, they must recreate/reload to reset fully.
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
