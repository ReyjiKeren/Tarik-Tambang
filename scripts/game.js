document.addEventListener('DOMContentLoaded', () => {
    // Setup
    const overlay = document.getElementById('page-overlay');
    // Fade IN on load
    setTimeout(() => {
        if (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.style.display = 'none', 500);
        }
    }, 100);

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

    // Lobby UI
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

    // Stats UI
    const winsAEl = document.getElementById('wins-a');
    const winsBEl = document.getElementById('wins-b');
    const roundNumEl = document.getElementById('round-num');
    const targetWinsDisplay = document.getElementById('target-wins-display');
    const hostSettings = document.getElementById('host-settings');
    const inputTargetWins = document.getElementById('input-target-wins');
    const btnUpdateSettings = document.getElementById('btn-update-settings');
    // HUD
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
        // Fade Out current
        [stepLogin, stepConnect, stepLobby].forEach(el => {
            if (!el.classList.contains('hidden')) {
                el.classList.add('fade-out');
                setTimeout(() => el.classList.add('hidden'), 300); // Wait for anim
            }
        });

        // Fade In new
        setTimeout(() => {
            const target = document.getElementById(stepId);
            target.classList.remove('hidden', 'fade-out');
            target.classList.add('fade-in');
        }, 300);
    }

    // --- 1. Login Logic ---
    btnLogin.onclick = () => {
        const name = nameInput.value.trim();
        if (!name) {
            showToast("Masukkan Nama Sandi!");
            return;
        }
        state.username = name;

        // Detect Role
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode') || 'host';
        state.role = mode;

        switchStep('step-connect');

        if (mode === 'host') {
            document.getElementById('modal-title').innerText = "PUSAT KOMANDO";
            document.getElementById('modal-desc').innerText = "Membuat Room...";
            displayCode.classList.remove('hidden');
            net.init();
        } else {
            document.getElementById('modal-title').innerText = "GABUNG SKUAD";
            document.getElementById('modal-desc').innerText = "Masukkan ID:";
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
            net.joinLobby(id, state.username, null); // null = unassigned
        } else {
            showToast("ID Tidak Valid");
        }
    };

    // --- LOBBY UPDATE & ADMIN CONTROLS ---

    // Admin: Move Player Helper
    window.movePlayer = (targetId, team) => {
        if (state.role !== 'host') return;
        net.socket.emit('admin_move_player', {
            roomId: net.roomId,
            targetId: targetId,
            team: team
        });
    };

    // Admin: Render Player Item with Controls
    const renderPlayerItem = (p) => {
        let controls = '';
        if (state.role === 'host' && p.id !== net.socket.id) { // Don't move self via UI easily or redundant
            // Arrows to move
            const toUn = `<button onclick="movePlayer('${p.id}', 'unassigned')" style="background:none; border:none; color:#666; cursor:pointer;">⬆️</button>`;
            const toA = `<button onclick="movePlayer('${p.id}', 'A')" style="background:none; border:none; color:cyan; cursor:pointer;">⬅️</button>`;
            const toB = `<button onclick="movePlayer('${p.id}', 'B')" style="background:none; border:none; color:magenta; cursor:pointer;">➡️</button>`;

            if (p.team === 'unassigned') controls = `${toA} ${toB}`;
            else if (p.team === 'A') controls = `${toUn} ${toB}`;
            else if (p.team === 'B') controls = `${toA} ${toUn}`;
        }
        return `<div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${p.username}</span>
                    <span>${controls}</span>
                </div>`;
    };

    net.onLobbyUpdate = (data) => {
        switchStep('step-lobby');
        document.getElementById('modal-title').innerText = "LOBI";

        if (net.roomId) {
            lobbyRoomId.innerText = `ROOM: ${net.roomId}`;
        }

        // Stats Update
        if (data.stats) {
            winsAEl.innerText = data.stats.winsA;
            winsBEl.innerText = data.stats.winsB;
            roundNumEl.innerText = data.stats.currentRound;
        }
        if (data.settings) {
            targetWinsDisplay.innerText = data.settings.targetWins;
            if (state.role !== 'host') {
                // Sync input if not host (not visible but good for state)
                inputTargetWins.value = data.settings.targetWins;
            }
        }

        // Render Lists
        listUnassigned.innerHTML = data.unassigned.length ?
            data.unassigned.map(p => renderPlayerItem(p)).join('') :
            '<span style="color: #666">- Kosong -</span>';

        listA.innerHTML = data.teamA.map(p => `<li>${renderPlayerItem(p)}</li>`).join('');
        listB.innerHTML = data.teamB.map(p => `<li>${renderPlayerItem(p)}</li>`).join('');

        // Find myself
        const myId = net.socket ? net.socket.id : null;
        const amICyan = data.teamA.some(p => p.id === myId);
        const amIMagenta = data.teamB.some(p => p.id === myId);

        if (amICyan) state.myTeam = 'A';
        else if (amIMagenta) state.myTeam = 'B';
        else state.myTeam = 'unassigned';

        controlsUnassigned.classList.remove('hidden');

        // Status
        const total = data.unassigned.length + data.teamA.length + data.teamB.length;
        lobbyStatus.innerText = `${total} PEMAIN TERHUBUNG`;

        if (state.role === 'host') {
            btnStart.classList.remove('hidden');
            msgWait.classList.add('hidden');
            hostSettings.classList.remove('hidden');
        } else {
            btnStart.classList.add('hidden');
            msgWait.classList.remove('hidden');
            hostSettings.classList.add('hidden');
        }
    };

    // Host Settings Update
    btnUpdateSettings.onclick = () => {
        const val = parseInt(inputTargetWins.value);
        if (val > 0) {
            net.socket.emit('update_settings', {
                roomId: net.roomId,
                targetWins: val
            });
            showToast("Pengaturan Diperbarui!");
        }
    };

    // Team Switching (Self)
    btnJoinA.onclick = () => net.joinLobby(net.roomId, state.username, 'A');
    btnJoinB.onclick = () => net.joinLobby(net.roomId, state.username, 'B');

    btnStart.onclick = () => {
        console.log("Start Button Clicked. RoomID:", net.roomId);
        showToast("Memulai Misi...", "info");
        net.startGame();
    };

    net.onError = (msg) => showToast(msg, 'error');

    net.onGameUpdate = (data) => {
        state.corePosition = data.corePosition;
        if (data.activePower > 0) {
            if (Math.random() > 0.7) renderer.spawnParticles(renderer.cw / 2, renderer.ch / 2, 2);
        }
    };

    // --- 3. Game Start ---
    net.onGameStarted = (data) => {
        // Clear any existing prompts
        const existingToast = document.querySelector('.round-toast');
        if (existingToast) existingToast.remove();

        console.log("GAME STARTED EVENT RECEIVED", data);
        mainModal.classList.add('hidden');
        state.gameActive = true;
        showToast("MISI DIMULAI! TAP CEPAT!", "success");

        if (data && data.stats) {
            document.getElementById('p1-score').innerText = `TIM A: ${data.stats.winsA}`;
            document.getElementById('p2-score').innerText = `TIM B: ${data.stats.winsB}`;
            document.getElementById('round-display').innerText = `RONDE ${data.stats.currentRound}`;
        }

        if (state.myTeam === 'unassigned') {
            showToast("INFO: Anda dalam Mode Penonton", "info");
        }
    };


    // --- 4. Game Input (Click Spam) ---
    const control = document.getElementById('control-layer');

    setInterval(() => {
        if (state.pendingClicks > 0 && state.gameActive && state.myTeam !== 'unassigned') {
            net.sendClickSpam(state.pendingClicks);
            state.pendingClicks = 0;
        }
    }, clickBatchInterval);


    function handleTap(e) {
        if (!state.gameActive) return;

        if (state.myTeam === 'unassigned') {
            showToast("ANDA PENONTON!", "error");
            return;
        }

        e.preventDefault();
        state.pendingClicks++;

        // Visual Feedback
        chargeBar.style.width = '100%';
        setTimeout(() => chargeBar.style.width = '0%', 50);

        renderer.shake(2);

        // Ripple Effect
        let x, y;
        if (e.type === 'touchstart') {
            x = e.touches[0].clientX;
            y = e.touches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }

        const color = (state.myTeam === 'A') ? 'rgba(0, 243, 255, 1)' : 'rgba(255, 0, 255, 1)';
        renderer.spawnRipple(x, y, color);
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

    // --- 6. Round Over ---
    net.onRoundOver = (data) => {
        state.gameActive = false;
        const msg = data.winner === 'A' ? "TIM A MENANG RONDE!" : "TIM B MENANG RONDE!";
        const color = data.winner === 'A' ? "var(--neon-cyan)" : "var(--neon-magenta)";

        // Simple Overlay for Round End
        const roundToast = document.createElement('div');
        roundToast.classList.add('round-toast');
        roundToast.style.position = 'fixed';
        roundToast.style.top = '40%';
        roundToast.style.left = '50%';
        roundToast.style.transform = 'translate(-50%, -50%)';
        roundToast.style.zIndex = '999';
        roundToast.style.textAlign = 'center';

        // Main Message
        const msgEl = document.createElement('div');
        msgEl.style.fontSize = '3rem';
        msgEl.style.fontWeight = 'bold';
        msgEl.style.color = color;
        msgEl.style.textShadow = `0 0 20px ${color}`;
        msgEl.style.background = 'rgba(0,0,0,0.8)';
        msgEl.style.padding = '20px 40px';
        msgEl.style.border = `2px solid ${color}`;
        msgEl.innerText = msg;

        // Cooldown Timer
        const timeEl = document.createElement('div');
        timeEl.style.fontSize = '1.5rem';
        timeEl.style.color = '#fff';
        timeEl.style.marginTop = '10px';
        timeEl.innerText = `Ronde Berikutnya dalam ${data.cooldown || 5}...`;

        roundToast.appendChild(msgEl);
        roundToast.appendChild(timeEl);
        document.body.appendChild(roundToast);

        let timeLeft = data.cooldown || 5;
        const timer = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                timeEl.innerText = `Ronde Berikutnya dalam ${timeLeft}...`;
            } else {
                clearInterval(timer);
                roundToast.remove();
            }
        }, 1000);
    };

    // --- 7. Match Over (Leaderboard) ---
    net.onGameOver = (data) => {
        state.gameActive = false;
        mainModal.classList.add('hidden'); // Ensure hidden
        resultModal.classList.remove('hidden');
        resultModal.classList.add('modal-pop'); // Animation

        document.getElementById('result-title').innerText =
            (data.winner === 'A' ? "TIM A MENANG" : "TIM B MENANG");
        document.getElementById('result-title').style.color =
            (data.winner === 'A' ? "var(--neon-cyan)" : "var(--neon-magenta)");

        // Find MVP 
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

        // Split Teams (Score accumulation ?)
        const teamA = data.leaderboard.filter(p => p.team === 'A').sort((a, b) => b.score - a.score);
        const teamB = data.leaderboard.filter(p => p.team === 'B').sort((a, b) => b.score - a.score);

        const renderList = (list) => {
            if (!list || list.length === 0) return '<div style="color: #666; font-style: italic;">Tidak Ada Pemain</div>';

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
