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

// Ensure navigator and screen properties are mocked
if (typeof navigator === 'undefined') {
    globalThis.navigator = {
        userAgent: 'Mozilla/5.0 NodeTest',
        language: 'en-US'
    };
}
if (typeof screen === 'undefined') {
    globalThis.screen = {
        width: 1920,
        height: 1080
    };
}

// Import CloudSave
import { CloudSave } from '../src/cloud-save.js';

describe('Cloud Save System', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        CloudSave.initialized = false;
        CloudSave.userId = null;
        CloudSave.lastSync = 0;
        CloudSave.pendingSync = false;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should initialize and generate a unique user ID if none exists', async () => {
        expect(CloudSave.userId).toBeNull();
        await CloudSave.init();
        expect(CloudSave.userId).toBeDefined();
        expect(CloudSave.userId).toMatch(/^(user_|anon_)/);
        expect(localStorage.setItem).toHaveBeenCalledWith('crowdRunnerUserId', CloudSave.userId);
    });

    it('should load an existing user ID if present', async () => {
        localStorage.setItem('crowdRunnerUserId', 'existing_user_123');
        await CloudSave.init();
        expect(CloudSave.userId).toBe('existing_user_123');
    });

    it('should trigger sync on init if more than 5 minutes elapsed since last sync', async () => {
        localStorage.setItem('crowdRunnerLastSync', String(Date.now() - 6 * 60 * 1000));
        const syncSpy = vi.spyOn(CloudSave, 'sync').mockResolvedValue();

        await CloudSave.init();
        expect(syncSpy).toHaveBeenCalled();
    });

    it('should not trigger sync on init if less than 5 minutes elapsed', async () => {
        localStorage.setItem('crowdRunnerLastSync', String(Date.now() - 2 * 60 * 1000));
        const syncSpy = vi.spyOn(CloudSave, 'sync').mockResolvedValue();

        await CloudSave.init();
        expect(syncSpy).not.toHaveBeenCalled();
    });

    it('should save game data locally and schedule a sync', async () => {
        await CloudSave.init();
        const syncSpy = vi.spyOn(CloudSave, 'sync').mockResolvedValue();

        const testData = { coins: 50, level: 3 };
        const saveResult = await CloudSave.save(testData);
        expect(saveResult).toBe(true);

        // Verify local storage has the saved package
        const savedRaw = localStorage.getItem('crowdRunnerCloud');
        expect(savedRaw).toBeDefined();
        const savedPkg = JSON.parse(savedRaw);
        expect(savedPkg.data).toEqual(testData);
        expect(savedPkg.userId).toBe(CloudSave.userId);
        expect(savedPkg.deviceFingerprint).toContain('Mozilla');

        // Verify sync is scheduled (pendingSync is true)
        expect(CloudSave.pendingSync).toBe(true);

        // Advance timers by 2 seconds to fire the sync
        vi.advanceTimersByTime(2000);
        expect(syncSpy).toHaveBeenCalled();
    });

    it('should load saved game data locally', async () => {
        await CloudSave.init();
        const testData = { coins: 150, level: 10 };
        await CloudSave.save(testData);

        const loadedData = await CloudSave.load();
        expect(loadedData).toEqual(testData);
    });

    it('should fallback to cloud load if local storage is corrupt or missing', async () => {
        await CloudSave.init();
        
        // Mock cloud fetch
        const cloudData = { coins: 500, level: 25 };
        vi.spyOn(CloudSave, '_fetchFromCloud').mockResolvedValue(cloudData);

        const loadedData = await CloudSave.load();
        expect(loadedData).toEqual(cloudData);

        // Verification: cloud data should also be saved locally now
        const savedRaw = localStorage.getItem('crowdRunnerCloud');
        const savedPkg = JSON.parse(savedRaw);
        expect(savedPkg.data).toEqual(cloudData);
    });

    it('should enforce sync cooldown (10 seconds)', async () => {
        await CloudSave.init();
        const localData = { data: { coins: 10 }, timestamp: Date.now(), version: 1 };
        localStorage.setItem('crowdRunnerCloud', JSON.stringify(localData));

        // First sync
        await CloudSave.sync();
        const firstSyncTime = CloudSave.lastSync;
        expect(firstSyncTime).toBeGreaterThan(0);

        // Immediate second sync should be skipped due to cooldown
        await CloudSave.sync();
        expect(CloudSave.lastSync).toBe(firstSyncTime);

        // Advance timers by 9 seconds (still in cooldown)
        vi.advanceTimersByTime(9000);
        await CloudSave.sync();
        expect(CloudSave.lastSync).toBe(firstSyncTime);

        // Advance remaining 1 second (out of cooldown)
        vi.advanceTimersByTime(1000);
        await CloudSave.sync();
        expect(CloudSave.lastSync).toBeGreaterThan(firstSyncTime);
    });

    it('should link email', async () => {
        await CloudSave.init();
        const result = await CloudSave.linkEmail('player@example.com');
        expect(result).toBe(true);
        expect(localStorage.setItem).toHaveBeenCalledWith('crowdRunnerEmail', 'player@example.com');
    });

    it('should reject invalid email linking', async () => {
        await CloudSave.init();
        const result = await CloudSave.linkEmail('invalid-email');
        expect(result).toBe(false);
    });

    it('should clear save data', async () => {
        await CloudSave.init();
        await CloudSave.save({ coins: 100 });
        expect(localStorage.getItem('crowdRunnerCloud')).toBeDefined();

        await CloudSave.clear();
        expect(localStorage.removeItem).toHaveBeenCalledWith('crowdRunnerCloud');
        expect(localStorage.removeItem).toHaveBeenCalledWith('crowdRunnerLastSync');
    });
});
