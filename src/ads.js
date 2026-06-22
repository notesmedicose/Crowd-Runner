/**
 * Ad Integration Module for Crowd Runner 3D
 *
 * Provides rewarded video ads, interstitial ads, and banner ad support.
 * In production, this integrates with AdMob via Capacitor plugin.
 *
 * Ad Types:
 * - Rewarded: Watch to revive, get bonus coins, XP boost
 * - Interstitial: Shown between levels
 * - Banner: Shown on main menu (non-intrusive)
 *
 * Usage:
 *   import { Ads } from './ads.js';
 *   await Ads.initialize();
 *   Ads.showRewardedAd({ onReward: (type) => handleReward(type) });
 */

import { Analytics } from './analytics.js';

class AdManager {
    constructor() {
        this.initialized = false;
        this.adsRemoved = false; // Set true if user purchased remove_ads
        this.adCounter = 0;
        this.lastInterstitialTime = 0;
        this.interstitialCooldown = 120000; // 2 minutes between interstitials

        // Check if ads removed
        try {
            const iap = JSON.parse(localStorage.getItem('crowdRunnerIAP') || '{}');
            if (iap.remove_ads) this.adsRemoved = true;
        } catch (e) { }
    }

    /**
     * Initialize ad SDKs
     */
    async initialize() {
        if (this.initialized) return;

        console.log('[Ads] Initializing...');

        // In production with Capacitor:
        // const { AdMob } = await import('@capacitor/admob');
        // await AdMob.initialize();

        this.initialized = true;
        console.log('[Ads] Initialized successfully');
    }

    /**
     * Show a rewarded video ad
     * @param {Object} options
     * @param {Function} options.onReward - Called with reward type when ad completes
     * @param {Function} options.onClose - Called when user closes ad without reward
     * @param {string} options.rewardType - 'coins', 'revive', 'xp_boost'
     */
    async showRewardedAd({ onReward, onClose, rewardType = 'coins' } = {}) {
        if (this.adsRemoved) {
            console.log('[Ads] Ads removed by user purchase');
            if (onReward) onReward(rewardType);
            return;
        }

        console.log('[Ads] Showing rewarded ad for:', rewardType);

        // In production:
        // const { AdMob } = await import('@capacitor/admob');
        // const result = await AdMob.showRewardedVideoAd();
        // if (result.reward) { onReward(rewardType); }

        // Stub: simulate ad view
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 90% chance of successful completion (simulates real ad fill rate)
        const success = Math.random() < 0.9;

        if (success) {
            Analytics.rewardedAdComplete('rewarded', rewardType);
            if (onReward) onReward(rewardType);
        } else {
            console.log('[Ads] Ad not ready, skipping...');
            if (onClose) onClose();
        }
    }

    /**
     * Show an interstitial ad (e.g., between levels)
     * Respects cooldown to avoid annoying users
     */
    async showInterstitial() {
        if (this.adsRemoved) return false;

        const now = Date.now();
        if (now - this.lastInterstitialTime < this.interstitialCooldown) {
            return false; // Too soon
        }

        this.adCounter++;
        this.lastInterstitialTime = now;

        console.log('[Ads] Showing interstitial ad');

        // In production:
        // const { AdMob } = await import('@capacitor/admob');
        // await AdMob.showInterstitialAd();

        // Stub: simulate
        await new Promise(resolve => setTimeout(resolve, 500));
        Analytics.event('interstitial_shown');

        return true;
    }

    /**
     * Show a banner ad on the main menu
     */
    async showBanner() {
        if (this.adsRemoved) return;

        console.log('[Ads] Showing banner ad');

        // In production:
        // const { AdMob } = await import('@capacitor/admob');
        // await AdMob.showBannerAd({
        //     position: 'bottom',
        //     adSize: 'BANNER'
        // });
    }

    /**
     * Hide banner ad
     */
    async hideBanner() {
        // In production:
        // const { AdMob } = await import('@capacitor/admob');
        // await AdMob.hideBannerAd();
        console.log('[Ads] Banner hidden');
    }

    /**
     * Show interstitial ad every N level completions
     * @param {number} level - The level just completed
     * @param {number} frequency - Show every N levels (default: 3)
     */
    async checkInterstitialOnLevelComplete(level, frequency = 3) {
        if (this.adsRemoved) return false;
        if (level % frequency === 0) {
            return await this.showInterstitial();
        }
        return false;
    }

    /**
     * Get coin reward amount for watching an ad
     */
    getRewardedCoinAmount(baseAmount = 100) {
        // Bonus during events
        try {
            const ev = JSON.parse(localStorage.getItem('crowdRunnerEvent') || '{}');
            if (ev.active && Date.now() < ev.end) {
                return Math.floor(baseAmount * (ev.multiplier || 1));
            }
        } catch (e) { }
        return baseAmount;
    }

    /**
     * Update ads removed status
     */
    setAdsRemoved(value) {
        this.adsRemoved = value;
    }

    /**
     * Check if ads are enabled
     */
    get areAdsEnabled() {
        return !this.adsRemoved;
    }
}

// Singleton instance
export const Ads = new AdManager();