class GameRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) console.error("Canvas element not found!");
        this.ctx = this.canvas.getContext('2d');

        // Force initial resize
        this.resize();
        window.addEventListener('resize', () => this.resize());

        console.log("Renderer Initialized", this.cw, this.ch);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.cw = this.canvas.width;
        this.ch = this.canvas.height;
    }

    draw(state) {
        if (!this.ctx) return;

        // Clear
        this.ctx.clearRect(0, 0, this.cw, this.ch);

        // Safe Defaults
        const pos = (typeof state.corePosition === 'number') ? state.corePosition : 50;
        const tension = (typeof state.ropeTension === 'number') ? state.ropeTension : 0.5;
        const power = (typeof state.corePower === 'number') ? state.corePower : 0;

        // Calculate Center
        // Map 0-100 to 10%-90% width
        const cx = (this.cw * 0.1) + (pos / 100) * (this.cw * 0.8);
        const cy = this.ch / 2;

        // Draw Guide Line (Visible regardless of state)
        this.ctx.globalAlpha = 0.2;
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, cy);
        this.ctx.lineTo(this.cw, cy);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;

        // Draw Rope parts
        this.drawRopeSegment(0, cy, cx, cy, '#00f3ff', tension); // Left
        this.drawRopeSegment(cx, cy, this.cw, cy, '#ff00ff', tension); // Right

        // Draw Core
        this.drawSimpleCore(cx, cy, power);
    }

    drawRopeSegment(x1, y1, x2, y2, color, tension) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 5;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = color;
        this.ctx.lineCap = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);

        // Simple Bezier
        const midX = (x1 + x2) / 2;
        // Wiggle depends on tension. Low tension = more wiggle.
        const wiggle = (1 - tension) * 30 * Math.sin(Date.now() / 200);

        this.ctx.quadraticCurveTo(midX, y1 + wiggle, x2, y2);
        this.ctx.stroke();

        // Reset Shadow for next draw
        this.ctx.shadowBlur = 0;
    }

    drawSimpleCore(x, y, power) {
        // Outer Glow
        const pulse = Math.sin(Date.now() / 200) * 5;
        const radius = Math.max(15, 20 + (power * 0.2) + pulse);

        this.ctx.fillStyle = '#fff';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#00f3ff';

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Reset
        this.ctx.shadowBlur = 0;
    }

    // Stub for compatibility
    shake(intensity) { }
    spawnParticles(x, y, c) { }
}
