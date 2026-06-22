import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getBossSpawnChance,
    getEnemyBaseHp,
    getBossHp,
    getEnemyCount,
    getGateAddValue,
    getGateSubValue,
    getCoinSpawnCount,
    getBonusCoinMultiplier,
    validateSave,
    getUpgradeCost,
    getStarRating,
    getBiomeInfo,
    BIOME_INFO,
    DEFAULT_SAVE,
    SCROLL_SPEED_BASE,
    SCROLL_SPEED_FIGHT,
    MAX_CROWD,
    LEVEL_BASE_LENGTH,
    LEVEL_LENGTH_SCALE,
    DAILY_REWARDS
} from '../src/game-logic.js';

describe('Difficulty Curve Helpers', () => {
    describe('getBossSpawnChance', () => {
        it('should return 0.8 at level 1', () => {
            expect(getBossSpawnChance(1)).toBe(0.8);
        });

        it('should decrease with level', () => {
            expect(getBossSpawnChance(5)).toBeLessThan(getBossSpawnChance(1));
            expect(getBossSpawnChance(10)).toBeLessThan(getBossSpawnChance(5));
        });

        it('should floor at 0.4 from level 21 onward', () => {
            expect(getBossSpawnChance(21)).toBe(0.4);
            expect(getBossSpawnChance(100)).toBe(0.4);
        });

        it('should decrease by 0.02 per level', () => {
            expect(getBossSpawnChance(2)).toBe(0.78);
            expect(getBossSpawnChance(3)).toBe(0.76);
        });
    });

    describe('getEnemyBaseHp', () => {
        it('should return 2 at level 1', () => {
            expect(getEnemyBaseHp(1)).toBe(2);
        });

        it('should scale with level', () => {
            expect(getEnemyBaseHp(10)).toBe(7);
            expect(getEnemyBaseHp(20)).toBe(12);
        });

        it('should always return integer', () => {
            for (let lv = 1; lv <= 50; lv++) {
                expect(Number.isInteger(getEnemyBaseHp(lv))).toBe(true);
            }
        });
    });

    describe('getBossHp', () => {
        it('should return 90 at level 1', () => {
            expect(getBossHp(1)).toBe(90);
        });

        it('should scale linearly with level', () => {
            expect(getBossHp(5)).toBe(250);
            expect(getBossHp(10)).toBe(450);
            expect(getBossHp(20)).toBe(850);
        });

        it('should always increase with level', () => {
            for (let lv = 1; lv < 50; lv++) {
                expect(getBossHp(lv + 1)).toBeGreaterThan(getBossHp(lv));
            }
        });
    });

    describe('getEnemyCount', () => {
        beforeEach(() => {
            // Mock Math.random to return a consistent value
            vi.spyOn(Math, 'random').mockReturnValue(0.5);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should return base count for level', () => {
            // With Math.random = 0.5: floor(0.5 * 5) = 2
            expect(getEnemyCount(1)).toBe(6);
            expect(getEnemyCount(5)).toBe(10);
        });

        it('should increase with level', () => {
            expect(getEnemyCount(10)).toBe(15);
            expect(getEnemyCount(20)).toBe(25);
        });
    });

    describe('getGateAddValue', () => {
        beforeEach(() => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should return scaled value for level', () => {
            // floor(0.5 * 20) = 10, so 10 + 5 + floor(1 * 0.3) = 15
            expect(getGateAddValue(1)).toBe(15);
        });

        it('should increase with level', () => {
            const val1 = getGateAddValue(1);
            const val10 = getGateAddValue(10);
            expect(val10).toBeGreaterThanOrEqual(val1);
        });
    });

    describe('getGateSubValue', () => {
        beforeEach(() => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should return scaled value for level', () => {
            // floor(0.5 * 8) = 4, so 4 + 3 + floor(1 * 0.5) = 7
            expect(getGateSubValue(1)).toBe(7);
        });
    });

    describe('getCoinSpawnCount', () => {
        it('should return base 9 at level 1', () => {
            expect(getCoinSpawnCount(1)).toBe(9);
        });

        it('should increase by 1 per level', () => {
            expect(getCoinSpawnCount(5)).toBe(13);
            expect(getCoinSpawnCount(20)).toBe(28);
        });
    });

    describe('getBonusCoinMultiplier', () => {
        it('should return 0.6 at level 1', () => {
            expect(getBonusCoinMultiplier(1)).toBe(0.6);
        });

        it('should scale with level', () => {
            expect(getBonusCoinMultiplier(5)).toBe(1.0);
            expect(getBonusCoinMultiplier(10)).toBe(1.5);
            expect(getBonusCoinMultiplier(20)).toBe(2.5);
        });
    });
});

describe('Save State Validation', () => {
    it('should accept valid save data', () => {
        expect(validateSave({ ...DEFAULT_SAVE })).toBe(true);
    });

    it('should reject null', () => {
        expect(validateSave(null)).toBe(false);
    });

    it('should reject non-objects', () => {
        expect(validateSave('string')).toBe(false);
        expect(validateSave(123)).toBe(false);
        expect(validateSave(undefined)).toBe(false);
    });

    it('should reject negative coins', () => {
        expect(validateSave({ ...DEFAULT_SAVE, coins: -1 })).toBe(false);
    });

    it('should reject zero upgrades', () => {
        expect(validateSave({ ...DEFAULT_SAVE, upgradeTroops: 0 })).toBe(false);
        expect(validateSave({ ...DEFAULT_SAVE, upgradeAttack: 0 })).toBe(false);
        expect(validateSave({ ...DEFAULT_SAVE, upgradeMagnet: 0 })).toBe(false);
    });

    it('should reject level less than 1', () => {
        expect(validateSave({ ...DEFAULT_SAVE, level: 0 })).toBe(false);
    });

    it('should accept high values', () => {
        expect(validateSave({
            coins: 999999,
            upgradeTroops: 50,
            upgradeAttack: 50,
            upgradeMagnet: 50,
            level: 999
        })).toBe(true);
    });

    it('should reject missing fields', () => {
        expect(validateSave({ coins: 100, upgradeTroops: 1 })).toBe(false);
        expect(validateSave({})).toBe(false);
    });

    it('should fill in defaults for new fields if they are missing', () => {
        const minimalSave = {
            coins: 100,
            upgradeTroops: 2,
            upgradeAttack: 3,
            upgradeMagnet: 1,
            level: 5
        };
        expect(validateSave(minimalSave)).toBe(true);
        expect(minimalSave.questProgress).toBe(0);
        expect(minimalSave.questCompleted).toBe(false);
        expect(minimalSave.unlockedSkies).toEqual(['default']);
        expect(minimalSave.selectedSky).toBe('default');
        expect(minimalSave.unlockedSpaceObjects).toEqual(['none']);
        expect(minimalSave.selectedSpaceObject).toBe('none');
        expect(minimalSave.decorTreesLvl).toBe(0);
        expect(minimalSave.decorPondsLvl).toBe(0);
        expect(minimalSave.decorAnimalsLvl).toBe(0);
    });
});

describe('Upgrade Costs', () => {
    it('should calculate troops cost', () => {
        expect(getUpgradeCost(1, 'troops')).toBe(10);
        expect(getUpgradeCost(5, 'troops')).toBe(50);
        expect(getUpgradeCost(10, 'troops')).toBe(100);
    });

    it('should calculate attack cost', () => {
        expect(getUpgradeCost(1, 'attack')).toBe(15);
        expect(getUpgradeCost(5, 'attack')).toBe(75);
        expect(getUpgradeCost(10, 'attack')).toBe(150);
    });

    it('should calculate magnet cost', () => {
        expect(getUpgradeCost(1, 'magnet')).toBe(12);
        expect(getUpgradeCost(5, 'magnet')).toBe(60);
        expect(getUpgradeCost(10, 'magnet')).toBe(120);
    });

    it('should calculate decor upgrades cost', () => {
        expect(getUpgradeCost(0, 'decor_trees')).toBe(50);
        expect(getUpgradeCost(4, 'decor_trees')).toBe(250);
        expect(getUpgradeCost(0, 'decor_ponds')).toBe(60);
        expect(getUpgradeCost(4, 'decor_ponds')).toBe(300);
        expect(getUpgradeCost(0, 'decor_animals')).toBe(80);
        expect(getUpgradeCost(4, 'decor_animals')).toBe(400);
    });

    it('should default to troops cost for unknown type', () => {
        expect(getUpgradeCost(1, 'unknown')).toBe(10);
    });
});

describe('Star Rating', () => {
    it('should return 3 stars for 50+ survivors', () => {
        expect(getStarRating(50)).toBe('⭐⭐⭐');
        expect(getStarRating(100)).toBe('⭐⭐⭐');
    });

    it('should return 2 stars for 20-49 survivors', () => {
        expect(getStarRating(20)).toBe('⭐⭐');
        expect(getStarRating(30)).toBe('⭐⭐');
        expect(getStarRating(49)).toBe('⭐⭐');
    });

    it('should return 1 star for less than 20 survivors', () => {
        expect(getStarRating(0)).toBe('⭐');
        expect(getStarRating(10)).toBe('⭐');
        expect(getStarRating(19)).toBe('⭐');
    });

    it('should handle edge case of exactly 20', () => {
        expect(getStarRating(20)).toBe('⭐⭐');
    });

    it('should handle edge case of exactly 50', () => {
        expect(getStarRating(50)).toBe('⭐⭐⭐');
    });
});

describe('Biome Info', () => {
    it('should cycle through 5 biomes', () => {
        expect(getBiomeInfo(1).badge).toBe('UTOPIA');
        expect(getBiomeInfo(2).badge).toBe('WASTELAND');
        expect(getBiomeInfo(3).badge).toBe('NEON CITY');
        expect(getBiomeInfo(4).badge).toBe('TUNDRA');
        expect(getBiomeInfo(5).badge).toBe('LAVA FIELDS');
    });

    it('should wrap around level 9 to biome 1 (8-biome cycle)', () => {
        expect(getBiomeInfo(6).badge).toBe('DUNE');
        expect(getBiomeInfo(8).badge).toBe('VOID');
        expect(getBiomeInfo(9).badge).toBe('UTOPIA');
    });

    it('should have correct accent colors', () => {
        expect(getBiomeInfo(1).accent).toBe('#00e5ff');
        expect(getBiomeInfo(2).accent).toBe('#ff4422');
        expect(getBiomeInfo(3).accent).toBe('#ff00ff');
        expect(getBiomeInfo(4).accent).toBe('#aaddff');
        expect(getBiomeInfo(5).accent).toBe('#ff4500');
    });
});

describe('Constants', () => {
    it('should have correct base values', () => {
        expect(SCROLL_SPEED_BASE).toBe(40);
        expect(SCROLL_SPEED_FIGHT).toBe(0.2);
        expect(MAX_CROWD).toBe(1000);
        expect(LEVEL_BASE_LENGTH).toBe(400);
        expect(LEVEL_LENGTH_SCALE).toBe(80);
    });

    it('should have 7 daily rewards', () => {
        expect(DAILY_REWARDS).toHaveLength(7);
        expect(DAILY_REWARDS[0]).toBe(50);
        expect(DAILY_REWARDS[6]).toBe(500);
    });
});