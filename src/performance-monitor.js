/**
 * Performance Monitor for Crowd Runner 3D
 * 
 * Provides real-time FPS tracking, memory usage, and draw call monitoring
 * to help maintain 60 FPS on mid-range Android devices.
 * 
 * Usage:
 *   import { PerformanceMonitor } from './performance-monitor.js';
 *   const perf = new PerformanceMonitor();
 *   // In your animation loop:
 *   perf.update();
 *   perf.display(); // shows overlay in top-left corner
 */

export class PerformanceMonitor {
    constructor(options = {}) {
        this.enabled = options.enabled || false; // Disabled by default in production
        this.sampleSize = options.sampleSize || 60;
        this.warningThreshold = options.warningThreshold || 30; // Warn below 30 FPS
        this.targetFPS = options.targetFPS || 60;

        // FPS tracking
        this.frameTimes = [];
        this.fps = 0;
        this.minFPS = Infinity;
        this.maxFPS = 0;
        this.frameCount = 0;
        this.lastTimestamp = performance.now();

        // Memory tracking
        this.memUsage = 0;
        this.drawCalls = 0;
        this.triangles = 0;

        // Long frame detection
        this.longFrames = 0;
        this.longFrameThreshold = options.longFrameThreshold || 50; // ms

        // DOM overlay
        this.overlay = null;
        if (!options.noOverlay) {
            this.createOverlay();
        }

        // Logging
        this.logInterval = options.logInterval || 1000; // Log summary every 1s
        this.lastLogTime = performance.now();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'perf-monitor';
        this.overlay.style.cssText = `
            position: fixed;
            top: 4px;
            left: 4px;
            background: rgba(0, 0, 0, 0.75);
            color: #0f0;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            padding: 6px 10px;
            border-radius: 6px;
            z-index: 9999;
            pointer-events: none;
            user-select: none;
            line-height: 1.5;
            min-width: 140px;
            display: ${this.enabled ? 'block' : 'none'};
        `;
        this.overlay.innerHTML = `
            <div id="perf-fps">-- FPS</div>
            <div id="perf-minmax">--/--</div>
            <div id="perf-ms">-- ms</div>
            <div id="perf-long">Long frames: 0</div>
        `;
        document.body.appendChild(this.overlay);
    }

    /**
     * Enable the monitor display
     */
    enable() {
        this.enabled = true;
        if (this.overlay) this.overlay.style.display = 'block';
    }

    /**
     * Disable the monitor display
     */
    disable() {
        this.enabled = false;
        if (this.overlay) this.overlay.style.display = 'none';
    }

    /**
     * Toggle visibility
     */
    toggle() {
        if (this.enabled) this.disable();
        else this.enable();
    }

    /**
     * Call this every frame with the renderer info object (optional)
     * @param {Object} rendererInfo - Three.js renderer.info object
     */
    update(rendererInfo) {
        const now = performance.now();
        const delta = now - this.lastTimestamp;
        this.lastTimestamp = now;

        // Track frame times
        this.frameTimes.push(delta);
        if (this.frameTimes.length > this.sampleSize) {
            this.frameTimes.shift();
        }

        this.frameCount++;

        // Calculate FPS from average of last N frames
        if (this.frameTimes.length >= 2) {
            const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
            this.fps = Math.round(1000 / avg);
            if (this.fps < this.minFPS && this.fps > 0) this.minFPS = this.fps;
            if (this.fps > this.maxFPS && this.fps < 200) this.maxFPS = this.fps;
        }

        // Track long frames
        if (delta > this.longFrameThreshold) {
            this.longFrames++;
        }

        // Track renderer stats
        if (rendererInfo) {
            this.drawCalls = rendererInfo.render?.calls || 0;
            this.triangles = rendererInfo.render?.triangles || 0;
            if (rendererInfo.memory) {
                this.memUsage = rendererInfo.memory.geometries || 0;
            }
        }

        // Periodic logging
        if (now - this.lastLogTime > this.logInterval) {
            this.logSummary();
            this.lastLogTime = now;
        }
    }

    /**
     * Update the overlay display
     */
    display() {
        if (!this.enabled || !this.overlay) return;

        const fpsColor = this.fps < this.warningThreshold ? '#ff4444' :
            this.fps < this.targetFPS * 0.75 ? '#ffaa00' : '#00ff66';

        document.getElementById('perf-fps').textContent = `${this.fps} FPS`;
        document.getElementById('perf-fps').style.color = fpsColor;

        const minStr = this.minFPS === Infinity ? '--' : this.minFPS;
        document.getElementById('perf-minmax').textContent = `Min: ${minStr} / Max: ${this.maxFPS}`;

        const lastMs = this.frameTimes.length > 0 ?
            Math.round(this.frameTimes[this.frameTimes.length - 1] * 10) / 10 : 0;
        document.getElementById('perf-ms').textContent = `${lastMs} ms`;

        document.getElementById('perf-long').textContent =
            `Long frames: ${this.longFrames} (${this.longFrameThreshold}ms+)`;
    }

    /**
     * Log performance summary to console (for analytics)
     */
    logSummary() {
        if (!this.enabled) return;
        const avg = this.frameTimes.length > 0 ?
            Math.round(this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length) : 0;
        console.log(`[Performance] FPS: ${this.fps} (min: ${this.minFPS}, max: ${this.maxFPS}) | ` +
            `Avg frame: ${avg}ms | ` +
            `Draw calls: ${this.drawCalls} | ` +
            `Triangles: ${this.triangles} | ` +
            `Long frames (${this.longFrameThreshold}ms+): ${this.longFrames}`);
    }

    /**
     * Get FPS data for analytics
     */
    getStats() {
        return {
            fps: this.fps,
            minFPS: this.minFPS === Infinity ? 0 : this.minFPS,
            maxFPS: this.maxFPS,
            avgFrameTime: this.frameTimes.length > 0 ?
                Math.round(this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length * 10) / 10 : 0,
            drawCalls: this.drawCalls,
            triangles: this.triangles,
            longFrames: this.longFrames
        };
    }

    /**
     * Reset all counters
     */
    reset() {
        this.frameTimes = [];
        this.fps = 0;
        this.minFPS = Infinity;
        this.maxFPS = 0;
        this.frameCount = 0;
        this.longFrames = 0;
        this.lastTimestamp = performance.now();
    }
}

/**
 * Keyboard shortcut to toggle FPS monitor
 * Press 'F' to show/hide the performance overlay
 */
export function bindPerfKeyToggle(perfMonitor) {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            perfMonitor.toggle();
        }
    });
}