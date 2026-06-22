/**
 * Analytics System for Crowd Runner 3D
 *
 * Tracks key metrics like level starts, completions, IAP purchases,
 * ad views, and performance data. In production this integrates with
 * Firebase Analytics or a custom backend.
 *
 * Usage:
 *   import { Analytics } from './analytics.js';
 *   Analytics.levelStart(1);
 *   Analytics.iapPurchase('coins_small', 0.99);
 */

const ANALYTICS_KEY = 'crowdRunnerAnalytics';

class AnalyticsEngine {
    constructor() {
        this.queue = [];
        this.disabled = false;
        this.sessionId = this._generateSessionId();
        this.sessionStart = Date.now();

        // Load cached events for offline support
        this._loadCache();

        // Flush interval
        this.flushInterval = setInterval(() => this.flush(), 30000);

        // Track session duration on page unload
        window.addEventListener('beforeunload', () => this._trackSessionEnd());
    }

    _generateSessionId() {
        return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    }

    _loadCache() {
        try {
            const raw = localStorage.getItem(ANALYTICS_KEY);
            if (raw) this.queue = JSON.parse(raw);
        } catch (e) {
            this.queue = [];
        }
    }

    _saveCache() {
        try {
            localStorage.setItem(ANALYTICS_KEY, JSON.stringify(this.queue.slice(-500)));
        } catch (e) {
            // localStorage full — silently ignore
        }
    }

    _trackSessionEnd() {
        const duration = Math.floor((Date.now() - this.sessionStart) / 1000);
        this.event('session_end', { duration_seconds: duration });
        this.flush();
    }

    /**
     * Track a generic event
     * @param {string} name - Event name (e.g. 'level_start')
     * @param {Object} params - Event parameters
     */
    event(name, params = {}) {
        if (this.disabled) return;

        const event = {
            name,
            params: {
                ...params,
                session_id: this.sessionId,
                timestamp: Date.now(),
                platform: this._getPlatform()
            }
        };

        this.queue.push(event);
        this._saveCache();

        // Development logging
        if (import.meta.env?.DEV || location.hostname === 'localhost') {
            console.log(`[Analytics] ${name}`, params);
        }
    }

    _getPlatform() {
        if (window.Capacitor?.isNativePlatform()) {
            return window.Capacitor.getPlatform(); // 'ios' or 'android'
        }
        if (navigator.userAgent.includes('Android')) return 'android_web';
        if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) return 'ios_web';
        return 'web';
    }

    /**
     * Flush queued events to the server
     * In production: POST to your analytics endpoint or Firebase
     */
    async flush() {
        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0);
        this._saveCache();

        try {
            // In production, send to Firebase Analytics or your backend:
            // await fetch('https://api.example.com/analytics', {
            //     method: 'POST',
            //     body: JSON.stringify({ events: batch }),
            //     headers: { 'Content-Type': 'application/json' }
            // });

            // For now, log the batch
            if (batch.length > 0) {
                console.log(`[Analytics] Flushed ${batch.length} events`);
            }
        } catch (e) {
            // On failure, re-queue events
            this.queue = [...batch, ...this.queue];
            this._saveCache();
            console.warn('[Analytics] Flush failed, events re-queued:', e);
        }
    }

    // ─── Convenience Methods ───

    levelStart(level) {
        this.event('level_start', { level });
    }

    levelComplete(level, survivors, coins, stars) {
        this.event('level_complete', { level, survivors, coins, stars });
    }

    levelFail(level, troopsLost, coins) {
        this.event('level_fail', { level, troops_lost: troopsLost, coins });
    }

    iapPurchase(productId, price, currency = 'USD') {
        this.event('iap_purchase', { product_id: productId, price, currency });
    }

    adWatched(adType, rewardType) {
        this.event('ad_watched', { ad_type: adType, reward_type: rewardType });
    }

    achievementUnlocked(achievementId, achievementName) {
        this.event('achievement_unlocked', { achievement_id: achievementId, achievement_name: achievementName });
    }

    tutorialStep(step, totalSteps) {
        this.event('tutorial_step', { step, total_steps: totalSteps });
    }

    performanceReport(stats) {
        this.event('performance', stats);
    }

    /**
     * Track a rewarded ad impression and its outcome
     */
    rewardedAdComplete(adType, grantedReward) {
        this.adWatched(adType, grantedReward);
        this.event('rewarded_ad_complete', { ad_type: adType, reward: grantedReward });
    }

    /**
     * Track an error
     */
    error(errorType, errorMessage) {
        this.event('error', { error_type: errorType, message: errorMessage });
    }

    /**
     * Disable analytics (e.g., for GDPR consent)
     */
    setConsent(given) {
        this.disabled = !given;
        if (!given) {
            this.queue = [];
            this._saveCache();
        }
    }
}

// Singleton instance
export const Analytics = new AnalyticsEngine();