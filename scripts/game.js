document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup
    const renderer = new GameRenderer('game-canvas');
    const net = window.Network; // from rtc.js (now pure socket)

    // DOM Elements
    const p1ScoreEl = document.getElementById('p1-score'); // Now Team A
    const p2ScoreEl = document.getElementById('p2-score'); // Now Team B
    const chargeBar = document.getElementById('charge-bar');
    const connectionModal = document.getElementById('connection-modal');

    // Step 1 UI
    const step1 = document.getElementById('step-1');
    const displayCode = document.getElementById('code-display');
    const inputCode = document.getElementById('code-input');
    const btnNext = document.getElementById('btn-next-step');

    // Step 2 UI (Teams)
    const stepTeam = document.getElementById('step-team');
    const btnJoinA = document.getElementById('btn-join-a');
    const btnJoinB = document.getElementById('btn-join-b');
    const countA = document.getElementById('count-a');
    const countB = document.getElementById('count-b');

    const resultModal = document.getElementById('result-modal');
    const toastContainer = document.getElementById('toast-container');

    // Toasts
    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast-msg ' + type; // define CSS later if needed
        toast.style.background = 'rgba(0,0,0,0.8)';
        toast.style.border = '1px solid var(--neon-cyan)';
        toast.style.padding = '10px 20px';
        toast.style.color = '#fff';
        toast.style.borderRadius = '5px';
        toast.innerText = msg;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // State
    const state = {
        corePosition: 50,
        corePower: 0,
        ropeTension: 0.5,
        myPower: 0,
        isCharging: false,
        gameActive: false
    };

    net.init();

    // Mode Detection
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') || 'host';

    if (mode === 'host') {
        document.getElementById('modal-title').innerText = "HQ COMMAND";
        document.getElementById('modal-desc').innerText = "Initializing Room...";
        displayCode.classList.remove('hidden');
        net.createRoom();
        // Note: Host will enter Team Selection after creation
    } else {
        document.getElementById('modal-title').innerText = "JOIN SQUAD";
        document.getElementById('modal-desc').innerText = "Enter Operation ID:";
        inputCode.classList.remove('hidden');
        btnNext.classList.remove('hidden');
    }

    // --- Network Events Wiring ---

    net.onRoomCreated = (id) => {
        displayCode.innerText = `ID: ${id}`;
        document.getElementById('modal-desc').innerText = "Share ID & Select Team:";
        stepTeam.classList.remove('hidden'); // Show team selector immediately for host
    };

    net.onError = (msg) => {
        showToast(msg, 'error');
    };

    net.onPlayerUpdate = (data) => {
        countA.innerText = `(${data.countA}/10)`;
        countB.innerText = `(${data.countB}/10)`;
    };

    net.onJoinSuccess = (data) => {
        // Hide Modal, Start Game
        connectionModal.classList.add('hidden');
        state.gameActive = true;
        showToast(`Joined Team ${data.team === 'A' ? 'CYAN' : 'MAGENTA'}!`);

        // Update HUD labels
        p1ScoreEl.innerText = "TEAM CYAN";
        p2ScoreEl.innerText = "TEAM MAGENTA";
    };

    net.onGameUpdate = (data) => {
        state.corePosition = data.corePosition;
        // Shake effect based on power
        if (data.activePower > 50) {
            renderer.shake(5);
        }
    };

    net.onGameOver = (data) => {
        state.gameActive = false;
        const myTeam = net.myTeam;
        const winner = data.winner; // 'A' or 'B'

        const isVictory = (myTeam === winner);

        document.getElementById('result-title').innerText = isVictory ? "MENANG" : "KALAH";
        document.getElementById('result-title').style.color = isVictory ? "var(--neon-cyan)" : "var(--neon-magenta)";

        resultModal.classList.remove('hidden');
    };

    // --- UI Interactions ---

    btnNext.onclick = () => {
        const id = inputCode.value;
        if (id.length === 4) {
            // We don't join immediately, just "configure" to see teams? 
            // Simplified: User enters ID, then we show Team Selector. 
            // We need to ask server "does this room exist?" before showing selector?
            // For simplicity in this iteration:
            // Just assume room exists or handle error later.
            // We use 'join_team' directly. So we store ID and show selector.
            net.roomId = id;
            step1.classList.add('hidden');
            stepTeam.classList.remove('hidden');
            document.getElementById('modal-title').innerText = `ROOM ${id}`;
            document.getElementById('modal-desc').innerText = "Choose your allegiance:";
        } else {
            showToast("Invalid ID length");
        }
    };

    btnJoinA.onclick = () => {
        const id = net.roomId || displayCode.innerText.replace("ID: ", "");
        net.joinTeam(id, 'A');
    };

    btnJoinB.onclick = () => {
        const id = net.roomId || displayCode.innerText.replace("ID: ", "");
        net.joinTeam(id, 'B');
    };


    // --- Game Loop (Visuals) ---

    let lastTime = 0;
    function loop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const dt = timestamp - lastTime;
        lastTime = timestamp;

        if (state.gameActive) {
            updateLogic(dt);
        }
        renderer.draw(state);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    function updateLogic(dt) {
        if (state.isCharging) {
            state.myPower = Math.min(state.myPower + 0.5, 100);
        }
        state.corePower *= 0.95;
        chargeBar.style.width = `${state.myPower}%`;
    }

    // --- Inputs ---
    const control = document.getElementById('control-layer');

    const startAction = (e) => {
        if (!state.gameActive) return;
        e.preventDefault();
        state.isCharging = true;
        state.ropeTension = 0.8;
    };

    const endAction = (e) => {
        if (!state.gameActive) return;
        e.preventDefault();
        state.isCharging = false;
        state.ropeTension = 0.5;

        const force = state.myPower;
        if (force > 0) {
            net.sendPullForce(force); // Server handles logic
            state.myPower = 0;
            renderer.spawnParticles(renderer.cw / 2, renderer.ch / 2, 5);
        }
    };

    control.addEventListener('mousedown', startAction);
    control.addEventListener('touchstart', startAction);
    control.addEventListener('mouseup', endAction);
    control.addEventListener('touchend', endAction);
});
