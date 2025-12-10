document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup
    const renderer = new GameRenderer('game-canvas');
    const net = window.Network; // from rtc.js

    // DOM Elements
    const p1ScoreEl = document.getElementById('p1-score');
    const p2ScoreEl = document.getElementById('p2-score');
    const chargeBar = document.getElementById('charge-bar');
    const connectionModal = document.getElementById('connection-modal');
    const displayCode = document.getElementById('code-display');
    const inputCodeStr = document.getElementById('code-input');
    const resultModal = document.getElementById('result-modal');

    // State
    const state = {
        corePosition: 50, // 0 (P1 Win) - 100 (P2 Win)
        corePower: 0, // Visual intensity
        ropeTension: 0.5,
        myPower: 0, // Charging
        isCharging: false,
        gameActive: false
    };

    // Game Loop
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

    // Logic
    function updateLogic(dt) {
        // Charging logic
        if (state.isCharging) {
            state.myPower = Math.min(state.myPower + 0.5, 100);
        } else {
            // Decay charge if not holding (optional)
            // state.myPower = Math.max(state.myPower - 0.2, 0);
        }

        // Visual Decay of Core Power
        state.corePower *= 0.95;

        // UI Update
        chargeBar.style.width = `${state.myPower}%`;

        // Win Condition
        if (state.corePosition <= 0) endGame('You');
        if (state.corePosition >= 100) endGame('Opponent');
    }

    function endGame(winner) {
        state.gameActive = false;
        document.getElementById('result-title').innerText =
            (winner === 'You') ? 'VICTORY' : 'DEFEAT';
        resultModal.classList.remove('hidden');
    }

    // Input Handling
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

        // Release Force
        const force = state.myPower;
        if (force > 0) {
            applyForce(force);
            state.myPower = 0; // Reset charge
        }
    };

    control.addEventListener('mousedown', startAction);
    control.addEventListener('touchstart', startAction);
    control.addEventListener('mouseup', endAction);
    control.addEventListener('touchend', endAction);

    function applyForce(amount) {
        // Send to network
        net.send({ type: 'pull', force: amount });

        // Apply locally
        // If I am P1 (Host default?), I pull towards 0.
        // If I am P2 (Joiner?), I pull towards 100?
        // Let's decide direction based on Host/Client

        const direction = net.isHost ? -1 : 1;
        const impact = (amount / 100) * 5; // Scaling factor

        state.corePosition += (impact * direction);
        state.corePower = amount; // Visual flare
        renderer.spawnParticles(renderer.cw / 2, renderer.ch / 2, 10);
    }

    // Networking Setup
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') || 'host';

    // Initialize Network
    net.init(mode);

    // UI for Connection
    if (mode === 'host') {
        document.getElementById('modal-title').innerText = "Mission Control";
        document.getElementById('modal-desc').innerText = "Waiting for pilot...";
        displayCode.classList.remove('hidden');

        // Show Room ID when generated
        net.onRoomCreated = (id) => {
            displayCode.innerText = `ID: ${id}`;
        };

    } else {
        document.getElementById('modal-title').innerText = "Join Frequency";
        document.getElementById('modal-desc').innerText = "Enter Host ID:";

        const input = document.getElementById('code-input');
        const btn = document.getElementById('modal-action-btn');

        input.classList.remove('hidden');
        btn.classList.remove('hidden');
        btn.innerText = "Connect";

        btn.onclick = () => {
            const id = input.value;
            if (id) {
                net.joinRoom(id);
                btn.innerText = "Connecting...";
                btn.disabled = true;
            }
        };
    }

    // Hook Network Events
    net.onConnect = () => {
        connectionModal.classList.add('hidden');
        state.gameActive = true;
    };

    net.onData = (data) => {
        if (data.type === 'pull') {
            const amount = data.force;
            // Enemy pull direction is opposite to mine
            const direction = net.isHost ? 1 : -1; // Enemy is Client(1) if I am Host(-1)
            const impact = (amount / 100) * 5;

            state.corePosition += (impact * direction);
            state.corePower = amount;
            renderer.spawnParticles(renderer.cw / 2, renderer.ch / 2, 5);
        }
    };
});
