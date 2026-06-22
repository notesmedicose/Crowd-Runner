// ─── Game Tuning Constants ───
export const SCROLL_SPEED_BASE = 40;
export const SCROLL_SPEED_FIGHT = 0.2;
export const MAX_CROWD = 1000;
export const TROOP_FIGHT_INTERVAL = 0.5;
export const TROOP_DEATH_CHANCE = 0.2;
export const LEVEL_BASE_LENGTH = 400;
export const LEVEL_LENGTH_SCALE = 80;
export const SEPARATION_NEIGHBORS = 60;
export const SEPARATION_SKIP_RAND = 0.3;
export const GATE_SPAWN_INTERVAL = 80;
export const BONUS_COINS_RATIO = 0.5;

// ─── Difficulty Curve Helpers ───

/**
 * Bosses become more common at higher levels: 80% at level 1, 40% at level 20+
 * Returns the chance that an enemy spawn is NOT a boss (higher = more normal enemies)
 */
export function getBossSpawnChance(level) {
    return Math.max(0.4, 0.8 - (level - 1) * 0.02);
}

/**
 * Enemies get tougher: 2 HP at level 1, 12 HP at level 20
 */
export function getEnemyBaseHp(level) {
    return 2 + Math.floor(level * 0.5);
}

/**
 * Boss HP scales smoothly
 */
export function getBossHp(level) {
    return 50 + 40 * level;
}

/**
 * More enemies at higher levels: 3 at level 1, 23 at level 20
 */
export function getEnemyCount(level) {
    return Math.floor(Math.random() * 5) + 3 + level;
}

/**
 * Gate bonuses scale with level: 5-25 at level 1, 11-31 at level 20
 */
export function getGateAddValue(level) {
    return Math.floor(Math.random() * 20) + 5 + Math.floor(level * 0.3);
}

/**
 * Penalty gates also scale: 3-10 at level 1, 3-30 at level 20
 */
export function getGateSubValue(level) {
    return Math.floor(Math.random() * 8) + 3 + Math.floor(level * 0.5);
}

/**
 * More coins per spawn at higher levels: 8 at level 1, 28 at level 20
 */
export function getCoinSpawnCount(level) {
    return 8 + level;
}

/**
 * Bonus coins scale with level: 0.5x at level 1, 2.5x at level 20
 */
export function getBonusCoinMultiplier(level) {
    return 0.5 + level * 0.1;
}

// ─── Save State ───

export const SAVE_KEY = 'crowdRunnerSave2';
export const DEFAULT_SAVE = {
    coins: 0,
    upgradeTroops: 1,
    upgradeAttack: 1,
    upgradeMagnet: 1,
    level: 1,
    // --- New Fields ---
    questProgress: 0,        // number of shield/magnet powerups collected
    questCompleted: false,   // whether weapon/skin is unlocked
    unlockedSkies: ['default'],
    selectedSky: 'default',
    unlockedSpaceObjects: ['none'],
    selectedSpaceObject: 'none',
    decorTreesLvl: 0,        // Upgrade levels (0 to 5)
    decorPondsLvl: 0,
    decorAnimalsLvl: 0
};

/**
 * Validate save data against corruption
 */
export function validateSave(data) {
    if (typeof data !== 'object' || data === null) return false;
    if (typeof data.coins !== 'number' || data.coins < 0) return false;
    if (typeof data.upgradeTroops !== 'number' || data.upgradeTroops < 1) return false;
    if (typeof data.upgradeAttack !== 'number' || data.upgradeAttack < 1) return false;
    if (typeof data.upgradeMagnet !== 'number' || data.upgradeMagnet < 1) return false;
    if (typeof data.level !== 'number' || data.level < 1) return false;

    // Add default values for new fields if they don't exist
    if (typeof data.questProgress !== 'number') data.questProgress = 0;
    if (typeof data.questCompleted !== 'boolean') data.questCompleted = false;
    if (!Array.isArray(data.unlockedSkies)) data.unlockedSkies = ['default'];
    if (typeof data.selectedSky !== 'string') data.selectedSky = 'default';
    if (!Array.isArray(data.unlockedSpaceObjects)) data.unlockedSpaceObjects = ['none'];
    if (typeof data.selectedSpaceObject !== 'string') data.selectedSpaceObject = 'none';
    if (typeof data.decorTreesLvl !== 'number') data.decorTreesLvl = 0;
    if (typeof data.decorPondsLvl !== 'number') data.decorPondsLvl = 0;
    if (typeof data.decorAnimalsLvl !== 'number') data.decorAnimalsLvl = 0;

    return true;
}

/**
 * Calculate upgrade cost based on level and type
 */
export function getUpgradeCost(level, type) {
    if (type === 'attack') return level * 15;
    if (type === 'magnet') return level * 12;
    if (type === 'decor_trees') return (level + 1) * 50;
    if (type === 'decor_ponds') return (level + 1) * 60;
    if (type === 'decor_animals') return (level + 1) * 80;
    return level * 10;
}

// ─── Star Rating ───

/**
 * Calculate star rating based on surviving troop count
 */
export function getStarRating(survivorCount) {
    if (survivorCount >= 50) return '⭐⭐⭐';
    if (survivorCount >= 20) return '⭐⭐';
    return '⭐';
}

// ─── Biome Info ───

export const BIOME_INFO = [
    { name: 'Utopia Day', badge: 'UTOPIA', accent: '#00e5ff', desc: 'Build your army through the golden city gates.', nextName: 'Wasteland Night' },
    { name: 'Wasteland Night', badge: 'WASTELAND', accent: '#ff4422', desc: 'Survive the ruins. The enemies are stronger here.', nextName: 'Neon City Night' },
    { name: 'Neon City Night', badge: 'NEON CITY', accent: '#ff00ff', desc: 'Slick cyberpunk speedway. Watch your corners.', nextName: 'Arctic Tundra' },
    { name: 'Arctic Tundra', badge: 'TUNDRA', accent: '#aaddff', desc: 'Battle through freezing snow and icy winds.', nextName: 'Lava Fields' },
    { name: 'Lava Fields', badge: 'LAVA FIELDS', accent: '#ff4500', desc: 'Avoid boiling lava pools and ash clouds.', nextName: 'Dune Desert' },
    { name: 'Dune Desert', badge: 'DUNE', accent: '#ffaa00', desc: 'Scorchingly hot sands. Burst gates appear here.', nextName: 'Crystal Caves' },
    { name: 'Crystal Caves', badge: 'CRYSTAL', accent: '#aa00ff', desc: 'Prismatic tunnels. Shards grant random multipliers.', nextName: 'Void Abyss' },
    { name: 'Void Abyss', badge: 'VOID', accent: '#8800ff', desc: 'Reality warps. Expect the impossible.', nextName: 'Utopia Day' }
];

/**
 * Get biome info for a given level
 * Cycles through ALL 8 biomes properly — FIX: was only cycling through first 5
 */
export function getBiomeInfo(level) {
    return BIOME_INFO[(level - 1) % BIOME_INFO.length];
}

// ─── Achievement Definitions ───

export const ACHIEVEMENTS = {
    FIRST_BLOOD: { id: 'first_blood', name: 'First Blood', desc: 'Complete Level 1' },
    ARMY_BUILDER: { id: 'army_builder', name: 'Army Builder', desc: 'Reach 100 troops' },
    UNSTOPPABLE: { id: 'unstoppable', name: 'Unstoppable', desc: 'Complete Level 10' },
    RICH: { id: 'rich', name: 'Rich', desc: 'Collect 1000 coins total' },
    BOSS_HUNTER: { id: 'boss_hunter', name: 'Boss Hunter', desc: 'Kill 10 bosses' }
};

// ─── Skin Definitions ───

export const AVAILABLE_SKINS = [
    { id: 'cyan', name: 'Cyan', color: 0x00e5ff, cost: 0, unlocked: true },
    { id: 'gold', name: 'Gold', color: 0xffd700, cost: 100, unlocked: false },
    { id: 'crimson', name: 'Crimson', color: 0xff3333, cost: 100, unlocked: false },
    { id: 'neon-green', name: 'Neon Green', color: 0x00ff66, cost: 150, unlocked: false },
    { id: 'purple', name: 'Purple', color: 0xaa00ff, cost: 150, unlocked: false },
    { id: 'plasma', name: 'Plasma', color: 0xff00ff, cost: 0, unlocked: false },
];

// ─── IAP Product Definitions ───

export const IAP_PRODUCTS = [
    { id: 'coins_small', name: 'Coin Pack (500)', price: '$0.99', coins: 500 },
    { id: 'coins_medium', name: 'Coin Pack (2000)', price: '$2.99', coins: 2000 },
    { id: 'coins_large', name: 'Coin Pack (10000)', price: '$9.99', coins: 10000 },
    { id: 'remove_ads', name: 'Remove Ads', price: '$1.99', coins: 0 },
];

// ─── Daily Rewards ───

export const DAILY_REWARDS = [50, 75, 100, 150, 200, 300, 500];