import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Define a robust mock for localStorage before importing modules that use it
const localStorageStore = {};
const localStorageMock = {
    getItem: vi.fn((key) => localStorageStore[key] || null),
    setItem: vi.fn((key, value) => { localStorageStore[key] = String(value); }),
    removeItem: vi.fn((key) => { delete localStorageStore[key]; }),
    clear: vi.fn(() => {
        for (const key in localStorageStore) {
            delete localStorageStore[key];
        }
    })
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock window event listeners for test environment
if (typeof window === 'undefined') {
    globalThis.window = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
    };
} else if (!window.addEventListener) {
    window.addEventListener = vi.fn();
}

// Import Analytics
import { Analytics } from '../src/analytics.js';

describe('Analytics System', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        Analytics.disabled = false;
        Analytics.queue = [];
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should generate a valid session ID and start timestamp', () => {
        expect(Analytics.sessionId).toBeDefined();
        expect(Analytics.sessionId).toMatch(/^sess_/);
        expect(Analytics.sessionStart).toBeLessThanOrEqual(Date.now());
    });

    it('should track custom events with correct params', () => {
        Analytics.event('game_start', { mode: 'hard' });
        expect(Analytics.queue).toHaveLength(1);
        expect(Analytics.queue[0].name).toBe('game_start');
        expect(Analytics.queue[0].params.mode).toBe('hard');
        expect(Analytics.queue[0].params.session_id).toBe(Analytics.sessionId);
        expect(Analytics.queue[0].params.platform).toBeDefined();
    });

    it('should cache events to localStorage upon tracking', () => {
        Analytics.event('test_event', { val: 123 });
        const cached = JSON.parse(localStorage.getItem('crowdRunnerAnalytics'));
        expect(cached).toHaveLength(1);
        expect(cached[0].name).toBe('test_event');
    });

    it('should load cached events on initialization/construction', () => {
        const fakeEvents = [{ name: 'cached_event', params: {} }];
        localStorage.setItem('crowdRunnerAnalytics', JSON.stringify(fakeEvents));

        // Re-call private load method
        Analytics._loadCache();
        expect(Analytics.queue).toHaveLength(1);
        expect(Analytics.queue[0].name).toBe('cached_event');
    });

    it('should not track events when consent is denied', () => {
        Analytics.setConsent(false);
        expect(Analytics.disabled).toBe(true);
        expect(Analytics.queue).toHaveLength(0);

        Analytics.event('test_event');
        expect(Analytics.queue).toHaveLength(0);
    });

    it('should flush queued events', async () => {
        Analytics.event('e1');
        Analytics.event('e2');
        expect(Analytics.queue).toHaveLength(2);

        await Analytics.flush();
        expect(Analytics.queue).toHaveLength(0);
        expect(localStorage.getItem('crowdRunnerAnalytics')).toBe('[]');
    });

    it('should handle flush failures and re-queue events', async () => {
        Analytics.event('e1');
        
        // Force console.log to throw to trigger catch block
        const originalLog = console.log;
        console.log = vi.fn().mockImplementation(() => {
            throw new Error('Network error simulation');
        });

        await Analytics.flush();

        // The event should be re-queued
        expect(Analytics.queue).toHaveLength(1);
        expect(Analytics.queue[0].name).toBe('e1');

        // Restore console.log
        console.log = originalLog;
    });

    describe('Convenience Methods', () => {
        it('should track levelStart', () => {
            const spy = vi.spyOn(Analytics, 'event');
            Analytics.levelStart(5);
            expect(spy).toHaveBeenCalledWith('level_start', { level: 5 });
        });

        it('should track levelComplete', () => {
            const spy = vi.spyOn(Analytics, 'event');
            Analytics.levelComplete(5, 42, 150, '⭐⭐⭐');
            expect(spy).toHaveBeenCalledWith('level_complete', {
                level: 5,
                survivors: 42,
                coins: 150,
                stars: '⭐⭐⭐'
            });
        });

        it('should track levelFail', () => {
            const spy = vi.spyOn(Analytics, 'event');
            Analytics.levelFail(3, 15, 20);
            expect(spy).toHaveBeenCalledWith('level_fail', {
                level: 3,
                troops_lost: 15,
                coins: 20
            });
        });

        it('should track iapPurchase', () => {
            const spy = vi.spyOn(Analytics, 'event');
            Analytics.iapPurchase('coins_large', 9.99);
            expect(spy).toHaveBeenCalledWith('iap_purchase', {
                product_id: 'coins_large',
                price: 9.99,
                currency: 'USD'
            });
        });

        it('should track adWatched and rewardedAdComplete', () => {
            const spy = vi.spyOn(Analytics, 'event');
            Analytics.rewardedAdComplete('rewarded', 'revive');
            expect(spy).toHaveBeenCalledWith('ad_watched', {
                ad_type: 'rewarded',
                reward_type: 'revive'
            });
            expect(spy).toHaveBeenCalledWith('rewarded_ad_complete', {
                ad_type: 'rewarded',
                reward: 'revive'
            });
        });
    });
});
