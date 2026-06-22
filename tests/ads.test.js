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

// Now import the modules
import { Ads } from '../src/ads.js';
import { Analytics } from '../src/analytics.js';

vi.mock('../src/analytics.js', () => {
    return {
        Analytics: {
            event: vi.fn(),
            rewardedAdComplete: vi.fn()
        }
    };
});

describe('AdManager (Ads)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        Ads.setAdsRemoved(false);
        Ads.initialized = false;
        Ads.adCounter = 0;
        Ads.lastInterstitialTime = 0;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should initialize successfully', async () => {
        expect(Ads.initialized).toBe(false);
        await Ads.initialize();
        expect(Ads.initialized).toBe(true);
    });

    it('should toggle ad removal and report enabled state', () => {
        expect(Ads.areAdsEnabled).toBe(true);
        Ads.setAdsRemoved(true);
        expect(Ads.areAdsEnabled).toBe(false);
    });

    describe('getRewardedCoinAmount', () => {
        it('should return base amount when no event is active', () => {
            expect(Ads.getRewardedCoinAmount(100)).toBe(100);
        });

        it('should return base amount when event is expired', () => {
            const expiredEvent = {
                active: true,
                end: Date.now() - 1000,
                multiplier: 2.0
            };
            localStorage.setItem('crowdRunnerEvent', JSON.stringify(expiredEvent));
            expect(Ads.getRewardedCoinAmount(100)).toBe(100);
        });

        it('should multiply base amount when event is active and valid', () => {
            const activeEvent = {
                active: true,
                end: Date.now() + 60000,
                multiplier: 2.5
            };
            localStorage.setItem('crowdRunnerEvent', JSON.stringify(activeEvent));
            expect(Ads.getRewardedCoinAmount(100)).toBe(250);
        });
    });

    describe('Rewarded Ads', () => {
        it('should bypass ad and reward immediately if ads are removed', async () => {
            Ads.setAdsRemoved(true);
            const onReward = vi.fn();
            const onClose = vi.fn();

            await Ads.showRewardedAd({ onReward, onClose, rewardType: 'revive' });
            expect(onReward).toHaveBeenCalledWith('revive');
            expect(onClose).not.toHaveBeenCalled();
        });

        it('should reward after timeout on successful random check', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.9 success
            const onReward = vi.fn();
            const onClose = vi.fn();

            const adPromise = Ads.showRewardedAd({ onReward, onClose, rewardType: 'coins' });
            vi.advanceTimersByTime(1000);
            await adPromise;

            expect(onReward).toHaveBeenCalledWith('coins');
            expect(Analytics.rewardedAdComplete).toHaveBeenCalledWith('rewarded', 'coins');
            expect(onClose).not.toHaveBeenCalled();
        });

        it('should call onClose on failed random check', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.95); // > 0.9 failure
            const onReward = vi.fn();
            const onClose = vi.fn();

            const adPromise = Ads.showRewardedAd({ onReward, onClose, rewardType: 'xp_boost' });
            vi.advanceTimersByTime(1000);
            await adPromise;

            expect(onReward).not.toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Interstitial Ads', () => {
        it('should not show interstitial if ads are removed', async () => {
            Ads.setAdsRemoved(true);
            const result = await Ads.showInterstitial();
            expect(result).toBe(false);
        });

        it('should show interstitial and enforce cooldown', async () => {
            const p1 = Ads.showInterstitial();
            vi.advanceTimersByTime(500);
            const firstResult = await p1;
            expect(firstResult).toBe(true);
            expect(Analytics.event).toHaveBeenCalledWith('interstitial_shown');

            // Try showing immediately again (within 120s cooldown)
            const secondResult = await Ads.showInterstitial();
            expect(secondResult).toBe(false);

            // Advance timers by 119 seconds (still in cooldown)
            vi.advanceTimersByTime(119000);
            const thirdResult = await Ads.showInterstitial();
            expect(thirdResult).toBe(false);

            // Advance remaining 1 second (out of cooldown)
            vi.advanceTimersByTime(1000);
            const p2 = Ads.showInterstitial();
            vi.advanceTimersByTime(500);
            const fourthResult = await p2;
            expect(fourthResult).toBe(true);
        });

        it('should check interstitial display on level completions', async () => {
            const spy = vi.spyOn(Ads, 'showInterstitial').mockResolvedValue(true);

            // level 1, frequency 3 -> no ad
            let result = await Ads.checkInterstitialOnLevelComplete(1, 3);
            expect(result).toBe(false);
            expect(spy).not.toHaveBeenCalled();

            // level 3, frequency 3 -> shows ad
            result = await Ads.checkInterstitialOnLevelComplete(3, 3);
            expect(result).toBe(true);
            expect(spy).toHaveBeenCalled();
        });
    });
});
