/**
 * In-App Purchase (IAP) SDK Integration for Crowd Runner 3D
 *
 * Provides a clean interface for real purchases via Capacitor IAP plugins.
 * In production, swap the stub with actual plugin calls.
 *
 * Currently supports:
 * - Coin packs (consumable)
 * - Remove Ads (non-consumable)
 * - Battle Pass (non-consumable)
 *
 * Integration targets:
 * - @capacitor/purchases (RevenueCat)
 * - Google Play Billing
 * - Apple App Store IAP
 *
 * Usage:
 *   import { IAP } from './iap.js';
 *   await IAP.initialize();
 *   const result = await IAP.purchase('coins_small');
 */

import { Analytics } from './analytics.js';

const IAP_STORAGE_KEY = 'crowdRunnerIAP';

class IAPManager {
    constructor() {
        this.initialized = false;
        this.products = [];
        this.purchases = {};
        this._loadPurchases();
    }

    _loadPurchases() {
        try {
            const raw = localStorage.getItem(IAP_STORAGE_KEY);
            if (raw) this.purchases = JSON.parse(raw);
        } catch (e) {
            this.purchases = {};
        }
    }

    _savePurchases() {
        try {
            localStorage.setItem(IAP_STORAGE_KEY, JSON.stringify(this.purchases));
        } catch (e) { /* silent */ }
    }

    /**
     * Product catalog
     */
    get PRODUCTS() {
        return [
            { id: 'coins_small', name: 'Small Coin Pack', price: 0.99, currency: 'USD', type: 'consumable', coins: 500 },
            { id: 'coins_medium', name: 'Medium Coin Pack', price: 2.99, currency: 'USD', type: 'consumable', coins: 2000 },
            { id: 'coins_large', name: 'Large Coin Pack', price: 9.99, currency: 'USD', type: 'consumable', coins: 10000 },
            { id: 'value_pack', name: 'Value Pack', price: 14.99, currency: 'USD', type: 'consumable', coins: 50000, bonus: 'battle_pass' },
            { id: 'remove_ads', name: 'Remove Ads', price: 1.99, currency: 'USD', type: 'non-consumable' },
            { id: 'battle_pass', name: 'Battle Pass Season 1', price: 4.99, currency: 'USD', type: 'non-consumable' },
            { id: 'starter_pack', name: 'Starter Pack', price: 2.99, currency: 'USD', type: 'consumable', coins: 1000, troops: 5, skin: 'gold' },
        ];
    }

    /**
     * Initialize the IAP SDK
     * Connects to RevenueCat / Google Play / App Store
     */
    async initialize() {
        if (this.initialized) return;

        console.log('[IAP] Initializing...');

        // In production with Capacitor:
        // const { Purchases } = await import('@capacitor/purchases');
        // await Purchases.setup({
        //     apiKey: 'your_revenuecat_api_key',
        //     appUserId: localStorage.getItem('crowdRunnerUserId')
        // });
        // this.products = await Purchases.getProducts(this.PRODUCTS.map(p => p.id));

        this.initialized = true;
        console.log('[IAP] Initialized successfully');
    }

    /**
     * Purchase a product
     * @param {string} productId - Product identifier
     * @returns {Object} Purchase result
     */
    async purchase(productId) {
        if (!this.initialized) await this.initialize();

        const product = this.PRODUCTS.find(p => p.id === productId);
        if (!product) {
            console.error('[IAP] Product not found:', productId);
            return { success: false, error: 'PRODUCT_NOT_FOUND' };
        }

        // Check if non-consumable already purchased
        if (product.type === 'non-consumable' && this.isPurchased(productId)) {
            console.warn('[IAP] Product already purchased:', productId);
            return { success: false, error: 'ALREADY_OWNED' };
        }

        console.log(`[IAP] Purchasing: ${product.name} (${product.price} ${product.currency})`);

        try {
            // In production:
            // const { Purchases } = await import('@capacitor/purchases');
            // const result = await Purchases.purchaseProduct({ productId });
            // Validate receipt server-side

            // Stub: simulate successful purchase
            await new Promise(resolve => setTimeout(resolve, 500));

            // Record purchase
            this._recordPurchase(productId, product);
            Analytics.iapPurchase(productId, product.price);

            return {
                success: true,
                product: product,
                transactionId: 'txn_' + Date.now().toString(36),
                timestamp: Date.now()
            };
        } catch (e) {
            console.error('[IAP] Purchase failed:', e);
            return { success: false, error: e.message || 'PURCHASE_FAILED' };
        }
    }

    /**
     * Record a purchase in local storage
     */
    _recordPurchase(productId, product) {
        this.purchases[productId] = {
            id: productId,
            transactionId: 'txn_' + Date.now().toString(36),
            timestamp: Date.now(),
            price: product.price,
            currency: product.currency
        };
        this._savePurchases();
    }

    /**
     * Check if a non-consumable product has been purchased
     */
    isPurchased(productId) {
        return !!this.purchases[productId];
    }

    /**
     * Restore previous purchases (important for iOS)
     */
    async restorePurchases() {
        console.log('[IAP] Restoring purchases...');

        try {
            // In production:
            // const { Purchases } = await import('@capacitor/purchases');
            // const restored = await Purchases.restorePurchases();
            // restored.purchases.forEach(p => this._recordPurchase(p.productId, p));

            // Stub: load from local storage
            this._loadPurchases();
            return { success: true, restored: Object.keys(this.purchases).length };
        } catch (e) {
            console.error('[IAP] Restore failed:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Get the local price for a product
     */
    getLocalizedPrice(productId) {
        const product = this.PRODUCTS.find(p => p.id === productId);
        return product ? `$${product.price.toFixed(2)}` : '$--';
    }

    /**
     * Validate a receipt server-side
     * In production, send to your backend for verification
     */
    async validateReceipt(receipt) {
        console.log('[IAP] Validating receipt...');
        // const response = await fetch('https://api.example.com/validate-receipt', {
        //     method: 'POST',
        //     body: JSON.stringify({ receipt, userId: this.userId })
        // });
        return true;
    }

    /**
     * Clear all purchases (for testing)
     */
    async clear() {
        this.purchases = {};
        this._savePurchases();
        console.log('[IAP] Purchases cleared');
    }
}

// Singleton instance
export const IAP = new IAPManager();