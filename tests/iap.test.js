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

// Mock Analytics
vi.mock('../src/analytics.js', () => {
    return {
        Analytics: {
            iapPurchase: vi.fn()
        }
    };
});

// Import IAP
import { IAP } from '../src/iap.js';
import { Analytics } from '../src/analytics.js';

describe('In-App Purchase (IAP) Manager', () => {
    beforeEach(() => {
        localStorage.clear();
        IAP.initialized = false;
        IAP.purchases = {};
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize successfully', async () => {
        expect(IAP.initialized).toBe(false);
        await IAP.initialize();
        expect(IAP.initialized).toBe(true);
    });

    it('should format localized price', () => {
        expect(IAP.getLocalizedPrice('coins_small')).toBe('$0.99');
        expect(IAP.getLocalizedPrice('coins_large')).toBe('$9.99');
        expect(IAP.getLocalizedPrice('unknown_product')).toBe('$--');
    });

    describe('Purchasing', () => {
        it('should reject purchase of invalid product ID', async () => {
            const result = await IAP.purchase('invalid_id');
            expect(result.success).toBe(false);
            expect(result.error).toBe('PRODUCT_NOT_FOUND');
        });

        it('should allow purchase of valid consumable product', async () => {
            const result = await IAP.purchase('coins_small');
            expect(result.success).toBe(true);
            expect(result.product.id).toBe('coins_small');
            expect(result.transactionId).toBeDefined();
            expect(IAP.isPurchased('coins_small')).toBe(true);
            expect(Analytics.iapPurchase).toHaveBeenCalledWith('coins_small', 0.99);
        });

        it('should allow multiple purchases of consumable products', async () => {
            const r1 = await IAP.purchase('coins_small');
            expect(r1.success).toBe(true);

            const r2 = await IAP.purchase('coins_small');
            expect(r2.success).toBe(true);
        });

        it('should prevent purchase of already owned non-consumable product', async () => {
            // First purchase of non-consumable (e.g. remove_ads)
            const r1 = await IAP.purchase('remove_ads');
            expect(r1.success).toBe(true);
            expect(IAP.isPurchased('remove_ads')).toBe(true);

            // Attempt second purchase of same non-consumable
            const r2 = await IAP.purchase('remove_ads');
            expect(r2.success).toBe(false);
            expect(r2.error).toBe('ALREADY_OWNED');
        });
    });

    describe('Restoration and Cache Management', () => {
        it('should restore previous purchases from localStorage', async () => {
            const rawPurchases = {
                remove_ads: {
                    id: 'remove_ads',
                    transactionId: 'txn_123',
                    timestamp: Date.now(),
                    price: 1.99,
                    currency: 'USD'
                }
            };
            localStorage.setItem('crowdRunnerIAP', JSON.stringify(rawPurchases));

            // Load and restore
            const restoreResult = await IAP.restorePurchases();
            expect(restoreResult.success).toBe(true);
            expect(restoreResult.restored).toBe(1);
            expect(IAP.isPurchased('remove_ads')).toBe(true);
        });

        it('should clear purchases', async () => {
            await IAP.purchase('remove_ads');
            expect(IAP.isPurchased('remove_ads')).toBe(true);

            await IAP.clear();
            expect(IAP.isPurchased('remove_ads')).toBe(false);
            expect(localStorage.getItem('crowdRunnerIAP')).toBe('{}');
        });
    });
});
