document.addEventListener('DOMContentLoaded', () => {
    // Setup
    const renderer = new GameRenderer('game-canvas');
    const net = window.Network;
    const clickBatchInterval = 200; // Send clicks every 200ms

    // --- State ---
    const state = {
        username: "",
        role: null, // 'host' or 'joiner'
        gameActive: false,
        corePosition: 50,
        pendingClicks: 0,
        myTeam: 'unassigned'
    };

    // --- DOM Elements ---
    // Modals
    const mainModal = document.getElementById('main-modal');
    const toastContainer = document.getElementById('toast-container');
    const resultModal = document.getElementById('result-modal');

    // Steps
    const stepLogin = document.getElementById('step-login');
    const stepConnect = document.getElementById('step-connect');
    const stepLobby = document.getElementById('step-lobby');

    // Inputs/Buttons
    const nameInput = document.getElementById('username-input');
    const btnLogin = document.getElementById('btn-login');
    const btnConnectRoom = document.getElementById('btn-connect-room');
    const codeInput = document.getElementById('code-input');
    const displayCode = document.getElementById('code-display');

    const listUnassigned = document.getElementById('list-unassigned');
    const controlsUnassigned = document.getElementById('controls-unassigned');
    const btnJoinA = document.getElementById('btn-join-a');
    const btnJoinB = document.getElementById('btn-join-b');

    const listA = document.getElementById('list-team-a');
    const listB = document.getElementById('list-team-b');
    const lobbyStatus = document.getElementById('lobby-status');
    const btnStart = document.getElementById('btn-start-game');
    const msgWait = document.getElementById('msg-waiting-host');
    const lobbyRoomId = document.getElementById('lobby-room-id');

    // Leaderboard
    const leaderboardBody = document.getElementById('leaderboard-body');

    // HUD
    const p1ScoreEl = document.getElementById('p1-score');
    const p2ScoreEl = document.getElementById('p2-score');
    const chargeBar = document.getElementById('charge-bar');


    // --- Helper Functions ---
    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast-msg ' + type;
        toast.style.background = 'rgba(0,0,0,0.8)';
        toast.style.border = '1px solid var(--neon-cyan)';
        toast.style.padding = '10px 20px';
        toast.style.marginBottom = '10px';
        toast.style.color = '#fff';
        toast.style.borderRadius = '5px';
        toast.innerText = msg;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function switchStep(stepId) {
        [stepLogin, stepConnect, stepLobby].forEach(el => el.classList.add('hidden'));
        document.getElementById(stepId).classList.remove('hidden');
    }

    // --- 1. Login Logic ---
    btnLogin.onclick = () => {
        const name = nameInput.value.trim();
        if (!name) {
            showToast("Enter Codename!");
            return;
        }
        state.username = name;

        // Detect Role
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode') || 'host';
        state.role = mode;

        switchStep('step-connect');

        if (mode === 'host') {
            document.getElementById('modal-title').innerText = "HQ COMMAND";
            document.getElementById('modal-desc').innerText = "Creating Room...";
            displayCode.classList.remove('hidden');
            net.init();
        } else {
            document.getElementById('modal-title').innerText = "JOIN SQUAD";
            document.getElementById('modal-desc').innerText = "Enter ID:";
            codeInput.classList.remove('hidden');
            btnConnectRoom.classList.remove('hidden');
            net.init();
        }
    };

    // --- 2. Network Events Wiring ---

    // Modify init to trigger creation/connection
    const originalInit = net.init.bind(net);
    net.init = () => {
        originalInit();
        net.socket.on('connect', () => {
            if (state.role === 'host') {
                net.createRoom(state.username);
            }
        });

    };

    net.onRoomCreated = (id) => {
        displayCode.innerText = `ID: ${id}`;
        // Host goes directly to Lobby (as Unassigned)
        net.roomId = id;
    };

    btnConnectRoom.onclick = () => {
        const id = codeInput.value;
        if (id.length === 4) {
            // Check room first? Or just join lobby directly?
            // Let's join lobby directly with team=null
            net.joinLobby(id, state.username, null); // null = unassigned
        } else {
            showToast("Invalid ID");
        }
    };

    net.onLobbyUpdate = (data) => {
        switchStep('step-lobby');
        document.getElementById('modal-title').innerText = "LOBBY";

        if (net.roomId) {
            lobbyRoomId.innerText = `ROOM: ${net.roomId}`;
        }

        // Render Lists
        listUnassigned.innerHTML = data.unassigned.length ?
            data.unassigned.map(p => `<div>${p.username}</div>`).join('') :
            '<span style="color: #666">- Empty -</span>';

        listA.innerHTML = data.teamA.map(p => `<li>${p.username}</li>`).join('');
        listB.innerHTML = data.teamB.map(p => `<li>${p.username}</li>`).join('');

        // Find myself (Using Socket ID for consistency)
        const myId = net.socket ? net.socket.id : null;
        // Check if ID is in team A or B
        const amICyan = data.teamA.some(p => p.id === myId);
        const amIMagenta = data.teamB.some(p => p.id === myId);

        if (amICyan) state.myTeam = 'A';
        else if (amIMagenta) state.myTeam = 'B';
        else state.myTeam = 'unassigned';

        controlsUnassigned.classList.remove('hidden');

        // Provide Status
        const total = data.unassigned.length + data.teamA.length + data.teamB.length;
        lobbyStatus.innerText = `${total} AGENTS CONNECTED`;

        if (state.role === 'host') {
            btnStart.classList.remove('hidden');
            msgWait.classList.add('hidden');
        } else {
            btnStart.classList.add('hidden');
            msgWait.classList.remove('hidden');
        }
    };

    // Team Switching
    btnJoinA.onclick = () => net.joinLobby(net.roomId, state.username, 'A');
    btnJoinB.onclick = () => net.joinLobby(net.roomId, state.username, 'B');

    btnStart.onclick = () => {
        // Validation handled by server
        net.startGame();
    };

    net.onError = (msg) => showToast(msg, 'error');

    net.onGameUpdate = (data) => {
        state.corePosition = data.corePosition;
        if (data.activePower > 0) {
            // Visual flair for activity
            if (Math.random() > 0.7) renderer.spawnParticles(renderer.cw / 2, renderer.ch / 2, 2);
        }
    };

    // --- 3. Game Start ---
    net.onGameStarted = () => {
        mainModal.classList.add('hidden');
        state.gameActive = true;
        showToast("MISSION START! TAP FAST!", "success");

        if (state.myTeam === 'unassigned') {
            showToast("WARNING: You are Spectating (No Team)", "error");
        }
    };

    // --- 4. Game Input (Click Spam) ---
    const control = document.getElementById('control-layer');

    // Timer for sending clicks
    setInterval(() => {
        if (state.pendingClicks > 0 && state.gameActive && state.myTeam !== 'unassigned') {
            net.sendClickSpam(state.pendingClicks);
            state.pendingClicks = 0;
        }
    }, clickBatchInterval);


    function handleTap(e) {
        if (!state.gameActive) return;

        if (state.myTeam === 'unassigned') {
            showToast("JOIN A TEAM TO PLAY!", "error");
            return;
        }

        e.preventDefault();
        state.pendingClicks++;

        // Visual Feedback
        chargeBar.style.width = '100%';
        setTimeout(() => chargeBar.style.width = '0%', 50);

        renderer.shake(2);
    }

    control.addEventListener('mousedown', handleTap);
    control.addEventListener('touchstart', handleTap);

    // --- 5. Game Loop (Render) ---
    let lastTime = 0;
    function loop(timestamp) {
        const dt = timestamp - lastTime;
        lastTime = timestamp;
        renderer.draw({
            corePosition: state.corePosition,
            ropeTension: state.gameActive ? 0.8 : 0.5,
            corePower: state.pendingClicks * 10
        });
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // --- 6. End Game (Leaderboard) ---
    // --- 6. End Game (Leaderboard) ---
    // --- 6. End Game (Leaderboard) ---
    net.onGameOver = (data) => {
        console.log("Game Over Data:", data); // Debug log

        state.gameActive = false;
        mainModal.classList.add('hidden'); // Ensure hidden
        resultModal.classList.remove('hidden');

        document.getElementById('result-title').innerText =
            (data.winner === 'A' ? "CYAN WINS" : "MAGENTA WINS");
        document.getElementById('result-title').style.color =
            (data.winner === 'A' ? "var(--neon-cyan)" : "var(--neon-magenta)");

        // Find MVP (Highest Score)
        let mvpId = null;
        let maxScore = -1;
        if (data.leaderboard && data.leaderboard.length > 0) {
            data.leaderboard.forEach(p => {
                if (p.score > maxScore) {
                    maxScore = p.score;
                    mvpId = p.id;
                }
            });
        }

        // Split Teams
        const teamA = data.leaderboard.filter(p => p.team === 'A').sort((a, b) => b.score - a.score);
        const teamB = data.leaderboard.filter(p => p.team === 'B').sort((a, b) => b.score - a.score);

        const renderList = (list) => {
            if (!list || list.length === 0) return '<div style="color: #666; font-style: italic;">No Agents</div>';

            return list.map((p, i) => {
                const isMVP = p.id === mvpId;
                const bgStyle = isMVP ? 'background: rgba(255, 215, 0, 0.2); border: 1px solid gold;' : 'border-bottom: 1px solid #333;';
                const nameStyle = isMVP ? 'color: gold; font-weight: bold;' : 'color: #fff;';
                const icon = isMVP ? '👑 ' : '';

                return `
                 <div style="display: flex; justify-content: space-between; padding: 5px; ${bgStyle} margin-bottom: 5px; align-items: center;">
                    <span style="${nameStyle}">${i + 1}. ${icon}${p.username}</span>
                    <span style="color: #ccc;">${p.score}</span>
                 </div>
                 `;
            }).join('');
        };

        const cyanContainer = document.getElementById('stats-cyan');
        const magentaContainer = document.getElementById('stats-magenta');

        if (cyanContainer) cyanContainer.innerHTML = renderList(teamA);
        if (magentaContainer) magentaContainer.innerHTML = renderList(teamB);
    };

});
