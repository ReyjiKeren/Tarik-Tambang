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
        pendingClicks: 0
    };

    // --- DOM Elements ---
    // Modals
    const mainModal = document.getElementById('main-modal');
    const toastContainer = document.getElementById('toast-container');
    const resultModal = document.getElementById('result-modal');

    // Steps
    const stepLogin = document.getElementById('step-login');
    const stepConnect = document.getElementById('step-connect');
    const stepTeam = document.getElementById('step-team');
    const stepLobby = document.getElementById('step-lobby');

    // Inputs/Buttons
    const nameInput = document.getElementById('username-input');
    const btnLogin = document.getElementById('btn-login');
    const btnConnectRoom = document.getElementById('btn-connect-room');
    const codeInput = document.getElementById('code-input');
    const displayCode = document.getElementById('code-display');

    const btnJoinA = document.getElementById('btn-join-a');
    const btnJoinB = document.getElementById('btn-join-b');

    const listA = document.getElementById('list-team-a');
    const listB = document.getElementById('list-team-b');
    const lobbyStatus = document.getElementById('lobby-status');
    const btnStart = document.getElementById('btn-start-game');
    const msgWait = document.getElementById('msg-waiting-host');

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
        [stepLogin, stepConnect, stepTeam, stepLobby].forEach(el => el.classList.add('hidden'));
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
            net.init(); // Connect
            // Init triggering on connect usually works, but we wait for connection event in network
        } else {
            document.getElementById('modal-title').innerText = "JOIN SQUAD";
            document.getElementById('modal-desc').innerText = "Enter ID:";
            codeInput.classList.remove('hidden');
            btnConnectRoom.classList.remove('hidden');
            net.init();
        }
    };

    // --- 2. Network Events Wiring ---

    net.onRoomCreated = (id) => {
        // Only host sees this
        net.createRoom(state.username); // Actually create room request
        // Wait, logic in rtc.js calls createRoom on init? No, we call manually now.
    };

    // Override net.init to allow manual triggered actions?
    // Let's rely on internal socket flow. 
    // We bind callbacks first.

    net.onGameUpdate = (data) => {
        state.corePosition = data.corePosition;
        if (data.activePower > 0) renderer.spawnParticles(renderer.cw / 2, renderer.ch / 2, 2);
    };

    // Re-wire logic for precise flow
    net.socket = null; // Reset for safety if multiple inits

    // Correct Flow:
    // 1. User clicks LOGIN -> calls net.init()
    // 2. socket connects -> 
    //    If Host: net.createRoom(username)
    //    If Joiner: Wait for ID input

    const originalInit = net.init.bind(net);
    net.init = () => {
        originalInit();
        if (net.socket) {
            net.socket.on('connect', () => {
                if (state.role === 'host') {
                    net.createRoom(state.username);
                }
            });
        }
    };

    net.onRoomCreated = (id) => {
        // Host Created
        displayCode.innerText = `ID: ${id}`;
        // Host immediately goes to Team Select? Or waits?
        // Let's go to Team Select so Host is a player too.
        switchStep('step-team');
        document.getElementById('modal-title').innerText = `ID: ${id}`;
    };

    btnConnectRoom.onclick = () => {
        const id = codeInput.value;
        if (id.length === 4) {
            net.checkRoom(id);
        } else {
            showToast("Invalid ID");
        }
    };

    net.onRoomFound = (id) => {
        net.roomId = id;
        switchStep('step-team');
        document.getElementById('modal-title').innerText = `ID: ${id}`;
    };

    // Team Select
    btnJoinA.onclick = () => net.joinLobby(net.roomId, state.username, 'A');
    btnJoinB.onclick = () => net.joinLobby(net.roomId, state.username, 'B');

    // Lobby Update
    net.onLobbyUpdate = (data) => {
        switchStep('step-lobby');
        document.getElementById('modal-title').innerText = "LOBBY";

        // Render Lists
        listA.innerHTML = data.teamA.map(p => `<li>${p.username}</li>`).join('');
        listB.innerHTML = data.teamB.map(p => `<li>${p.username}</li>`).join('');

        // Provide Status
        const total = data.teamA.length + data.teamB.length;
        lobbyStatus.innerText = `${total} AGENTS READY`;

        if (state.role === 'host') {
            btnStart.classList.remove('hidden');
            msgWait.classList.add('hidden');
        } else {
            btnStart.classList.add('hidden');
            msgWait.classList.remove('hidden');
        }
    };

    btnStart.onclick = () => {
        net.startGame();
    };

    net.onError = (msg) => showToast(msg, 'error');

    // --- 3. Game Start ---
    net.onGameStarted = () => {
        mainModal.classList.add('hidden');
        state.gameActive = true;
        showToast("MISSION START! TAP FAST!", "success");
    };

    // --- 4. Game Input (Click Spam) ---
    const control = document.getElementById('control-layer');

    // Debounced Sender
    setInterval(() => {
        if (state.pendingClicks > 0 && state.gameActive) {
            net.sendClickSpam(state.pendingClicks);
            state.pendingClicks = 0;
        }

        // Visual Decay
        chargeBar.style.width = '0%'; // Reset bar periodically for visual tapping effect
    }, clickBatchInterval);


    function handleTap(e) {
        if (!state.gameActive) return;
        e.preventDefault();

        state.pendingClicks++;

        // Visual Feedback
        // Flash bar
        chargeBar.style.width = '100%';
        setTimeout(() => chargeBar.style.width = '0%', 50);

        // Shake
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
            corePower: state.pendingClicks * 10 // Visual feedback for clicks
        });
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // --- 6. End Game (Leaderboard) ---
    net.onGameOver = (data) => {
        state.gameActive = false;
        mainModal.classList.add('hidden'); // Ensure hidden
        resultModal.classList.remove('hidden');

        document.getElementById('result-title').innerText =
            (data.winner === 'A' ? "CYAN WINS" : "MAGENTA WINS");
        document.getElementById('result-title').style.color =
            (data.winner === 'A' ? "var(--neon-cyan)" : "var(--neon-magenta)");

        // Populate Table
        leaderboardBody.innerHTML = '';
        data.leaderboard.forEach((player, index) => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #333';
            row.innerHTML = `
                <td style="padding: 5px;">#${index + 1}</td>
                <td style="padding: 5px; color: ${player.team === 'A' ? 'var(--neon-cyan)' : 'var(--neon-magenta)'}">${player.username}</td>
                <td style="padding: 5px; text-align: right;">${player.score}</td>
            `;
            leaderboardBody.appendChild(row);
        });
    };

});
