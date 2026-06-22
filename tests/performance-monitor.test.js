import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor, bindPerfKeyToggle } from '../src/performance-monitor.js';

describe('PerformanceMonitor', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Clear body of any leftover monitors
        const monitorEl = document.getElementById('perf-monitor');
        if (monitorEl) monitorEl.remove();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        const monitorEl = document.getElementById('perf-monitor');
        if (monitorEl) monitorEl.remove();
    });

    it('should initialize with defaults and append overlay to document body', () => {
        const perf = new PerformanceMonitor({ enabled: true });
        expect(perf.enabled).toBe(true);
        expect(perf.sampleSize).toBe(60);
        expect(perf.warningThreshold).toBe(30);

        const overlay = document.getElementById('perf-monitor');
        expect(overlay).not.toBeNull();
        expect(overlay.style.display).toBe('block');
    });

    it('should initialize with noOverlay option', () => {
        const perf = new PerformanceMonitor({ noOverlay: true });
        expect(perf.overlay).toBeNull();
        expect(document.getElementById('perf-monitor')).toBeNull();
    });

    it('should enable, disable, and toggle overlay display', () => {
        const perf = new PerformanceMonitor({ enabled: false });
        const overlay = document.getElementById('perf-monitor');
        expect(perf.enabled).toBe(false);
        expect(overlay.style.display).toBe('none');

        perf.enable();
        expect(perf.enabled).toBe(true);
        expect(overlay.style.display).toBe('block');

        perf.disable();
        expect(perf.enabled).toBe(false);
        expect(overlay.style.display).toBe('none');

        perf.toggle();
        expect(perf.enabled).toBe(true);
        expect(overlay.style.display).toBe('block');
    });

    it('should track frame time updates and compute FPS', () => {
        const perf = new PerformanceMonitor({ noOverlay: true, sampleSize: 5 });

        perf.update(); // initialize timestamp

        // Warm up by tracking 5 frames of 16ms
        for (let i = 0; i < 5; i++) {
            vi.advanceTimersByTime(16);
            perf.update();
        }

        expect(perf.fps).toBe(63); // 1000 / 16 = 62.5 -> 63
        expect(perf.frameCount).toBe(6);
        expect(perf.minFPS).toBe(63);
        expect(perf.maxFPS).toBe(125);
    });

    it('should detect long frames', () => {
        const perf = new PerformanceMonitor({ noOverlay: true, longFrameThreshold: 50 });
        
        // Frame 1
        perf.update();

        // Frame 2: fast frame (16ms)
        vi.advanceTimersByTime(16);
        perf.update();
        expect(perf.longFrames).toBe(0);

        // Frame 3: lag spike / long frame (60ms)
        vi.advanceTimersByTime(60);
        perf.update();
        expect(perf.longFrames).toBe(1);
    });

    it('should capture Three.js renderer stats', () => {
        const perf = new PerformanceMonitor({ noOverlay: true });
        
        // Mock Three.js renderer.info structure
        const mockRendererInfo = {
            render: {
                calls: 15,
                triangles: 4500
            },
            memory: {
                geometries: 24
            }
        };

        perf.update(mockRendererInfo);
        expect(perf.drawCalls).toBe(15);
        expect(perf.triangles).toBe(4500);
        expect(perf.memUsage).toBe(24);

        const stats = perf.getStats();
        expect(stats.drawCalls).toBe(15);
        expect(stats.triangles).toBe(4500);
    });

    it('should update DOM overlay text when display is called', () => {
        const perf = new PerformanceMonitor({ enabled: true });
        
        // Force mock values (fps < 45 to trigger warning color #ffaa00)
        perf.fps = 40;
        perf.minFPS = 30;
        perf.maxFPS = 60;
        perf.longFrames = 2;
        perf.frameTimes = [22]; // last frame time: 22ms

        perf.display();

        expect(document.getElementById('perf-fps').textContent).toBe('40 FPS');
        expect(document.getElementById('perf-fps').style.color).toBe('rgb(255, 170, 0)'); // #ffaa00 in RGB style
        expect(document.getElementById('perf-minmax').textContent).toBe('Min: 30 / Max: 60');
        expect(document.getElementById('perf-ms').textContent).toBe('22 ms');
        expect(document.getElementById('perf-long').textContent).toContain('Long frames: 2');
    });

    it('should bind keydown event to toggle performance overlay', () => {
        const perf = new PerformanceMonitor({ enabled: false });
        bindPerfKeyToggle(perf);

        expect(perf.enabled).toBe(false);

        // Dispatch keydown event for 'f' key
        const event = new KeyboardEvent('keydown', { key: 'f' });
        document.dispatchEvent(event);

        expect(perf.enabled).toBe(true);

        // Dispatched keydown with CTRL+f should be ignored
        const eventWithCtrl = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true });
        document.dispatchEvent(eventWithCtrl);
        expect(perf.enabled).toBe(true); // remains enabled
    });

    it('should reset stats correctly', () => {
        const perf = new PerformanceMonitor({ noOverlay: true });
        perf.update();
        vi.advanceTimersByTime(16);
        perf.update();
        perf.longFrames = 5;

        expect(perf.frameCount).toBe(2);
        expect(perf.longFrames).toBe(5);

        perf.reset();
        expect(perf.frameCount).toBe(0);
        expect(perf.longFrames).toBe(0);
        expect(perf.frameTimes).toHaveLength(0);
    });
});
