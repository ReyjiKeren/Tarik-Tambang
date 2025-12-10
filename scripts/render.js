class GameRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Visual params
        this.particles = [];
        this.ropeOffset = 0;
        this.shakeIntensity = 0;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.cw = this.canvas.width;
        this.ch = this.canvas.height;
    }

    shake(amount) {
        this.shakeIntensity = amount;
    }

    draw(state) {
        // Clear & Shake
        this.ctx.clearRect(0, 0, this.cw, this.ch);

        let dx = 0, dy = 0;
        if (this.shakeIntensity > 0) {
            dx = (Math.random() - 0.5) * this.shakeIntensity;
            dy = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.9; // Decay
            if (this.shakeIntensity < 0.5) this.shakeIntensity = 0;
        }

        this.ctx.save();
        this.ctx.translate(dx, dy);

        // Core Position (0 to 100). 50 is center.
        // Map 0-100 to 10%-90% of screen width to keep it visible
        const coreX = (this.cw * 0.1) + (state.corePosition / 100) * (this.cw * 0.8);
        const coreY = this.ch / 2;

        // Draw Rope
        this.drawRope(coreX, coreY, state.ropeTension);

        // Draw Core
        this.drawCore(coreX, coreY, state.corePower);

        // Draw Particles
        this.updateAndDrawParticles(coreX, coreY, state.corePower);

        this.ctx.restore(); // Close Shake
    }

    drawRope(cx, cy, tension) {
        this.ctx.save();
        this.ctx.strokeStyle = '#00f3ff';
        this.ctx.lineWidth = 4;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#00f3ff';
        this.ctx.lineCap = 'round';

        // Left side (P1)
        this.ctx.beginPath();
        this.ctx.moveTo(0, cy);
        // Bezier wiggle based on tension (low tension = more sag/wiggle)
        // High tension = straight line
        const wiggle = (1 - tension) * 20 * Math.sin(Date.now() / 200);
        this.ctx.quadraticCurveTo(cx / 2, cy + wiggle, cx, cy);
        this.ctx.stroke();

        // Right side (P2)
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.shadowColor = '#ff00ff';
        this.ctx.beginPath();
        this.ctx.moveTo(this.cw, cy);
        this.ctx.quadraticCurveTo((this.cw + cx) / 2, cy - wiggle, cx, cy);
        this.ctx.stroke();

        this.ctx.restore();
    }

    drawCore(x, y, power) {
        this.ctx.save();

        // Glow
        const pulse = Math.sin(Date.now() / 300) * 5;
        const radius = 20 + (power * 0.5) + pulse;

        const grad = this.ctx.createRadialGradient(x, y, 5, x, y, radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.5, '#00f3ff');
        grad.addColorStop(1, 'rgba(0, 243, 255, 0)');

        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Inner Core
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }

    spawnParticles(x, y, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0
            });
        }
    }

    updateAndDrawParticles(cx, cy, power) {
        // Auto spawn some if power is high
        if (power > 50 && Math.random() > 0.8) {
            this.spawnParticles(cx, cy, 2);
        }

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                this.ctx.globalAlpha = p.life;
                this.ctx.fillRect(p.x, p.y, 2, 2);
            }
        }
        this.ctx.globalAlpha = 1;
    }
}
