import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import {
    BIOME_INFO, getBiomeInfo, getStarRating,
    getBossSpawnChance, getEnemyBaseHp, getBossHp, getEnemyCount,
    getGateAddValue, getGateSubValue, getCoinSpawnCount, getBonusCoinMultiplier,
    getUpgradeCost, validateSave
} from './src/game-logic.js';

// --- Loading Screen ---
const loadingScreen = document.getElementById('loading-screen');
const loadingBarFill = document.getElementById('loading-bar-fill');
const loadingTextEl = document.getElementById('loading-text');
const webglErrorEl = document.getElementById('webgl-error');

function updateLoading(pct, text) {
    if (loadingBarFill) loadingBarFill.style.width = pct + '%';
    if (loadingTextEl) loadingTextEl.textContent = text || 'Loading...';
}

// --- Audio Mute State ---
let isMuted = false;
try {
    isMuted = localStorage.getItem('crowdRunnerMuted') === 'true';
} catch (e) { }
const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        try { localStorage.setItem('crowdRunnerMuted', isMuted ? 'true' : 'false'); } catch (e) { }
    });
}

// --- Tutorial State ---
const TUTORIAL_KEY = 'crowdRunnerTutorialDone';
let tutorialDone = false;
try { tutorialDone = localStorage.getItem(TUTORIAL_KEY) === 'true'; } catch (e) { }
const tutorialOverlay = document.getElementById('tutorial-overlay');

function showTutorial() {
    if (tutorialDone || !tutorialOverlay) return;
    tutorialOverlay.style.display = 'block';
    let step = 1;
    const totalSteps = 3;
    const advanceTutorial = () => {
        document.getElementById('tutorial-step-' + step).style.display = 'none';
        step++;
        if (step <= totalSteps) {
            document.getElementById('tutorial-step-' + step).style.display = 'block';
        } else {
            tutorialOverlay.style.display = 'none';
            tutorialDone = true;
            try { localStorage.setItem(TUTORIAL_KEY, 'true'); } catch (e) { }
        }
    };
    // Advance tutorial on first tap/click
    const advancer = () => { advanceTutorial(); };
    tutorialOverlay.addEventListener('click', advancer);
    tutorialOverlay.addEventListener('touchstart', advancer);
}

// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const levelCompleteScreen = document.getElementById('level-complete-screen');
const levelIntroScreen = document.getElementById('level-intro-screen');
const pauseScreen = document.getElementById('pause-screen');
const scoreDisplay = document.getElementById('score-display');
const troopCountEl = document.getElementById('troop-count');
const coinCountEl = document.getElementById('coin-count');
const runCoinsEl = document.getElementById('run-coins');
const runCoinsGameOverEl = document.getElementById('run-coins-gameover');

const currentLevelEl = document.getElementById('current-level-display');
const startLevelEl = document.getElementById('start-level-display');
const startLevelEl2 = document.getElementById('start-level-display2');
const survivingTroopsEl = document.getElementById('surviving-troops');
const bonusCoinsEl = document.getElementById('bonus-coins');
const starRatingEl = document.getElementById('star-rating');
const defeatLevelEl = document.getElementById('defeat-level');
const nextBiomeNameEl = document.getElementById('next-biome-name');

const introBiomeBadge = document.getElementById('intro-biome-badge');
const introBiomeName = document.getElementById('intro-biome-name');
const introLevelNum = document.getElementById('intro-level-num');
const introDesc = document.getElementById('intro-desc');
const introCountdown = document.getElementById('intro-countdown');

const progressBarFill = document.getElementById('progress-bar-fill');
const progressLabel = document.getElementById('progress-label');

// --- Visual Effect Overlay Elements ---
const flashOverlay = document.getElementById('flash-overlay');
const vignetteOverlay = document.getElementById('vignette-overlay');
const speedLinesEl = document.getElementById('speed-lines');
const hudTroopsEl = document.getElementById('hud-troops');
const hudCoinsEl = document.getElementById('hud-coins');

const upgTroopsLvl = document.getElementById('upg-troops-lvl');
const upgTroopsCost = document.getElementById('upg-troops-cost');
const buyTroopsBtn = document.getElementById('buy-troops-btn');

const upgAttackLvl = document.getElementById('upg-attack-lvl');
const upgAttackCost = document.getElementById('upg-attack-cost');
const buyAttackBtn = document.getElementById('buy-attack-btn');

const upgMagnetLvl = document.getElementById('upg-magnet-lvl');
const upgMagnetCost = document.getElementById('upg-magnet-cost');
const buyMagnetBtn = document.getElementById('buy-magnet-btn');

// --- Procedural Audio Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const SoundEngine = {
    playTone(freq, type, duration, vol = 0.1) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    },
    punch() { this.playTone(150, 'square', 0.1, 0.05); },
    hit() { this.playTone(100, 'sawtooth', 0.1, 0.05); },
    bossHit() { this.playTone(50, 'sawtooth', 0.2, 0.1); },
    coin() { this.playTone(1200, 'sine', 0.3, 0.05); },
    gateGood() { this.playTone(600, 'sine', 0.4, 0.1); setTimeout(() => this.playTone(800, 'sine', 0.4, 0.1), 100); },
    gateBad() { this.playTone(150, 'sawtooth', 0.3, 0.1); },
    victory() { this.playTone(400, 'sine', 0.2, 0.1); setTimeout(() => this.playTone(500, 'sine', 0.2, 0.1), 200); setTimeout(() => this.playTone(600, 'sine', 0.4, 0.1), 400); }
};

// ─── Background Music Engine ─────────────────────────────────────────────────
let musicNodes = null;
let musicGain = null;
let currentMusicBiome = '';

function startMusic(biome) {
    if (isMuted || audioCtx.state === 'closed') return;
    if (biome === currentMusicBiome && musicNodes) return; // already playing this biome
    stopMusic();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    currentMusicBiome = biome;
    musicGain = audioCtx.createGain();
    musicGain.gain.setValueAtTime(0.15, audioCtx.currentTime); // master volume
    musicGain.connect(audioCtx.destination);

    const nodes = [];
    const now = audioCtx.currentTime;

    if (biome === 'utopia') {
        // Bright major chord arpeggio
        const freqs = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
        freqs.forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine'; osc.frequency.value = f;
            gain.gain.setValueAtTime(0, now + i * 0.8);
            gain.gain.linearRampToValueAtTime(0.12, now + i * 0.8 + 0.1);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.8 + 0.6);
            osc.connect(gain); gain.connect(musicGain);
            osc.start(now + i * 0.8); osc.stop(now + i * 0.8 + 0.6);
            nodes.push(osc, gain);
        });
        // Pad drone
        const pad = audioCtx.createOscillator();
        const padGain = audioCtx.createGain();
        pad.type = 'sawtooth'; pad.frequency.value = 130.81;
        padGain.gain.setValueAtTime(0.04, now);
        pad.connect(padGain); padGain.connect(musicGain);
        pad.start(now); nodes.push(pad, padGain);
    } else if (biome === 'wasteland') {
        // Dark minor drone
        const osc = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const g = audioCtx.createGain(); const g2 = audioCtx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = 60;
        osc2.type = 'square'; osc2.frequency.value = 90;
        g.gain.setValueAtTime(0.08, now); g2.gain.setValueAtTime(0.04, now);
        osc.connect(g); osc2.connect(g2); g.connect(musicGain); g2.connect(musicGain);
        osc.start(now); osc2.start(now); nodes.push(osc, osc2, g, g2);
    } else if (biome === 'neon') {
        // Upbeat synth arpeggio
        const bpm = 0.25;
        for (let i = 0; i < 16; i++) {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            const f = 220 + Math.sin(i * 1.5) * 110 + 110;
            osc.type = 'square'; osc.frequency.value = Math.max(50, f);
            g.gain.setValueAtTime(0, now + i * bpm);
            g.gain.linearRampToValueAtTime(0.06, now + i * bpm + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * bpm + bpm * 0.9);
            osc.connect(g); g.connect(musicGain);
            osc.start(now + i * bpm); osc.stop(now + i * bpm + bpm);
            nodes.push(osc, g);
        }
    } else if (biome === 'tundra') {
        // Wind-like noise pad
        for (let i = 0; i < 3; i++) {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'sine'; osc.frequency.value = 100 + i * 40;
            g.gain.setValueAtTime(0.03 + Math.random() * 0.02, now);
            g.gain.linearRampToValueAtTime(0.01, now + 4);
            osc.connect(g); g.connect(musicGain);
            osc.start(now); nodes.push(osc, g);
        }
    } else if (biome === 'lava') {
        // Aggressive low rumble
        for (let i = 0; i < 2; i++) {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'sawtooth'; osc.frequency.value = 40 + i * 15;
            g.gain.setValueAtTime(0.1, now);
            osc.connect(g); g.connect(musicGain);
            osc.start(now); nodes.push(osc, g);
        }
    }
    musicNodes = nodes;
}

function stopMusic() {
    if (musicNodes) {
        musicNodes.forEach(n => {
            try { n.stop(); } catch (e) { }
            try { n.disconnect(); } catch (e) { }
        });
        musicNodes = null;
    }
    if (musicGain) { try { musicGain.disconnect(); } catch (e) { } musicGain = null; }
    currentMusicBiome = '';
}

// ─── Haptic Feedback ────────────────────────────────────────────────────────
function hapticShort() { try { navigator.vibrate && navigator.vibrate(10); } catch (e) { } }
function hapticMedium() { try { navigator.vibrate && navigator.vibrate(25); } catch (e) { } }
function hapticLong() { try { navigator.vibrate && navigator.vibrate(50); } catch (e) { } }
function hapticDouble() { try { navigator.vibrate && navigator.vibrate([15, 30, 15]); } catch (e) { } }
function hapticBuzz() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { } }

// ─── Achievement System ─────────────────────────────────────────────────────
const ACHIEVEMENTS = {
    FIRST_BLOOD: { id: 'first_blood', name: 'First Blood', desc: 'Complete Level 1' },
    ARMY_BUILDER: { id: 'army_builder', name: 'Army Builder', desc: 'Reach 100 troops' },
    UNSTOPPABLE: { id: 'unstoppable', name: 'Unstoppable', desc: 'Complete Level 10' },
    RICH: { id: 'rich', name: 'Rich', desc: 'Collect 1000 coins total' },
    BOSS_HUNTER: { id: 'boss_hunter', name: 'Boss Hunter', desc: 'Kill 10 bosses' }
};
const ACHIEVEMENTS_KEY = 'crowdRunnerAchievements';
let unlockedAchievements = {};
let achievementStats = { totalCoinsCollected: 0, bossesKilled: 0 };

function loadAchievements() {
    try {
        const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            unlockedAchievements = data.unlocked || {};
            achievementStats = data.stats || { totalCoinsCollected: 0, bossesKilled: 0 };
        }
    } catch (e) { unlockedAchievements = {}; achievementStats = { totalCoinsCollected: 0, bossesKilled: 0 }; }
}
function saveAchievements() {
    try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify({ unlocked: unlockedAchievements, stats: achievementStats })); } catch (e) { }
}
function unlockAchievement(id) {
    if (!ACHIEVEMENTS[id] || unlockedAchievements[id]) return;
    unlockedAchievements[id] = true;
    saveAchievements();
    console.log('[CrowdRunner] Achievement unlocked:', ACHIEVEMENTS[id].name);
    spawnFloatingText(playerCenterX, 8, -10, '🏆 ' + ACHIEVEMENTS[id].name, '#ffd700', 4);
    SoundEngine.victory();
}
function checkAchievements() {
    if (!unlockedAchievements.first_blood && saveState.level >= 2) unlockAchievement('first_blood');
    if (!unlockedAchievements.army_builder && troops.length >= 100) unlockAchievement('army_builder');
    if (!unlockedAchievements.unstoppable && saveState.level >= 11) unlockAchievement('unstoppable');
    if (!unlockedAchievements.rich && achievementStats.totalCoinsCollected >= 1000) unlockAchievement('rich');
    if (!unlockedAchievements.boss_hunter && achievementStats.bossesKilled >= 10) unlockAchievement('boss_hunter');
}
function renderAchievements() {
    const list = document.getElementById('achievements-list');
    if (!list) return;
    list.innerHTML = '';
    Object.values(ACHIEVEMENTS).forEach(a => {
        const done = !!unlockedAchievements[a.id];
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.style.opacity = done ? '1' : '0.5';
        row.innerHTML = `
          <div class="shop-info">
            <span class="shop-name">${done ? '✅' : '🔒'} ${a.name}</span>
            <span class="shop-level">${a.desc}</span>
          </div>
        `;
        list.appendChild(row);
    });
}
function showAchievements() {
    renderAchievements();
    const panel = document.getElementById('achievements-panel');
    if (panel) panel.style.display = 'flex';
}
function showLeaderboard() { console.log('[CrowdRunner] Show leaderboard UI'); }

// ─── Player Skin System ─────────────────────────────────────────────────────
const SKINS_KEY = 'crowdRunnerSkins';
const DEFAULT_SKIN = 'cyan';
const AVAILABLE_SKINS = [
    { id: 'cyan', name: 'Cyan', color: 0x00e5ff, cost: 0, unlocked: true },
    { id: 'gold', name: 'Gold', color: 0xffd700, cost: 100, unlocked: false },
    { id: 'crimson', name: 'Crimson', color: 0xff3333, cost: 100, unlocked: false },
    { id: 'neon-green', name: 'Neon Green', color: 0x00ff66, cost: 150, unlocked: false },
    { id: 'purple', name: 'Purple', color: 0xaa00ff, cost: 150, unlocked: false },
    { id: 'plasma', name: 'Plasma', color: 0xff00ff, cost: 0, unlocked: false },
];
let unlockedSkins = ['cyan'];
let selectedSkin = DEFAULT_SKIN;

function loadSkins() {
    try {
        const raw = localStorage.getItem(SKINS_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            unlockedSkins = Array.isArray(data.unlocked) ? data.unlocked : ['cyan'];
            selectedSkin = data.selected || DEFAULT_SKIN;
            if (!unlockedSkins.includes(selectedSkin)) selectedSkin = DEFAULT_SKIN;
        }
    } catch (e) { unlockedSkins = ['cyan']; selectedSkin = DEFAULT_SKIN; }
}
function saveSkins() {
    try { localStorage.setItem(SKINS_KEY, JSON.stringify({ unlocked: unlockedSkins, selected: selectedSkin })); } catch (e) { }
}
function getSkinColor(skinId) {
    const skin = AVAILABLE_SKINS.find(s => s.id === skinId);
    return skin ? skin.color : 0x00e5ff;
}
function buySkin(skinId) {
    const skin = AVAILABLE_SKINS.find(s => s.id === skinId);
    if (!skin || unlockedSkins.includes(skinId)) return false;
    if (saveState.coins < skin.cost) return false;
    saveState.coins -= skin.cost;
    unlockedSkins.push(skinId);
    saveSkins(); saveGame();
    return true;
}
function selectSkin(skinId) {
    if (!unlockedSkins.includes(skinId)) return false;
    selectedSkin = skinId;
    saveSkins();
    return true;
}

// ─── IAP Shop Stubs ─────────────────────────────────────────────────────────
const IAP_PRODUCTS = [
    { id: 'coins_small', name: 'Coin Pack (500)', price: '$0.99', coins: 500 },
    { id: 'coins_medium', name: 'Coin Pack (2000)', price: '$2.99', coins: 2000 },
    { id: 'coins_large', name: 'Coin Pack (10000)', price: '$9.99', coins: 10000 },
    { id: 'remove_ads', name: 'Remove Ads', price: '$1.99', coins: 0 },
];
let iapPurchases = {};
function loadIAP() {
    try {
        const raw = localStorage.getItem('crowdRunnerIAP');
        if (raw) iapPurchases = JSON.parse(raw);
    } catch (e) { iapPurchases = {}; }
}
function saveIAP() {
    try { localStorage.setItem('crowdRunnerIAP', JSON.stringify(iapPurchases)); } catch (e) { }
}
function purchaseIAP(productId) {
    const product = IAP_PRODUCTS.find(p => p.id === productId);
    if (!product) return false;
    console.log('[CrowdRunner] IAP Purchase:', product.name, product.price);
    // Placeholder: integrate with Capacitor IAP plugin here
    // For testing, grant coins immediately
    if (product.coins > 0) {
        saveState.coins += product.coins;
        saveGame();
    }
    if (product.id === 'remove_ads') {
        iapPurchases.remove_ads = true;
        saveIAP();
    }
    return true;
}

// --- Game Tuning Constants (from game-logic.js) ---
const SCROLL_SPEED_BASE = 40;
const SCROLL_SPEED_FIGHT = 0.2;
const MAX_CROWD = 1000;
const TROOP_FIGHT_INTERVAL = 0.5;
const TROOP_DEATH_CHANCE = 0.2;
const LEVEL_BASE_LENGTH = 400;
const LEVEL_LENGTH_SCALE = 80;
const SEPARATION_NEIGHBORS = 60;
const SEPARATION_SKIP_RAND = 0.3;
const GATE_SPAWN_INTERVAL = 80;
const BONUS_COINS_RATIO = 0.5;

// --- Meta-Game State (save/load) ---
const SAVE_KEY = 'crowdRunnerSave2';
const DEFAULT_SAVE = {
    coins: 0,
    upgradeTroops: 1,
    upgradeAttack: 1,
    upgradeMagnet: 1,
    level: 1,
    questProgress: 0,
    questCompleted: false,
    unlockedSkies: ['default'],
    selectedSky: 'default',
    unlockedSpaceObjects: ['none'],
    selectedSpaceObject: 'none',
    decorTreesLvl: 0,
    decorPondsLvl: 0,
    decorAnimalsLvl: 0
};
let saveState = { ...DEFAULT_SAVE };

function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            saveState = { ...DEFAULT_SAVE, ...parsed };
            if (!validateSave(saveState)) {
                console.warn('[CrowdRunner] Corrupted save data — resetting to defaults.');
                saveState = { ...DEFAULT_SAVE };
            }
        }
    } catch (e) {
        console.warn('[CrowdRunner] Failed to parse save data:', e);
        saveState = { ...DEFAULT_SAVE };
    }
    loadAchievements();
    updateShopUI();
}
function saveGame() { localStorage.setItem(SAVE_KEY, JSON.stringify(saveState)); updateShopUI(); }

function updateShopUI() {
    coinCountEl.innerText = saveState.coins;

    let tCost = getUpgradeCost(saveState.upgradeTroops, 'troops');
    upgTroopsLvl.innerText = saveState.upgradeTroops; upgTroopsCost.innerText = tCost;
    buyTroopsBtn.disabled = saveState.coins < tCost;

    let aCost = getUpgradeCost(saveState.upgradeAttack, 'attack');
    if (upgAttackLvl) {
        upgAttackLvl.innerText = saveState.upgradeAttack;
        upgAttackCost.innerText = aCost;
        buyAttackBtn.disabled = saveState.coins < aCost;
    }

    let mCost = getUpgradeCost(saveState.upgradeMagnet, 'magnet');
    if (upgMagnetLvl) {
        upgMagnetLvl.innerText = saveState.upgradeMagnet;
        upgMagnetCost.innerText = mCost;
        buyMagnetBtn.disabled = saveState.coins < mCost;
    }

    startLevelEl.innerText = saveState.level;
    if (startLevelEl2) startLevelEl2.innerText = saveState.level;
    currentLevelEl.innerText = saveState.level;

    // --- Quest Progress UI ---
    const qBar = document.getElementById('quest-progress-bar');
    const qText = document.getElementById('quest-progress-text');
    const qBadge = document.getElementById('quest-status-badge');
    if (qBar && qText && qBadge) {
        const progress = saveState.questProgress || 0;
        qBar.style.width = Math.min(100, (progress / 15) * 100) + '%';
        qText.textContent = `${progress}/15`;
        if (saveState.questCompleted) {
            qBadge.style.display = 'block';
        } else {
            qBadge.style.display = 'none';
        }
    }

    // --- Sky Shop UI ---
    const skyNebulaBtn = document.getElementById('buy-sky-nebula-btn');
    if (skyNebulaBtn) {
        const isUnlocked = saveState.unlockedSkies.includes('nebula');
        if (!isUnlocked) {
            skyNebulaBtn.innerText = "🪙 250";
            skyNebulaBtn.className = "btn-shop";
            skyNebulaBtn.disabled = saveState.coins < 250;
        } else {
            skyNebulaBtn.disabled = false;
            if (saveState.selectedSky === 'nebula') {
                skyNebulaBtn.innerText = "Equipped";
                skyNebulaBtn.className = "btn-shop selected";
            } else {
                skyNebulaBtn.innerText = "Equip";
                skyNebulaBtn.className = "btn-shop equip";
            }
        }
    }

    const skySupernovaBtn = document.getElementById('buy-sky-supernova-btn');
    if (skySupernovaBtn) {
        const isUnlocked = saveState.unlockedSkies.includes('supernova');
        if (!isUnlocked) {
            skySupernovaBtn.innerText = "🪙 400";
            skySupernovaBtn.className = "btn-shop";
            skySupernovaBtn.disabled = saveState.coins < 400;
        } else {
            skySupernovaBtn.disabled = false;
            if (saveState.selectedSky === 'supernova') {
                skySupernovaBtn.innerText = "Equipped";
                skySupernovaBtn.className = "btn-shop selected";
            } else {
                skySupernovaBtn.innerText = "Equip";
                skySupernovaBtn.className = "btn-shop equip";
            }
        }
    }

    // --- Space Objects Shop UI ---
    const spacePlanetBtn = document.getElementById('buy-space-planet-btn');
    if (spacePlanetBtn) {
        const isUnlocked = saveState.unlockedSpaceObjects.includes('planet');
        if (!isUnlocked) {
            spacePlanetBtn.innerText = "$0.99";
            spacePlanetBtn.className = "btn-shop";
            spacePlanetBtn.disabled = false;
        } else {
            if (saveState.selectedSpaceObject === 'planet') {
                spacePlanetBtn.innerText = "Equipped";
                spacePlanetBtn.className = "btn-shop selected";
            } else {
                spacePlanetBtn.innerText = "Equip";
                spacePlanetBtn.className = "btn-shop equip";
            }
        }
    }

    const spaceStationBtn = document.getElementById('buy-space-station-btn');
    if (spaceStationBtn) {
        const isUnlocked = saveState.unlockedSpaceObjects.includes('station');
        if (!isUnlocked) {
            spaceStationBtn.innerText = "$1.99";
            spaceStationBtn.className = "btn-shop";
            spaceStationBtn.disabled = false;
        } else {
            if (saveState.selectedSpaceObject === 'station') {
                spaceStationBtn.innerText = "Equipped";
                spaceStationBtn.className = "btn-shop selected";
            } else {
                spaceStationBtn.innerText = "Equip";
                spaceStationBtn.className = "btn-shop equip";
            }
        }
    }

    // --- Decor Upgrades Shop UI ---
    const decorTreesLvl = document.getElementById('decor-trees-lvl');
    const buyDecorTreesBtn = document.getElementById('buy-decor-trees-btn');
    if (decorTreesLvl && buyDecorTreesBtn) {
        const lvl = saveState.decorTreesLvl || 0;
        decorTreesLvl.textContent = lvl;
        if (lvl >= 5) {
            buyDecorTreesBtn.innerText = "Max";
            buyDecorTreesBtn.disabled = true;
        } else {
            const cost = getUpgradeCost(lvl, 'decor_trees');
            buyDecorTreesBtn.innerText = `🪙 ${cost}`;
            buyDecorTreesBtn.disabled = saveState.coins < cost;
        }
    }

    const decorPondsLvl = document.getElementById('decor-ponds-lvl');
    const buyDecorPondsBtn = document.getElementById('buy-decor-ponds-btn');
    if (decorPondsLvl && buyDecorPondsBtn) {
        const lvl = saveState.decorPondsLvl || 0;
        decorPondsLvl.textContent = lvl;
        if (lvl >= 5) {
            buyDecorPondsBtn.innerText = "Max";
            buyDecorPondsBtn.disabled = true;
        } else {
            const cost = getUpgradeCost(lvl, 'decor_ponds');
            buyDecorPondsBtn.innerText = `🪙 ${cost}`;
            buyDecorPondsBtn.disabled = saveState.coins < cost;
        }
    }

    const decorAnimalsLvl = document.getElementById('decor-animals-lvl');
    const buyDecorAnimalsBtn = document.getElementById('buy-decor-animals-btn');
    if (decorAnimalsLvl && buyDecorAnimalsBtn) {
        const lvl = saveState.decorAnimalsLvl || 0;
        decorAnimalsLvl.textContent = lvl;
        if (lvl >= 5) {
            buyDecorAnimalsBtn.innerText = "Max";
            buyDecorAnimalsBtn.disabled = true;
        } else {
            const cost = getUpgradeCost(lvl, 'decor_animals');
            buyDecorAnimalsBtn.innerText = `🪙 ${cost}`;
            buyDecorAnimalsBtn.disabled = saveState.coins < cost;
        }
    }
}
// (buyTroopsBtn listener is registered at bottom of file to avoid duplicate)

// --- Three.js Setup & Post-Processing ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xdceefc, 0.002); // Initialize fog — required before applyBiomeSettings()
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1200);
let baseCameraPos = new THREE.Vector3(0, 9, 30);
camera.position.copy(baseCameraPos); camera.lookAt(0, 3, -80);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// UnrealBloomPass tuned to prevent blowouts
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.4, 0.85);
bloomPass.threshold = 0.85; // High threshold so only emissive light glows
bloomPass.strength = 0.8;
bloomPass.radius = 0.5;
composer.addPass(bloomPass);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
});

// --- Procedural Textures Helper ---
function createSkyTexture(color1, color2) {
    const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, color1); grad.addColorStop(1, color2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 2, 512);
    return new THREE.CanvasTexture(canvas);
}

function createBuildingTexture(type) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (type === 'utopia') {
        ctx.fillStyle = '#1e2230'; ctx.fillRect(0, 0, 128, 256);
        ctx.fillStyle = '#ffdf6d'; // yellow windows
        for (let y = 16; y < 240; y += 20) {
            for (let x = 12; x < 116; x += 16) {
                if (Math.random() > 0.4) ctx.fillRect(x, y, 6, 10);
            }
        }
    } else if (type === 'wasteland') {
        ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, 128, 256);
        ctx.fillStyle = '#ff3300'; // burning red windows
        for (let y = 16; y < 240; y += 20) {
            for (let x = 12; x < 116; x += 16) {
                if (Math.random() > 0.8) ctx.fillRect(x, y, 6, 10);
            }
        }
    } else if (type === 'neon') {
        ctx.fillStyle = '#0a0a16'; ctx.fillRect(0, 0, 128, 256);
        // Cyberpunk neon stripes and window blocks
        for (let y = 16; y < 240; y += 20) {
            for (let x = 12; x < 116; x += 16) {
                if (Math.random() > 0.3) {
                    ctx.fillStyle = Math.random() > 0.5 ? '#00f0ff' : '#ff007f'; // Cyan or Magenta
                    ctx.fillRect(x, y, 6, 10);
                }
            }
        }
        // Add vertical neon trim lines
        ctx.fillStyle = '#ff007f';
        ctx.fillRect(2, 0, 3, 256);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(123, 0, 3, 256);
    } else if (type === 'tundra') {
        // Frosty brick look
        ctx.fillStyle = '#2d3b4d'; ctx.fillRect(0, 0, 128, 256);
        ctx.fillStyle = '#ffffff'; // Snow layers on window frames
        for (let y = 20; y < 240; y += 30) {
            ctx.fillRect(8, y, 112, 3);
            for (let x = 16; x < 116; x += 24) {
                ctx.fillStyle = '#aaddff'; // Icy windows
                ctx.fillRect(x, y - 12, 10, 12);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x - 2, y - 14, 14, 2); // snow ledge
            }
        }
    } else if (type === 'lava') {
        // Obsidian crackle lava texture
        ctx.fillStyle = '#1c1512'; ctx.fillRect(0, 0, 128, 256);
        ctx.fillStyle = '#ff4500'; // Molten orange lines
        for (let i = 0; i < 40; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * 128, Math.random() * 256);
            ctx.lineTo(Math.random() * 128, Math.random() * 256);
            ctx.strokeStyle = Math.random() > 0.4 ? '#ff4500' : '#ffaa00';
            ctx.lineWidth = Math.random() * 3 + 1;
            ctx.stroke();
        }
    }
    return new THREE.CanvasTexture(canvas);
}

function createRoadTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, 128, 512);
    ctx.fillStyle = '#666666'; ctx.fillRect(4, 0, 3, 512); ctx.fillRect(121, 0, 3, 512); // curbs
    ctx.fillStyle = '#ffd700'; // dashed yellow line
    for (let y = 0; y < 512; y += 64) { ctx.fillRect(62, y + 16, 4, 32); }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 10);
    return tex;
}

function createFlareTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,200,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

// --- Lighting & Atmosphere ---
let currentBiome = 'utopia';
let timeOfDay = 'day';

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
hemiLight.position.set(0, 50, 0); scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(40, 80, -100); dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 300;
dirLight.shadow.camera.left = -80; dirLight.shadow.camera.right = 80;
dirLight.shadow.camera.top = 80; dirLight.shadow.camera.bottom = -80;
dirLight.shadow.bias = -0.0005; scene.add(dirLight);

// Sky Dome
const skyGeo = new THREE.SphereGeometry(600, 32, 15);
const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
const skyDome = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyDome);

// Sun/Moon celestial body — raised higher so it clears the sky-dome horizon (V-1 fix)
const celestialGeo = new THREE.SphereGeometry(30, 32, 32); // Larger for visibility
const celestialMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const celestialBody = new THREE.Mesh(celestialGeo, celestialMat);
celestialBody.position.set(0, 160, -500); // Higher y (was 100) so sun clears the horizon
scene.add(celestialBody);

// Sun Halo / Glow
const flareSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: createFlareTexture(), transparent: true }));
flareSprite.scale.set(120, 120, 1);
celestialBody.add(flareSprite);

// Stars
const starsGeo = new THREE.BufferGeometry();
const starsCount = 2000;
const starsPos = new Float32Array(starsCount * 3);
for (let i = 0; i < starsCount * 3; i += 3) {
    starsPos[i] = (Math.random() - 0.5) * 800;
    starsPos[i + 1] = Math.random() * 300 + 50;
    starsPos[i + 2] = (Math.random() - 0.5) * 800;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));

// Stars with per-star color variation for a more realistic sky
const starColors = new Float32Array(starsCount * 3);
const starPalette = [
    [1.0, 1.0, 1.0],   // white
    [0.8, 0.9, 1.0],   // blue-white
    [1.0, 0.95, 0.8],  // warm yellow
    [1.0, 0.7, 0.6],   // orange-red
    [0.7, 0.8, 1.0],   // blue
];
for (let i = 0; i < starsCount; i++) {
    const c = starPalette[Math.floor(Math.random() * starPalette.length)];
    const bright = 0.6 + Math.random() * 0.4;
    starColors[i * 3] = c[0] * bright;
    starColors[i * 3 + 1] = c[1] * bright;
    starColors[i * 3 + 2] = c[2] * bright;
}
starsGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
const starsMat = new THREE.PointsMaterial({
    vertexColors: true, size: 2.2, transparent: true, opacity: 1.0,
    sizeAttenuation: false, blending: THREE.AdditiveBlending
});
const starsMesh = new THREE.Points(starsGeo, starsMat);
scene.add(starsMesh);

// Moon Glow Sprite — illuminates night sky at horizon
function createMoonGlowTexture(col) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, col + 'ff');
    g.addColorStop(0.25, col + '99');
    g.addColorStop(0.6, col + '33');
    g.addColorStop(1.0, col + '00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
}
const moonGlowTex = createMoonGlowTexture('#aaccff');
const moonGlowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonGlowTex, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false
}));
moonGlowSprite.scale.set(320, 320, 1);
moonGlowSprite.visible = false;
scene.add(moonGlowSprite);

// Satellites
const satsGeo = new THREE.SphereGeometry(3.0, 8, 8); // Enlarged from 0.8 so satellites are visible against dark sky (V-4 fix)
const satsMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const satsMesh = new THREE.InstancedMesh(satsGeo, satsMat, 5);
scene.add(satsMesh);
let satellites = [];

// Base Terrain
const roadTex = createRoadTexture();
const roadGeo = new THREE.PlaneGeometry(40, 1000);
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.8, metalness: 0.2, emissive: new THREE.Color(0x000000), emissiveIntensity: 0.0 });
const road = new THREE.Mesh(roadGeo, roadMat); road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);

const grassGeo = new THREE.PlaneGeometry(800, 1000);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x2d8a3b, roughness: 1.0, metalness: 0.0 });
const grassL = new THREE.Mesh(grassGeo, grassMat); grassL.rotation.x = -Math.PI / 2; grassL.position.x = -420; grassL.position.y = -0.1; grassL.receiveShadow = true; scene.add(grassL);
const grassR = new THREE.Mesh(grassGeo, grassMat); grassR.rotation.x = -Math.PI / 2; grassR.position.x = 420; grassR.position.y = -0.1; grassR.receiveShadow = true; scene.add(grassR);

// --- Biome Materials Cache ---
const bldgTexUtopia = createBuildingTexture('utopia');
const bldgTexWasteland = createBuildingTexture('wasteland');
const bldgTexNeon = createBuildingTexture('neon');
const bldgTexTundra = createBuildingTexture('tundra');
const bldgTexLava = createBuildingTexture('lava');

const bldgMatUtopia = new THREE.MeshStandardMaterial({ map: bldgTexUtopia, emissiveMap: bldgTexUtopia, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.8 });
const bldgMatWasteland = new THREE.MeshStandardMaterial({ map: bldgTexWasteland, emissiveMap: bldgTexWasteland, emissive: 0xff2200, emissiveIntensity: 0.85, roughness: 0.8, metalness: 0.1 });
const bldgMatNeon = new THREE.MeshStandardMaterial({ map: bldgTexNeon, emissiveMap: bldgTexNeon, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.9 });
const bldgMatTundra = new THREE.MeshStandardMaterial({ map: bldgTexTundra, emissive: 0xaaddff, emissiveIntensity: 0.0, roughness: 0.7, metalness: 0.1 });
const bldgMatLava = new THREE.MeshStandardMaterial({ map: bldgTexLava, emissiveMap: bldgTexLava, emissive: 0xff3300, emissiveIntensity: 1.0, roughness: 0.9, metalness: 0.0 });

// --- Environment Pools ---
const MAX_BUILDINGS = 300;
const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
const bldgMesh = new THREE.InstancedMesh(bldgGeo, bldgMatUtopia, MAX_BUILDINGS);
bldgMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
bldgMesh.castShadow = true; bldgMesh.receiveShadow = true;
scene.add(bldgMesh);
let buildings = [];

const MAX_LAKES = 20;
const lakeGeo = new THREE.PlaneGeometry(1, 1);
const lakeMat = new THREE.MeshStandardMaterial({ color: 0x0088ff, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.8 });
const lakesMesh = new THREE.InstancedMesh(lakeGeo, lakeMat, MAX_LAKES);
lakesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(lakesMesh);
let lakes = [];

const MAX_MOUNTAINS = 40;
const mountGeo = new THREE.ConeGeometry(1, 1, 4); // Low-poly pyramid mountains
const mountMat = new THREE.MeshStandardMaterial({ roughness: 1.0 });
const mountMesh = new THREE.InstancedMesh(mountGeo, mountMat, MAX_MOUNTAINS);
mountMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(mountMesh);
let mountains = [];

const MAX_TREES = 150;
const treeConeGeo = new THREE.ConeGeometry(3, 8, 5);
const treeTrunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 3, 5);
const treeConeMat = new THREE.MeshStandardMaterial({ color: 0x1e5c27, roughness: 0.9, emissive: new THREE.Color(0x000000), emissiveIntensity: 0.0 });
const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4d2f1d, roughness: 0.9 });

const treeConeMesh = new THREE.InstancedMesh(treeConeGeo, treeConeMat, MAX_TREES);
const treeTrunkMesh = new THREE.InstancedMesh(treeTrunkGeo, treeTrunkMat, MAX_TREES);
treeConeMesh.castShadow = true; treeTrunkMesh.castShadow = true;
scene.add(treeConeMesh); scene.add(treeTrunkMesh);
let trees = [];

// Cosmic Animals setup
const MAX_ANIMALS = 100;
const animalGeo = new THREE.BoxGeometry(0.8, 0.8, 1.2);
const animalMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.8, metalness: 0.1 });
const animalMesh = new THREE.InstancedMesh(animalGeo, animalMat, MAX_ANIMALS);
animalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(animalMesh);
let animals = [];

// Street Lights (Night Only)
const MAX_STREETLIGHTS = 20;
const lightPoleGeo = new THREE.CylinderGeometry(0.15, 0.15, 8, 8);
const lightPoleMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
const lightPoleMesh = new THREE.InstancedMesh(lightPoleGeo, lightPoleMat, MAX_STREETLIGHTS);

const bulbGeo = new THREE.SphereGeometry(0.4, 8, 8);
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffdf6d });
const bulbMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, MAX_STREETLIGHTS);

const beamGeo = new THREE.ConeGeometry(1.2, 6, 12, 1, true); // Reduced radius+height so cones don't fill camera when close
const beamMat = new THREE.MeshBasicMaterial({ color: 0xffdf6d, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, MAX_STREETLIGHTS);

scene.add(lightPoleMesh); scene.add(bulbMesh); scene.add(beamMesh);
let streetLights = [];

// ─── Dynamic Night Lighting System ───────────────────────────────────────────────────────

// Crowd Follow Light — tracks the player crowd from above, illuminates troops
const crowdFollowLight = new THREE.PointLight(0x88ccff, 0, 40, 1.5);
crowdFollowLight.position.set(0, 12, 0);
scene.add(crowdFollowLight);

// Road Rim Lights — two colored point lights bracketing the road
const roadRimLightL = new THREE.PointLight(0x004488, 0, 60, 1.8);
roadRimLightL.position.set(-18, 2, -5);
scene.add(roadRimLightL);
const roadRimLightR = new THREE.PointLight(0x004488, 0, 60, 1.8);
roadRimLightR.position.set(18, 2, -5);
scene.add(roadRimLightR);

// Enemy Area Back Light — illuminates the arena ahead in red during fights
const arenaLight = new THREE.PointLight(0xff1100, 0, 80, 1.4);
arenaLight.position.set(0, 15, -30);
scene.add(arenaLight);

// Horizon depth light — distant glow at vanishing point
const horizonLight = new THREE.PointLight(0x223366, 0, 250, 1.2);
horizonLight.position.set(0, 8, -180);
scene.add(horizonLight);

function updateNightLights(biome, timeOfDayCur, playerX, hasEnemy) {
    if (timeOfDayCur !== 'night') {
        crowdFollowLight.intensity = 0;
        roadRimLightL.intensity = 0;
        roadRimLightR.intensity = 0;
        arenaLight.intensity = 0;
        horizonLight.intensity = 0;
        moonGlowSprite.visible = false;
        return;
    }

    // Crowd-following key light
    crowdFollowLight.position.x = playerX;
    if (biome === 'wasteland') {
        crowdFollowLight.color.setHex(0xff8866); crowdFollowLight.intensity = 6.0; crowdFollowLight.distance = 50;
        roadRimLightL.color.setHex(0xff2200); roadRimLightL.intensity = 4.5;
        roadRimLightR.color.setHex(0xff2200); roadRimLightR.intensity = 4.5;
        horizonLight.color.setHex(0x441100); horizonLight.intensity = 3.0;
        moonGlowSprite.material.map = createMoonGlowTexture('#ff2200'); moonGlowSprite.material.needsUpdate = true;
    } else if (biome === 'neon') {
        crowdFollowLight.color.setHex(0x00ffff); crowdFollowLight.intensity = 7.0; crowdFollowLight.distance = 55;
        roadRimLightL.color.setHex(0xff00ff); roadRimLightL.intensity = 5.5;
        roadRimLightR.color.setHex(0x00ffff); roadRimLightR.intensity = 5.5;
        horizonLight.color.setHex(0x330044); horizonLight.intensity = 4.0;
        moonGlowSprite.material.map = createMoonGlowTexture('#8800ff'); moonGlowSprite.material.needsUpdate = true;
    } else if (biome === 'lava') {
        crowdFollowLight.color.setHex(0xff4400); crowdFollowLight.intensity = 8.0; crowdFollowLight.distance = 60;
        roadRimLightL.color.setHex(0xff3300); roadRimLightL.intensity = 6.0;
        roadRimLightR.color.setHex(0xff6600); roadRimLightR.intensity = 6.0;
        horizonLight.color.setHex(0x440800); horizonLight.intensity = 5.0;
        moonGlowSprite.material.map = createMoonGlowTexture('#ff2200'); moonGlowSprite.material.needsUpdate = true;
    } else { // utopia night / tundra night
        crowdFollowLight.color.setHex(0x88aaff); crowdFollowLight.intensity = 5.5; crowdFollowLight.distance = 45;
        roadRimLightL.color.setHex(0x002266); roadRimLightL.intensity = 4.0;
        roadRimLightR.color.setHex(0x002266); roadRimLightR.intensity = 4.0;
        horizonLight.color.setHex(0x111133); horizonLight.intensity = 2.5;
        moonGlowSprite.material.map = createMoonGlowTexture('#aaccff'); moonGlowSprite.material.needsUpdate = true;
    }
    roadRimLightL.position.x = playerX - 18;
    roadRimLightR.position.x = playerX + 18;

    // Arena fight light
    arenaLight.intensity = hasEnemy ? 5.0 : 0;
    arenaLight.color.setHex(biome === 'lava' ? 0xff4400 : 0xff1100);

    // Moon glow tracks celestial body
    moonGlowSprite.position.copy(celestialBody.position);
    moonGlowSprite.visible = true;
}


// --- Street Light Physical Light Pool (Real Light Simulation) ---
const MAX_PHYSICAL_LIGHTS = 6;
const streetLightPool = [];
for (let i = 0; i < MAX_PHYSICAL_LIGHTS; i++) {
    // SpotLight(color, intensity, distance, angle, penumbra, decay)
    const spot = new THREE.SpotLight(0xffdf6d, 0, 40, Math.PI / 4, 0.8, 1.2);
    spot.castShadow = true;
    spot.shadow.mapSize.width = 512;
    spot.shadow.mapSize.height = 512;
    spot.shadow.camera.near = 0.5;
    spot.shadow.camera.far = 40;
    spot.shadow.bias = -0.002;
    scene.add(spot);

    const target = new THREE.Object3D();
    scene.add(target);
    spot.target = target;

    streetLightPool.push({ light: spot, target: target });
}

function applyBiomeSettings() {
    // Dynamic settings based on level — FIX: was hardcoded to 5, now uses all biomes
    const biomeCycle = ['utopia', 'wasteland', 'neon', 'tundra', 'lava', 'dune', 'crystal', 'void'];
    const timeCycle = ['day', 'night', 'night', 'day', 'night', 'day', 'night', 'night'];
    const index = (saveState.level - 1) % biomeCycle.length;

    currentBiome = biomeCycle[index];
    timeOfDay = timeCycle[index];

    if (timeOfDay === 'day') {
        if (currentBiome === 'utopia') {
            const skyTex = createSkyTexture('#a1d8f6', '#dceefc');
            skyMat.map = skyTex; skyMat.needsUpdate = true;
            scene.fog.color.setHex(0xdceefc); scene.fog.density = 0.002;
            hemiLight.color.setHex(0xffffff); hemiLight.groundColor.setHex(0x444444); hemiLight.intensity = 1.0;
            dirLight.color.setHex(0xffffff); dirLight.intensity = 1.5;
        } else if (currentBiome === 'tundra') {
            // Arctic day: pale white-blue snowy sky
            const skyTex = createSkyTexture('#bce0f5', '#eef8ff');
            skyMat.map = skyTex; skyMat.needsUpdate = true;
            scene.fog.color.setHex(0xeef8ff); scene.fog.density = 0.0035; // slightly thicker blizzard fog
            hemiLight.color.setHex(0xddecff); hemiLight.groundColor.setHex(0x9fc3d9); hemiLight.intensity = 1.1;
            dirLight.color.setHex(0xffffff); dirLight.intensity = 1.3;
        }

        celestialMat.color.setHex(0xffffee); flareSprite.visible = true;
        starsMesh.visible = false; satsMesh.visible = false;
        moonGlowSprite.visible = false;
        // Reset night-only emissives for day
        roadMat.emissive.setHex(0x000000); roadMat.emissiveIntensity = 0.0;
        treeConeMat.emissive.setHex(0x000000); treeConeMat.emissiveIntensity = 0.0;

        // Hide streetlights in day
        streetLights = [];
        if (typeof streetLightPool !== 'undefined') {
            streetLightPool.forEach(p => { p.light.intensity = 0; p.light.visible = false; });
        }
    } else {
        // Night
        if (currentBiome === 'wasteland') {
            // Wasteland: Burning ember sky with crimson moon
            const skyTex = createSkyTexture('#250808', '#0a0101');
            skyMat.map = skyTex; skyMat.needsUpdate = true;
            scene.fog.color.setHex(0x140302); scene.fog.density = 0.006;
            hemiLight.color.setHex(0x993322); hemiLight.groundColor.setHex(0x331108); hemiLight.intensity = 1.1;
            dirLight.color.setHex(0xff6644); dirLight.intensity = 1.4;
            celestialBody.position.set(-80, 120, -450);
            celestialMat.color.setHex(0xff4400);
            treeConeMat.emissive = new THREE.Color(0x220800); treeConeMat.emissiveIntensity = 0.4;
            roadMat.emissive = new THREE.Color(0x330600); roadMat.emissiveIntensity = 0.15;
        } else if (currentBiome === 'neon') {
            // Neon City: Deep purple/magenta city sky with cyan moon
            const skyTex = createSkyTexture('#0e0326', '#02000e');
            skyMat.map = skyTex; skyMat.needsUpdate = true;
            scene.fog.color.setHex(0x080114); scene.fog.density = 0.005;
            hemiLight.color.setHex(0xcc44ee); hemiLight.groundColor.setHex(0x0f0520); hemiLight.intensity = 1.3;
            dirLight.color.setHex(0x00ffff); dirLight.intensity = 1.5;
            celestialBody.position.set(60, 140, -480);
            celestialMat.color.setHex(0x44ffff);
            treeConeMat.emissive = new THREE.Color(0x00ff88); treeConeMat.emissiveIntensity = 0.6;
            roadMat.emissive = new THREE.Color(0x0a003a); roadMat.emissiveIntensity = 0.2;
        } else if (currentBiome === 'lava') {
            // Volcanic: Ash and fire sky, ember moon
            const skyTex = createSkyTexture('#200800', '#030000');
            skyMat.map = skyTex; skyMat.needsUpdate = true;
            scene.fog.color.setHex(0x130300); scene.fog.density = 0.006;
            hemiLight.color.setHex(0xff5500); hemiLight.groundColor.setHex(0x220c03); hemiLight.intensity = 1.5;
            dirLight.color.setHex(0xff6600); dirLight.intensity = 1.8;
            celestialBody.position.set(20, 100, -400);
            celestialMat.color.setHex(0xff3300);
            treeConeMat.emissive = new THREE.Color(0x441000); treeConeMat.emissiveIntensity = 0.5;
            roadMat.emissive = new THREE.Color(0x440800); roadMat.emissiveIntensity = 0.25;
        } else { // utopia night or default
            const skyTex = createSkyTexture('#0d0a30', '#020210');
            skyMat.map = skyTex; skyMat.needsUpdate = true;
            scene.fog.color.setHex(0x060520); scene.fog.density = 0.004;
            hemiLight.color.setHex(0x4466bb); hemiLight.groundColor.setHex(0x111128); hemiLight.intensity = 0.9;
            dirLight.color.setHex(0x8899ff); dirLight.intensity = 1.2;
            celestialBody.position.set(0, 160, -500);
            celestialMat.color.setHex(0xcceeff);
            treeConeMat.emissive = new THREE.Color(0x002244); treeConeMat.emissiveIntensity = 0.15;
            roadMat.emissive = new THREE.Color(0x000820); roadMat.emissiveIntensity = 0.1;
        }

        celestialMat.needsUpdate = true;
        roadMat.needsUpdate = true;
        treeConeMat.needsUpdate = true;

        celestialMat.color.setHex(0xaaccff); flareSprite.visible = false;
        starsMesh.visible = true; satsMesh.visible = true;
    }

    // --- Custom Sky Overrides ---
    if (saveState.selectedSky === 'nebula') {
        const skyTex = createSkyTexture('#0e0524', '#260c4a');
        skyMat.map = skyTex; skyMat.needsUpdate = true;
        scene.fog.color.setHex(0x0e0524); scene.fog.density = 0.0035;
        hemiLight.color.setHex(0xa385ff); hemiLight.groundColor.setHex(0x190d3d); hemiLight.intensity = 1.2;
        dirLight.color.setHex(0xff00ff); dirLight.intensity = 1.4;
        starsMesh.visible = true;
    } else if (saveState.selectedSky === 'supernova') {
        const skyTex = createSkyTexture('#300202', '#6a1505');
        skyMat.map = skyTex; skyMat.needsUpdate = true;
        scene.fog.color.setHex(0x300202); scene.fog.density = 0.004;
        hemiLight.color.setHex(0xff7744); hemiLight.groundColor.setHex(0x3d0b00); hemiLight.intensity = 1.3;
        dirLight.color.setHex(0xffaa00); dirLight.intensity = 1.6;
        starsMesh.visible = true;
    }

    if (currentBiome === 'utopia') {
        grassMat.color.setHex(0x247833);
        bldgMesh.material = bldgMatUtopia;
        lakeMat.color.setHex(0x0088ff); lakeMat.emissive.setHex(0x000000); lakeMat.roughness = 0.1; lakeMat.metalness = 0.9;
        mountMat.color.setHex(0x1b3c20);
        treeConeMat.color.setHex(0x1e5c27);
    } else if (currentBiome === 'wasteland') {
        grassMat.color.setHex(0x201b16); // Burnt ground
        bldgMesh.material = bldgMatWasteland;
        lakeMat.color.setHex(0x00ff33); lakeMat.emissive.setHex(0x00ff33); lakeMat.emissiveIntensity = 0.6; lakeMat.roughness = 0.9; lakeMat.metalness = 0.0;
        mountMat.color.setHex(0x2f2824);
        treeConeMat.color.setHex(0x382d24);
    } else if (currentBiome === 'neon') {
        grassMat.color.setHex(0x0d0d1b); // Dark metallic road surround
        bldgMesh.material = bldgMatNeon;
        lakeMat.color.setHex(0xff00aa); lakeMat.emissive.setHex(0xff00aa); lakeMat.emissiveIntensity = 0.9; lakeMat.roughness = 0.1; lakeMat.metalness = 0.9; // Glowing neon pink lakes
        mountMat.color.setHex(0x0f0724);
        treeConeMat.color.setHex(0x00ffaa); // Glowing cyan pines!
    } else if (currentBiome === 'tundra') {
        grassMat.color.setHex(0xeef8ff); // Pure snow ground
        bldgMesh.material = bldgMatTundra;
        lakeMat.color.setHex(0x88ccff); lakeMat.emissive.setHex(0x4488cc); lakeMat.emissiveIntensity = 0.2; lakeMat.roughness = 0.8; lakeMat.metalness = 0.2; // Frozen blue ice lakes
        mountMat.color.setHex(0x4e637a); // Snowy grey cone mountains
        treeConeMat.color.setHex(0xddf0ff); // Frosty white pines
    } else if (currentBiome === 'lava') {
        grassMat.color.setHex(0x110c0a); // Burnt ash ground
        bldgMesh.material = bldgMatLava;
        lakeMat.color.setHex(0xff3300); lakeMat.emissive.setHex(0xff2200); lakeMat.emissiveIntensity = 1.3; lakeMat.roughness = 0.9; lakeMat.metalness = 0.0; // Boiling lava
        mountMat.color.setHex(0x221511);
        treeConeMat.color.setHex(0x401509); // Charcoal trees
    } else if (currentBiome === 'dune') {
        grassMat.color.setHex(0xc2a261); // Sandy dunes
        bldgMesh.material = bldgMatUtopia;
        lakeMat.color.setHex(0xffcc00); lakeMat.emissive.setHex(0x000000); lakeMat.roughness = 1.0; lakeMat.metalness = 0.0;
        mountMat.color.setHex(0xd9a96b);
        treeConeMat.color.setHex(0x8c7b50);
        roadMat.emissive = new THREE.Color(0x221100); roadMat.emissiveIntensity = 0.1;
    } else if (currentBiome === 'crystal') {
        grassMat.color.setHex(0x1a0a2e); // Deep purple ground
        bldgMesh.material = bldgMatNeon;
        lakeMat.color.setHex(0xaa00ff); lakeMat.emissive.setHex(0xaa00ff); lakeMat.emissiveIntensity = 0.8; lakeMat.roughness = 0.1; lakeMat.metalness = 0.95;
        mountMat.color.setHex(0x2a1040);
        treeConeMat.color.setHex(0xff55ff);
        roadMat.emissive = new THREE.Color(0x110022); roadMat.emissiveIntensity = 0.15;
    } else if (currentBiome === 'void') {
        grassMat.color.setHex(0x050208); // Near-black void ground
        bldgMesh.material = bldgMatLava;
        lakeMat.color.setHex(0x6600ff); lakeMat.emissive.setHex(0x4400aa); lakeMat.emissiveIntensity = 1.1; lakeMat.roughness = 0.0; lakeMat.metalness = 1.0;
        mountMat.color.setHex(0x0a0512);
        treeConeMat.color.setHex(0x220033);
        roadMat.emissive = new THREE.Color(0x000000); roadMat.emissiveIntensity = 0.2;
    }
}

function updateEnvironmentMeshes(dt, effectiveScrollSpeed) {
    const dummy = new THREE.Object3D();

    // Scroll road texture — += scrolls toward camera (objects move +z toward player)
    // Multiplier 0.01 matches actual world speed: 1 texture repeat = 100 world units
    if (roadMat.map) {
        roadMat.map.offset.y += effectiveScrollSpeed * 0.01 * dt;
    }

    // Satellites
    if (timeOfDay === 'night') {
        for (let i = 0; i < 5; i++) {
            if (satellites.length <= i) satellites.push({ x: (Math.random() - 0.5) * 400, y: Math.random() * 80 + 120, z: -500, speed: Math.random() * 60 + 40 });
            let s = satellites[i]; s.z += s.speed * dt;
            if (s.z > 200) { s.z = -500; s.x = (Math.random() - 0.5) * 400; }
            dummy.position.set(s.x, s.y, s.z); dummy.updateMatrix();
            satsMesh.setMatrixAt(i, dummy.matrix);
        }
        satsMesh.instanceMatrix.needsUpdate = true;
    }

    // Buildings
    for (let i = 0; i < MAX_BUILDINGS; i++) {
        if (i < buildings.length) {
            let b = buildings[i]; b.z += effectiveScrollSpeed * dt;
            dummy.position.set(b.x, b.h / 2, b.z); dummy.scale.set(b.w, b.h, b.d); dummy.rotation.set(b.rx, b.ry, b.rz); dummy.updateMatrix();
            bldgMesh.setMatrixAt(i, dummy.matrix);
        } else { dummy.scale.set(0, 0, 0); dummy.updateMatrix(); bldgMesh.setMatrixAt(i, dummy.matrix); }
    }
    bldgMesh.instanceMatrix.needsUpdate = true;

    // Lakes
    for (let i = 0; i < MAX_LAKES; i++) {
        if (i < lakes.length) {
            let l = lakes[i]; l.z += effectiveScrollSpeed * dt;
            dummy.position.set(l.x, 0.05, l.z); dummy.scale.set(l.w, l.d, 1); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.updateMatrix();
            lakesMesh.setMatrixAt(i, dummy.matrix);
        } else { dummy.scale.set(0, 0, 0); dummy.updateMatrix(); lakesMesh.setMatrixAt(i, dummy.matrix); }
    }
    lakesMesh.instanceMatrix.needsUpdate = true;

    // Mountains
    for (let i = 0; i < MAX_MOUNTAINS; i++) {
        if (i < mountains.length) {
            let m = mountains[i]; m.z += effectiveScrollSpeed * 0.15 * dt; // slow parallax
            dummy.position.set(m.x, m.h / 2 - 5, m.z); dummy.scale.set(m.w, m.h, m.w); dummy.rotation.set(0, m.ry, 0); dummy.updateMatrix();
            mountMesh.setMatrixAt(i, dummy.matrix);
        } else { dummy.scale.set(0, 0, 0); dummy.updateMatrix(); mountMesh.setMatrixAt(i, dummy.matrix); }
    }
    mountMesh.instanceMatrix.needsUpdate = true;

    // Trees
    for (let i = 0; i < MAX_TREES; i++) {
        if (i < trees.length) {
            let t = trees[i]; t.z += effectiveScrollSpeed * dt;

            // Trunk
            dummy.position.set(t.x, 1.5, t.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
            treeTrunkMesh.setMatrixAt(i, dummy.matrix);

            // Foliage
            dummy.position.set(t.x, 5.0, t.z); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
            treeConeMesh.setMatrixAt(i, dummy.matrix);
        } else {
            dummy.scale.set(0, 0, 0); dummy.updateMatrix();
            treeTrunkMesh.setMatrixAt(i, dummy.matrix); treeConeMesh.setMatrixAt(i, dummy.matrix);
        }
    }
    treeTrunkMesh.instanceMatrix.needsUpdate = true; treeConeMesh.instanceMatrix.needsUpdate = true;

    // Street Lights
    for (let i = 0; i < MAX_STREETLIGHTS; i++) {
        if (i < streetLights.length && timeOfDay === 'night') {
            let s = streetLights[i]; s.z += effectiveScrollSpeed * dt;

            // Pole
            dummy.position.set(s.x, 4.0, s.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
            lightPoleMesh.setMatrixAt(i, dummy.matrix);

            // Bulb
            let bulbX = s.x + (s.x > 0 ? -1.5 : 1.5);
            dummy.position.set(bulbX, 8.0, s.z); dummy.updateMatrix();
            bulbMesh.setMatrixAt(i, dummy.matrix);

            // Beam
            dummy.position.set(bulbX, 3.0, s.z); dummy.rotation.set(0, 0, s.x > 0 ? -0.15 : 0.15); dummy.updateMatrix();
            beamMesh.setMatrixAt(i, dummy.matrix);
        } else {
            dummy.scale.set(0, 0, 0); dummy.updateMatrix();
            lightPoleMesh.setMatrixAt(i, dummy.matrix); bulbMesh.setMatrixAt(i, dummy.matrix); beamMesh.setMatrixAt(i, dummy.matrix);
        }
    }
    lightPoleMesh.instanceMatrix.needsUpdate = true; bulbMesh.instanceMatrix.needsUpdate = true; beamMesh.instanceMatrix.needsUpdate = true;

    // Update Street Light Physical Lights (SpotLights) closest to player (z = 0)
    let activePhysicalCount = 0;
    if (timeOfDay === 'night') {
        const visibleLights = streetLights.filter(s => s.z > -120 && s.z < 25);
        visibleLights.sort((a, b) => Math.abs(a.z) - Math.abs(b.z));

        const countToEnable = Math.min(visibleLights.length, MAX_PHYSICAL_LIGHTS);
        for (let i = 0; i < countToEnable; i++) {
            const s = visibleLights[i];
            const pLight = streetLightPool[i];
            let bulbX = s.x + (s.x > 0 ? -1.5 : 1.5);

            pLight.light.position.set(bulbX, 8.0, s.z);
            pLight.target.position.set(bulbX, 0, s.z);
            pLight.light.intensity = 35.0; // high intensity for realistic glow on ground
            pLight.light.visible = true;
            activePhysicalCount++;
        }
    }

    // Turn off unused spotlights in pool
    for (let i = activePhysicalCount; i < MAX_PHYSICAL_LIGHTS; i++) {
        streetLightPool[i].light.intensity = 0;
        streetLightPool[i].light.visible = false;
    }

    // Hopping Animals
    for (let i = 0; i < MAX_ANIMALS; i++) {
        if (i < animals.length) {
            let a = animals[i];
            a.z += effectiveScrollSpeed * dt;
            
            // Hop animation using absolute sine of time
            let hopY = Math.abs(Math.sin((performance.now() * 0.005) + a.animOffset)) * 1.5;
            
            dummy.position.set(a.x, hopY + 0.4, a.z); // 0.4 offset to ground
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(0, a.x > 0 ? -Math.PI / 2 : Math.PI / 2, 0); // face side
            dummy.updateMatrix();
            animalMesh.setMatrixAt(i, dummy.matrix);
        } else {
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            animalMesh.setMatrixAt(i, dummy.matrix);
        }
    }
    animalMesh.instanceMatrix.needsUpdate = true;
}

function spawnEnvironmentObjects() {
    const spawnZ = -450;

    // Cities / Ruins (Spawns far off road)
    if (buildings.length < MAX_BUILDINGS && Math.random() < 0.25) {
        let isLeft = Math.random() > 0.5;
        let x = (isLeft ? -1 : 1) * (Math.random() * 80 + 40);
        let w = Math.random() * 20 + 15;
        let d = Math.random() * 20 + 15;
        let h = Math.random() * 120 + 30;
        let rx = 0; let ry = Math.random() * Math.PI; let rz = 0;

        if (currentBiome === 'wasteland') {
            h = Math.random() * 70 + 15;
            rx = (Math.random() - 0.5) * 0.3; // Destroyed tilt
            rz = (Math.random() - 0.5) * 0.3;
        }
        buildings.push({ x, z: spawnZ - Math.random() * 100, w, h, d, rx, ry, rz });
    }

    // Lakes / Dumps
    const pondSpawnChance = 0.04 * (1 + (saveState.decorPondsLvl || 0) * 0.4);
    if (lakes.length < MAX_LAKES && Math.random() < pondSpawnChance) {
        let isLeft = Math.random() > 0.5;
        let x = (isLeft ? -1 : 1) * (Math.random() * 50 + 45);
        let w = Math.random() * 50 + 25;
        let d = Math.random() * 50 + 25;
        lakes.push({ x, z: spawnZ, w, d });
    }

    // Mountains (Very far background)
    if (mountains.length < MAX_MOUNTAINS && Math.random() < 0.08) {
        let isLeft = Math.random() > 0.5;
        let x = (isLeft ? -1 : 1) * (Math.random() * 150 + 250);
        let w = Math.random() * 120 + 80;
        let h = Math.random() * 160 + 80;
        mountains.push({ x, z: -800, w, h, ry: Math.random() * Math.PI });
    }

    // Trees (Forest along road borders)
    const treeSpawnChance = 0.3 * (1 + (saveState.decorTreesLvl || 0) * 0.3);
    if (trees.length < MAX_TREES && Math.random() < treeSpawnChance) {
        let isLeft = Math.random() > 0.5;
        let x = (isLeft ? -1 : 1) * (Math.random() * 15 + 23); // Just outside road edges (road is 40 wide)
        trees.push({ x: x, z: spawnZ });
    }

    // Street Lights (Night only, along road borders)
    if (timeOfDay === 'night' && streetLights.length < MAX_STREETLIGHTS && Math.random() < 0.05) {
        let isLeft = Math.random() > 0.5;
        let x = isLeft ? -20.5 : 20.5;
        streetLights.push({ x: x, z: spawnZ });
    }

    // Hopping Animals
    if ((saveState.decorAnimalsLvl || 0) > 0 && animals.length < MAX_ANIMALS && Math.random() < 0.05 * saveState.decorAnimalsLvl) {
        let isLeft = Math.random() > 0.5;
        let x = (isLeft ? -1 : 1) * (Math.random() * 15 + 23);
        animals.push({ x: x, z: spawnZ, animOffset: Math.random() * 10 });
    }
}

// --- Game State ---
let gameState = 'start';
const timer = new THREE.Timer();
let scrollSpeed = 40;
let distance = 0;
let levelLength = 500;
let runCoinsCollected = 0;
let screenShakeTime = 0;
let screenShakeIntensity = 0;
let screenShakeDuration = 0;  // used for exponential decay

// Input
let targetX = 0; let isDragging = false; let startDragX = 0; let startTargetX = 0;
function handleInputStart(clientX) {
    if (gameState !== 'playing') return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isDragging = true; startDragX = clientX; startTargetX = targetX;
}
function handleInputMove(clientX) {
    if (!isDragging) return;
    const deltaX = (clientX - startDragX) / window.innerWidth * 40;
    targetX = Math.max(-18, Math.min(18, startTargetX + deltaX));
}
window.addEventListener('mousedown', e => handleInputStart(e.clientX));
window.addEventListener('mousemove', e => handleInputMove(e.clientX));
window.addEventListener('mouseup', () => isDragging = false);
window.addEventListener('touchstart', e => handleInputStart(e.touches[0].clientX));
window.addEventListener('touchmove', e => handleInputMove(e.touches[0].clientX));
window.addEventListener('touchend', () => isDragging = false);

// --- Humanoid Rig System ---
const MAX_HUMANS = 1500;

// Geometry definitions for humanoid body parts (shared across all instanced meshes)
const headGeo = new THREE.SphereGeometry(0.4, 8, 8);
const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.4);
const armGeo = new THREE.BoxGeometry(0.25, 0.55, 0.25);
const legGeo = new THREE.BoxGeometry(0.25, 0.55, 0.25);
const weaponGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6);

// Self-illuminating materials — troops and enemies glow in the dark at night biomes
const troopMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x00e5ff, metalness: 0.1, roughness: 0.1,
    clearcoat: 1.0, clearcoatRoughness: 0.1,
    emissive: new THREE.Color(0x00b8d4), emissiveIntensity: 0.85  // boosted cyan glow
});
const enemyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xff3333, metalness: 0.2, roughness: 0.4, clearcoat: 0.5,
    emissive: new THREE.Color(0xff2200), emissiveIntensity: 0.80  // boosted red glow
});
const bossMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xff0000, metalness: 0.5, roughness: 0.2, clearcoat: 1.0,
    emissive: new THREE.Color(0xff0000), emissiveIntensity: 1.2   // very strong boss glow
});
const weaponMatT = new THREE.MeshBasicMaterial({ color: 0x00ffff });

// We split meshes by alliance (Troops vs Enemies/Boss) to give them high-quality custom textures and glossiness
const headMeshT = new THREE.InstancedMesh(headGeo, troopMaterial, MAX_HUMANS);
const bodyMeshT = new THREE.InstancedMesh(bodyGeo, troopMaterial, MAX_HUMANS);
const lArmMeshT = new THREE.InstancedMesh(armGeo, troopMaterial, MAX_HUMANS);
const rArmMeshT = new THREE.InstancedMesh(armGeo, troopMaterial, MAX_HUMANS);
const lLegMeshT = new THREE.InstancedMesh(legGeo, troopMaterial, MAX_HUMANS);
const rLegMeshT = new THREE.InstancedMesh(legGeo, troopMaterial, MAX_HUMANS);
const weaponMeshT = new THREE.InstancedMesh(weaponGeo, weaponMatT, MAX_HUMANS);

const headMeshE = new THREE.InstancedMesh(headGeo, enemyMaterial, MAX_HUMANS);
const bodyMeshE = new THREE.InstancedMesh(bodyGeo, enemyMaterial, MAX_HUMANS);
const lArmMeshE = new THREE.InstancedMesh(armGeo, enemyMaterial, MAX_HUMANS);
const rArmMeshE = new THREE.InstancedMesh(armGeo, enemyMaterial, MAX_HUMANS);
const lLegMeshE = new THREE.InstancedMesh(legGeo, enemyMaterial, MAX_HUMANS);
const rLegMeshE = new THREE.InstancedMesh(legGeo, enemyMaterial, MAX_HUMANS);

const allMeshes = [
    headMeshT, bodyMeshT, lArmMeshT, rArmMeshT, lLegMeshT, rLegMeshT,
    headMeshE, bodyMeshE, lArmMeshE, rArmMeshE, lLegMeshE, rLegMeshE
];

allMeshes.forEach(m => {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
});

weaponMeshT.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(weaponMeshT);

let troops = []; let enemies = []; let playerCenterX = 0; let finishLineSpawned = false; let finishLineMesh = null;

// Pre-allocated objects reused every frame — avoids 1000+ GC allocations per second
const _dummy = new THREE.Object3D();
const _baseObj = new THREE.Object3D();

function updateHumanoidMeshes() {
    const dummy = _dummy;
    // CRITICAL: reset scale from previous frame's hide-loop — without this all troops are invisible
    dummy.scale.set(1, 1, 1);

    let tIdx = 0;
    let eIdx = 0;

    function drawHuman(h, isEnemy) {
        let meshes = isEnemy ? [headMeshE, bodyMeshE, lArmMeshE, rArmMeshE, lLegMeshE, rLegMeshE] : [headMeshT, bodyMeshT, lArmMeshT, rArmMeshT, lLegMeshT, rLegMeshT];
        let idx = isEnemy ? eIdx : tIdx;
        if (idx >= MAX_HUMANS) return;

        let time = performance.now() * 0.01;
        let scale = h.isBoss ? 4.0 : 1.0;

        let legRot = 0; let armRot = 0; let yOffset = 0;
        if (h.state === 'running') {
            legRot = Math.sin(time + h.animOffset) * 0.8; armRot = Math.cos(time + h.animOffset) * 0.8;
            yOffset = Math.abs(Math.sin((time + h.animOffset) * 2)) * 0.1 * scale;
        } else if (h.state === 'fighting') {
            armRot = Math.sin(time * 3 + h.animOffset) * 1.5; legRot = 0.2;
        }

        // Set colors dynamically!
        let color = isEnemy ? (h.isBoss ? new THREE.Color(0xff0000) : new THREE.Color(0xff3333)) : (h.color || new THREE.Color(0x00e5ff));
        if (h.flashTimer > 0) {
            // Flash white on hit
            color = new THREE.Color(0xffffff);
        }

        // Reuse pre-allocated _baseObj — no per-frame heap allocation
        const baseObj = _baseObj;
        baseObj.position.set(h.x, yOffset, h.z); baseObj.scale.setScalar(scale);
        baseObj.rotation.set(0, 0, 0);

        dummy.position.set(0, 1.0, 0); dummy.rotation.set(0, 0, 0); baseObj.add(dummy); baseObj.updateMatrixWorld(true); meshes[0].setMatrixAt(idx, dummy.matrixWorld); meshes[0].setColorAt(idx, color); baseObj.remove(dummy);
        dummy.position.set(0, 0.5, 0); dummy.rotation.set(0, 0, 0); baseObj.add(dummy); baseObj.updateMatrixWorld(true); meshes[1].setMatrixAt(idx, dummy.matrixWorld); meshes[1].setColorAt(idx, color); baseObj.remove(dummy);
        dummy.position.set(-0.35, 0.6, 0); dummy.rotation.set(armRot, 0, 0); baseObj.add(dummy); baseObj.updateMatrixWorld(true); meshes[2].setMatrixAt(idx, dummy.matrixWorld); meshes[2].setColorAt(idx, color); baseObj.remove(dummy);
        dummy.position.set(0.35, 0.6, 0); dummy.rotation.set(-armRot, 0, 0); baseObj.add(dummy); baseObj.updateMatrixWorld(true); meshes[3].setMatrixAt(idx, dummy.matrixWorld); meshes[3].setColorAt(idx, color); baseObj.remove(dummy);
        dummy.position.set(-0.15, 0.25, 0); dummy.rotation.set(-legRot, 0, 0); baseObj.add(dummy); baseObj.updateMatrixWorld(true); meshes[4].setMatrixAt(idx, dummy.matrixWorld); meshes[4].setColorAt(idx, color); baseObj.remove(dummy);
        dummy.position.set(0.15, 0.25, 0); dummy.rotation.set(legRot, 0, 0); baseObj.add(dummy); baseObj.updateMatrixWorld(true); meshes[5].setMatrixAt(idx, dummy.matrixWorld); meshes[5].setColorAt(idx, color); baseObj.remove(dummy);

        if (!isEnemy && saveState.questCompleted) {
            const armY = 0.6 - 0.275 * Math.cos(-armRot);
            const armZ = -0.275 * Math.sin(-armRot);
            dummy.position.set(0.35, armY, armZ - 0.3); // offset forward
            dummy.rotation.set(-armRot - Math.PI/3, 0, 0); // point forward/upward
            baseObj.add(dummy);
            baseObj.updateMatrixWorld(true);
            weaponMeshT.setMatrixAt(idx, dummy.matrixWorld);
            weaponMeshT.setColorAt(idx, new THREE.Color(selectedSkin === 'plasma' ? 0xff00ff : 0x00ffff));
            baseObj.remove(dummy);
        }

        if (isEnemy) eIdx++; else tIdx++;
    }

    troops.forEach(t => drawHuman(t, false));
    enemies.forEach(e => drawHuman(e, true));

    // Reset / Hide unused instances
    dummy.scale.set(0, 0, 0); dummy.updateMatrixWorld(true);
    for (let i = tIdx; i < MAX_HUMANS; i++) {
        headMeshT.setMatrixAt(i, dummy.matrixWorld); bodyMeshT.setMatrixAt(i, dummy.matrixWorld);
        lArmMeshT.setMatrixAt(i, dummy.matrixWorld); rArmMeshT.setMatrixAt(i, dummy.matrixWorld);
        lLegMeshT.setMatrixAt(i, dummy.matrixWorld); rLegMeshT.setMatrixAt(i, dummy.matrixWorld);
        weaponMeshT.setMatrixAt(i, dummy.matrixWorld);
    }
    for (let i = eIdx; i < MAX_HUMANS; i++) {
        headMeshE.setMatrixAt(i, dummy.matrixWorld); bodyMeshE.setMatrixAt(i, dummy.matrixWorld);
        lArmMeshE.setMatrixAt(i, dummy.matrixWorld); rArmMeshE.setMatrixAt(i, dummy.matrixWorld);
        lLegMeshE.setMatrixAt(i, dummy.matrixWorld); rLegMeshE.setMatrixAt(i, dummy.matrixWorld);
    }

    allMeshes.forEach(m => {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    weaponMeshT.instanceMatrix.needsUpdate = true;
    if (weaponMeshT.instanceColor) weaponMeshT.instanceColor.needsUpdate = true;
    
    troopCountEl.innerText = troops.length;
}

let gates = [];
const cachedGateGeo = new THREE.BoxGeometry(20, 8, 1); // Cached — reused for all gates to prevent geometry memory leaks

let obstacles = [];
const cachedBarrierGeo = new THREE.BoxGeometry(8, 2, 1);
const cachedWallGeo = new THREE.BoxGeometry(18, 6, 1);
const cachedSpikeGeo = new THREE.BoxGeometry(12, 0.2, 6);

const barrierMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.5, metalness: 0.5 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9, metalness: 0.1 });
const spikeMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff1100, emissiveIntensity: 0.8, roughness: 0.8 });

let powerups = [];
const cachedPowerupGeo = new THREE.OctahedronGeometry(1.0);
const powerupMatSpeed = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 1.0, roughness: 0.1 });
const powerupMatShield = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 1.0, roughness: 0.1 });
const powerupMatMagnet = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 1.0, roughness: 0.1 });

let activePowerups = {
    speedTimer: 0,
    shield: false,
    magnetTimer: 0
};

// Shield bubble visual representation
const shieldBubbleGeo = new THREE.SphereGeometry(1.0, 32, 16);
const shieldBubbleMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.25, wireframe: true });
const shieldBubbleMesh = new THREE.Mesh(shieldBubbleGeo, shieldBubbleMat);
scene.add(shieldBubbleMesh);

// Boss Health Bar billboard meshes
const bossHbBgGeo = new THREE.BoxGeometry(6, 0.4, 0.1);
const bossHbBgMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
const bossHbBgMesh = new THREE.Mesh(bossHbBgGeo, bossHbBgMat);
const bossHbFillGeo = new THREE.BoxGeometry(6, 0.4, 0.1);
const bossHbFillMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const bossHbFillMesh = new THREE.Mesh(bossHbFillGeo, bossHbFillMat);
scene.add(bossHbBgMesh);
scene.add(bossHbFillMesh);
bossHbBgMesh.visible = false;
bossHbFillMesh.visible = false;

function createGateTexture(text, colorHex) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = colorHex; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = 'white'; ctx.font = 'bold 70px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 64);
    return new THREE.CanvasTexture(canvas);
}

function spawnGates() {
    const z = -250;
    const isLeftPositive = Math.random() > 0.5;
    let t1 = isLeftPositive ? (Math.random() > 0.5 ? 'add' : 'mul') : 'sub';
    let t2 = isLeftPositive ? 'sub' : (Math.random() > 0.5 ? 'add' : 'mul');
    if (Math.random() > 0.8) { t1 = 'add'; t2 = 'mul'; }

    const lvl = saveState.level;
    let v1 = t1 === 'mul' ? Math.floor(Math.random() * 2) + 2 : (t1 === 'add' ? getGateAddValue(lvl) : getGateSubValue(lvl));
    let v2 = t2 === 'mul' ? Math.floor(Math.random() * 2) + 2 : (t2 === 'add' ? getGateAddValue(lvl) : getGateSubValue(lvl));

    let c1 = (t1 === 'add' || t1 === 'mul') ? '#00ff66' : '#ff3333';
    let c2 = (t2 === 'add' || t2 === 'mul') ? '#00ff66' : '#ff3333';

    // Reuse cached geometry to avoid memory leaks
    const mat1 = new THREE.MeshStandardMaterial({ map: createGateTexture(t1 === 'add' ? '+' + v1 : t1 === 'sub' ? '-' + v1 : 'x' + v1, c1), emissive: new THREE.Color(c1), emissiveIntensity: 0.5 });
    const mesh1 = new THREE.Mesh(cachedGateGeo, mat1); mesh1.position.set(-10, 4, z); mesh1.castShadow = true; scene.add(mesh1);

    const mat2 = new THREE.MeshStandardMaterial({ map: createGateTexture(t2 === 'add' ? '+' + v2 : t2 === 'sub' ? '-' + v2 : 'x' + v2, c2), emissive: new THREE.Color(c2), emissiveIntensity: 0.5 });
    const mesh2 = new THREE.Mesh(cachedGateGeo, mat2); mesh2.position.set(10, 4, z); mesh2.castShadow = true; scene.add(mesh2);

    gates.push({ mesh: mesh1, type: t1, value: v1, used: false });
    gates.push({ mesh: mesh2, type: t2, value: v2, used: false });
}

function spawnEnemies() {
    const z = -250;
    const lvl = saveState.level;
    let isBoss = Math.random() > getBossSpawnChance(lvl) && lvl > 1;
    if (isBoss) {
        const bossHp = getBossHp(lvl);
        enemies.push({ x: 0, z: z, hp: bossHp, maxHp: bossHp, flashTimer: 0, isBoss: true, radiusSq: 36.0, state: 'running', animOffset: Math.random() * 10 });
        spawnFloatingText(0, 10, z, "BOSS!", "#ff0000");
    } else {
        let count = getEnemyCount(lvl);
        const hp = getEnemyBaseHp(lvl);
        for (let i = 0; i < count; i++) {
            enemies.push({ x: (Math.random() - 0.5) * 24, z: z + Math.random() * 15, hp: hp, maxHp: hp, flashTimer: 0, isBoss: false, radiusSq: 2.25, state: 'running', animOffset: Math.random() * 10 });
        }
    }
}
function spawnObstacle() {
    const z = -250;
    const r = Math.random();
    let mesh, type, x;

    if (r < 0.35) {
        // Low Barrier
        type = 'barrier';
        x = (Math.random() - 0.5) * 24;
        mesh = new THREE.Mesh(cachedBarrierGeo, barrierMat);
        mesh.position.set(x, 1, z);
    } else if (r < 0.7) {
        // Wide Wall
        type = 'wall';
        const isLeft = Math.random() > 0.5;
        x = isLeft ? -10 : 10;
        mesh = new THREE.Mesh(cachedWallGeo, wallMat);
        mesh.position.set(x, 3, z);
    } else {
        // Spike Trap
        type = 'spike';
        x = (Math.random() - 0.5) * 20;
        mesh = new THREE.Mesh(cachedSpikeGeo, spikeMat);
        mesh.position.set(x, 0.1, z);
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obstacles.push({ mesh: mesh, type: type, x: x, z: z, hit: false });
}

function spawnPowerup() {
    const z = -250;
    const r = Math.random();
    let type, mat;
    if (r < 0.33) {
        type = 'speed';
        mat = powerupMatSpeed;
    } else if (r < 0.66) {
        type = 'shield';
        mat = powerupMatShield;
    } else {
        type = 'magnet';
        mat = powerupMatMagnet;
    }

    const x = (Math.random() - 0.5) * 20;
    const mesh = new THREE.Mesh(cachedPowerupGeo, mat);
    mesh.position.set(x, 1.2, z);
    mesh.castShadow = true;
    scene.add(mesh);
    powerups.push({ mesh: mesh, type: type, x: x, collected: false });
}
const MAX_COINS = 100;
const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
const coinMat = new THREE.MeshPhysicalMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.2, emissive: 0xaa8800, emissiveIntensity: 0.5 });
const coinsMesh = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS);
coinsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); coinsMesh.castShadow = true; scene.add(coinsMesh);
let coinsList = [];

// --- Biome Shader Animation Timer ---
let biomeTime = 0;

// ─── Motion Trail System ─────────────────────────────────────────────────────
// Uses a pool of semi-transparent sprite planes placed at recent troop positions
const MAX_TRAIL_INSTANCES = 3000;
const trailGeo = new THREE.PlaneGeometry(0.8, 1.8);
const trailMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff, transparent: true, opacity: 0.0,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
});
const trailMesh = new THREE.InstancedMesh(trailGeo, trailMat, MAX_TRAIL_INSTANCES);
trailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(trailMesh);
let trailInstances = []; // { x, y, z, life, scale, color }
const _trailDummy = new THREE.Object3D();

function spawnTrail(x, z, isBoss) {
    if (trailInstances.length >= MAX_TRAIL_INSTANCES) return;
    trailInstances.push({
        x, y: isBoss ? 4.0 : 1.0, z,
        life: 1.0,
        decay: isBoss ? 3.0 : 5.5,
        scale: isBoss ? 3.5 : 0.9,
        isBoss
    });
}

function updateTrailMesh(dt) {
    const color = new THREE.Color();
    for (let i = 0; i < MAX_TRAIL_INSTANCES; i++) {
        if (i < trailInstances.length) {
            const t = trailInstances[i];
            t.life -= t.decay * dt;
            const s = Math.max(0, t.life) * t.scale;
            _trailDummy.position.set(t.x, t.y, t.z);
            _trailDummy.scale.set(s, s, s);
            _trailDummy.rotation.set(Math.PI * 0.15, 0, 0);
            _trailDummy.updateMatrix();
            trailMesh.setMatrixAt(i, _trailDummy.matrix);
            const alpha = Math.max(0, t.life) * 0.6;
            if (t.isBoss) color.setHex(0xff2200); else color.setHex(0x00e5ff);
            trailMesh.setColorAt(i, color);
        } else {
            _trailDummy.scale.set(0, 0, 0);
            _trailDummy.updateMatrix();
            trailMesh.setMatrixAt(i, _trailDummy.matrix);
        }
    }
    trailMesh.instanceMatrix.needsUpdate = true;
    if (trailMesh.instanceColor) trailMesh.instanceColor.needsUpdate = true;
    trailInstances = trailInstances.filter(t => t.life > 0);
}

// ─── Ambient Biome Particle System ───────────────────────────────────────────
const MAX_AMBIENT = 300;
const ambientGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
const ambientMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
});
const ambientMesh = new THREE.InstancedMesh(ambientGeo, ambientMat, MAX_AMBIENT);
ambientMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(ambientMesh);
let ambientParticles = [];
const _ambDummy = new THREE.Object3D();

function spawnAmbientParticle() {
    if (ambientParticles.length >= MAX_AMBIENT) return;
    let color, vy, speed, rx, ry;
    const x = (Math.random() - 0.5) * 36;
    const z = (Math.random() - 0.5) * 20 - 5;
    if (currentBiome === 'utopia') {
        color = 0xffd700; vy = 1.5 + Math.random(); speed = 0.3;
    } else if (currentBiome === 'wasteland') {
        color = 0xff4400; vy = 2.5 + Math.random() * 2; speed = 0.8;
    } else if (currentBiome === 'neon') {
        color = Math.random() > 0.5 ? 0x00ffff : 0xff00ff;
        vy = 1.0 + Math.random() * 1.5; speed = 0.4;
    } else if (currentBiome === 'tundra') {
        color = 0xddf4ff; vy = -0.8 - Math.random() * 0.5; speed = 0.2;
    } else if (currentBiome === 'lava') {
        color = Math.random() > 0.5 ? 0xff3300 : 0xff8800;
        vy = 3.0 + Math.random() * 2; speed = 1.0;
    } else { return; }
    ambientParticles.push({
        x, y: Math.random() * 3,
        z, vy, life: 1.0,
        vx: (Math.random() - 0.5) * speed,
        vz: (Math.random() - 0.5) * speed * 0.5,
        color: new THREE.Color(color),
        rot: Math.random() * Math.PI * 2
    });
}

function updateAmbientMesh(dt) {
    for (let i = 0; i < MAX_AMBIENT; i++) {
        if (i < ambientParticles.length) {
            const p = ambientParticles[i];
            p.x += p.vx; p.y += p.vy * dt; p.z += p.vz;
            p.rot += dt * 2;
            p.life -= dt * (currentBiome === 'wasteland' || currentBiome === 'lava' ? 0.6 : 0.4);
            const s = Math.max(0, p.life) * (currentBiome === 'lava' ? 0.4 : 0.25);
            _ambDummy.position.set(p.x, p.y, p.z);
            _ambDummy.scale.set(s, s, s);
            _ambDummy.rotation.set(p.rot, p.rot * 0.5, 0);
            _ambDummy.updateMatrix();
            ambientMesh.setMatrixAt(i, _ambDummy.matrix);
            ambientMesh.setColorAt(i, p.color);
        } else {
            _ambDummy.scale.set(0, 0, 0);
            _ambDummy.updateMatrix();
            ambientMesh.setMatrixAt(i, _ambDummy.matrix);
        }
    }
    ambientMesh.instanceMatrix.needsUpdate = true;
    if (ambientMesh.instanceColor) ambientMesh.instanceColor.needsUpdate = true;
    ambientParticles = ambientParticles.filter(p => p.life > 0);
}

// ─── Glow Aura Sprites ───────────────────────────────────────────────────────
function createGlowTexture(colorHex) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    const col = new THREE.Color(colorHex);
    grad.addColorStop(0, `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},0.9)`);
    grad.addColorStop(0.5, `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},0.3)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}

const glowTexTroop = createGlowTexture(0x00e5ff);
const glowTexEnemy = createGlowTexture(0xff3333);
const glowTexBoss = createGlowTexture(0xff0000);

const MAX_GLOW_SPRITES = 800;
const glowMatTroop = new THREE.SpriteMaterial({ map: glowTexTroop, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
const glowMatEnemy = new THREE.SpriteMaterial({ map: glowTexEnemy, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
const glowMatBoss = new THREE.SpriteMaterial({ map: glowTexBoss, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });

// Glow sprites pools (reused — no per-frame allocation)
const glowSpritesTroop = [];
const glowSpritesEnemy = [];
for (let i = 0; i < MAX_GLOW_SPRITES; i++) {
    const s = new THREE.Sprite(glowMatTroop.clone());
    s.scale.set(0, 0, 0); scene.add(s); glowSpritesTroop.push(s);
}
for (let i = 0; i < 60; i++) {
    const s = new THREE.Sprite(glowMatEnemy.clone());
    s.scale.set(0, 0, 0); scene.add(s); glowSpritesEnemy.push(s);
}

function updateGlowSprites(bossTime) {
    // Troops
    for (let i = 0; i < MAX_GLOW_SPRITES; i++) {
        if (i < troops.length) {
            const t = troops[i];
            const sp = glowSpritesTroop[i];
            sp.position.set(t.x, 0.05, t.z);
            sp.scale.set(1.6, 1.6, 1.6);
        } else {
            glowSpritesTroop[i].scale.set(0, 0, 0);
        }
    }
    // Enemies
    for (let i = 0; i < glowSpritesEnemy.length; i++) {
        if (i < enemies.length && !enemies[i].dead) {
            const e = enemies[i];
            const sp = glowSpritesEnemy[i];
            const isBoss = e.isBoss;
            const pulse = isBoss ? 3.5 + Math.sin(bossTime * 4) * 1.2 : 1.8;
            sp.position.set(e.x, 0.05, e.z);
            sp.scale.set(pulse, pulse, pulse);
            sp.material = isBoss ? glowMatBoss : glowMatEnemy;
        } else {
            glowSpritesEnemy[i].scale.set(0, 0, 0);
        }
    }
}

// ─── HUD Animation Helpers ────────────────────────────────────────────────────
let _lastTroopCount = 0;
let _lastCoinCount = 0;

function hudTroopPop() {
    if (!hudTroopsEl) return;
    hudTroopsEl.classList.remove('pop');
    void hudTroopsEl.offsetWidth; // reflow to restart animation
    hudTroopsEl.classList.add('pop');
}
function hudCoinFlash() {
    if (!hudCoinsEl) return;
    hudCoinsEl.classList.remove('coin-flash');
    void hudCoinsEl.offsetWidth;
    hudCoinsEl.classList.add('coin-flash');
}

// ─── Flash / Vignette Helpers ─────────────────────────────────────────────────
function triggerFlash(type) {
    if (!flashOverlay) return;
    flashOverlay.className = '';
    void flashOverlay.offsetWidth;
    flashOverlay.classList.add('flash-' + type);
    setTimeout(() => { flashOverlay.className = ''; }, 500);
}

function triggerVignetteDanger() {
    if (!vignetteOverlay) return;
    vignetteOverlay.classList.remove('vignette-danger');
    void vignetteOverlay.offsetWidth;
    vignetteOverlay.classList.add('vignette-danger');
    setTimeout(() => vignetteOverlay.classList.remove('vignette-danger'), 700);
}

// ─── Chromatic Aberration on Screen Shake ────────────────────────────────────
function triggerChromaFlash() {
    canvas.classList.remove('screen-shake');
    void canvas.offsetWidth;
    canvas.classList.add('screen-shake');
    setTimeout(() => canvas.classList.remove('screen-shake'), 280);
}

function updateCoinsMesh(dt, effectiveScrollSpeed) {
    if (!updateCoinsMesh._dummy) updateCoinsMesh._dummy = new THREE.Object3D();
    const dummy = updateCoinsMesh._dummy;
    for (let i = 0; i < MAX_COINS; i++) {
        if (i < coinsList.length) {
            let c = coinsList[i]; c.rot += dt * 3;
            dummy.position.set(c.x, 0.5, c.z); dummy.rotation.set(Math.PI / 2, c.rot, 0); dummy.updateMatrix();
            coinsMesh.setMatrixAt(i, dummy.matrix);
        } else { dummy.scale.set(0, 0, 0); dummy.updateMatrix(); coinsMesh.setMatrixAt(i, dummy.matrix); }
    }
    coinsMesh.instanceMatrix.needsUpdate = true;
}
function spawnCoins() {
    const z = -250; let trackX = (Math.random() - 0.5) * 20;
    const count = getCoinSpawnCount(saveState.level);
    for (let i = 0; i < Math.min(count, 20); i++) { if (coinsList.length < MAX_COINS) coinsList.push({ x: trackX, z: z - i * 2.5, rot: Math.random() * Math.PI }); }
}

function spawnFinishLine() {
    if (finishLineMesh) return;
    const geo = new THREE.BoxGeometry(40, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 });
    finishLineMesh = new THREE.Mesh(geo, mat); finishLineMesh.position.set(0, 0, -250); scene.add(finishLineMesh);
    finishLineSpawned = true;
}

const MAX_PARTICLES = 1000;
const particleGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const particleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
const particlesMesh = new THREE.InstancedMesh(particleGeo, particleMat, MAX_PARTICLES);
particlesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(particlesMesh);
let particles = [];

function spawnParticles(x, y, z, colorHex, count, explodeSpeed = 15) {
    for (let i = 0; i < count; i++) {
        if (particles.length >= MAX_PARTICLES) break;
        particles.push({
            x: x, y: y, z: z, vx: (Math.random() - 0.5) * explodeSpeed, vy: Math.random() * explodeSpeed / 2 + 5, vz: (Math.random() - 0.5) * explodeSpeed,
            life: 1.0, color: new THREE.Color(colorHex)
        });
    }
}
function updateParticlesMesh(dt) {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < MAX_PARTICLES; i++) {
        if (i < particles.length) {
            let p = particles[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 30 * dt; p.life -= dt * 2;
            if (p.y < 0) p.y = 0;
            dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(Math.max(0, p.life)); dummy.updateMatrix();
            particlesMesh.setMatrixAt(i, dummy.matrix); particlesMesh.setColorAt(i, p.color);
        } else { dummy.scale.set(0, 0, 0); dummy.updateMatrix(); particlesMesh.setMatrixAt(i, dummy.matrix); }
    }
    particlesMesh.instanceMatrix.needsUpdate = true;
    if (particlesMesh.instanceColor) particlesMesh.instanceColor.needsUpdate = true;
    particles = particles.filter(p => p.life > 0);
}

let textSprites = [];
function createTextSprite(text, colorHex) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = colorHex; ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeStyle = 'black'; ctx.lineWidth = 4;
    ctx.strokeText(text, 64, 32); ctx.fillText(text, 64, 32);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
}
function spawnFloatingText(x, y, z, text, colorHex, scale = 3) {
    const sprite = createTextSprite(text, colorHex); sprite.position.set(x, y, z); sprite.scale.set(scale, scale / 2, 1);
    scene.add(sprite); textSprites.push({ sprite: sprite, life: 1.0 });
}
function updateTextSprites(dt) {
    textSprites.forEach(t => {
        t.life -= dt * 1.5; t.sprite.position.y += dt * 5; t.sprite.material.opacity = Math.max(0, t.life);
        if (t.life <= 0) {
            scene.remove(t.sprite);
            t.sprite.material.map.dispose();
            t.sprite.material.dispose();
        }
    });
    textSprites = textSprites.filter(t => t.life > 0);
}

// --- Logic ---
function initGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    checkAchievements();

    troops = []; gates.forEach(g => {
        scene.remove(g.mesh);
        g.mesh.material.map.dispose();
        g.mesh.material.dispose();
        // Note: do NOT dispose g.mesh.geometry — it's the shared cachedGateGeo
    }); gates = []; textSprites.forEach(t => scene.remove(t.sprite)); textSprites = [];
    if (finishLineMesh) { scene.remove(finishLineMesh); finishLineMesh = null; }
    enemies = []; particles = []; coinsList = [];
    buildings = []; lakes = []; mountains = []; trees = []; streetLights = []; animals = [];
    if (typeof streetLightPool !== 'undefined') {
        streetLightPool.forEach(p => { p.light.intensity = 0; p.light.visible = false; });
    }

    obstacles.forEach(o => scene.remove(o.mesh)); obstacles = [];
    powerups.forEach(p => scene.remove(p.mesh)); powerups = [];
    activePowerups = { speedTimer: 0, shield: false, magnetTimer: 0 };
    if (shieldBubbleMesh) shieldBubbleMesh.scale.set(0, 0, 0);
    if (bossHbBgMesh) bossHbBgMesh.visible = false;
    if (bossHbFillMesh) bossHbFillMesh.visible = false;

    document.getElementById('badge-speed').style.display = 'none';
    document.getElementById('badge-shield').style.display = 'none';
    document.getElementById('badge-magnet').style.display = 'none';

    runCoinsCollected = 0; screenShakeTime = 0; finishLineSpawned = false;
    biomeTime = 0;
    trailInstances = [];
    ambientParticles = [];
    _lastTroopCount = 0;
    _lastCoinCount = 0;
    if (speedLinesEl) speedLinesEl.classList.remove('active', 'boss-danger');
    // Reset biome bloom to defaults
    bloomPass.strength = 0.8; bloomPass.threshold = 0.85;

    targetX = 0; playerCenterX = 0; distance = 0; scrollSpeed = SCROLL_SPEED_BASE;
    levelLength = LEVEL_BASE_LENGTH + (saveState.level * LEVEL_LENGTH_SCALE);

    applyBiomeSettings();

    let startCount = saveState.upgradeTroops;
    const skinColor = new THREE.Color(getSkinColor(selectedSkin));
    for (let i = 0; i < startCount; i++) {
        const variation = 0.85 + Math.random() * 0.3;
        const col = skinColor.clone().multiplyScalar(variation);
        troops.push({ x: 0, z: 0, offsetX: (Math.random() - 0.5) * 5, offsetZ: (Math.random() - 0.5) * 5, state: 'running', animOffset: Math.random() * 10, fightTimer: 0, color: col });
    }

    gameState = 'playing';
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    levelCompleteScreen.style.display = 'none';
    pauseScreen.style.display = 'none';
    scoreDisplay.style.display = 'flex';
    timer.reset();
}

function triggerScreenShake(duration, intensity) {
    screenShakeTime = duration;
    screenShakeDuration = Math.max(screenShakeDuration, duration); // allow stacking
    screenShakeIntensity = Math.max(screenShakeIntensity, intensity);
    if (intensity >= 1.0) {
        triggerChromaFlash();
        triggerVignetteDanger();
    }
}

function adjustTroopCount(newCount, x, z) {
    newCount = Math.max(0, Math.min(newCount, MAX_CROWD));
    let diff = newCount - troops.length;

    if (diff < 0 && activePowerups.shield) {
        activePowerups.shield = false;
        spawnParticles(playerCenterX, 1, 0, 0x00aaff, 40);
        spawnFloatingText(playerCenterX, 3, 0, "SHIELD ABSORBED!", "#00aaff");
        return;
    }

    if (diff > 0) {
        for (let i = 0; i < diff; i++) {
            let col = new THREE.Color().setHSL(0.5 + (Math.random() - 0.5) * 0.15, 0.95, 0.5);
            troops.push({ x: playerCenterX, z: 0, offsetX: (Math.random() - 0.5) * 10, offsetZ: (Math.random() - 0.5) * 10, state: 'running', animOffset: Math.random() * 10, fightTimer: 0, color: col });
        }
        spawnParticles(playerCenterX, 1, 0, 0x00ff66, 20);
        spawnFloatingText(x, 4, z, "+" + diff, "#00ff66"); SoundEngine.gateGood();
        triggerFlash('good');
        hudTroopPop();
    } else if (diff < 0) {
        let amtLost = -diff; troops.splice(0, amtLost);
        spawnParticles(playerCenterX, 1, 0, 0xff3333, 30, 25); spawnFloatingText(x, 4, z, diff, "#ff3333"); SoundEngine.gateBad(); triggerScreenShake(0.5, amtLost > 50 ? 2.0 : 0.5);
        triggerFlash('bad');
        triggerVignetteDanger();
        hudTroopPop();
    }

    if (troops.length === 0) {
        gameState = 'gameover'; scoreDisplay.style.display = 'none'; gameOverScreen.style.display = 'block';
        runCoinsGameOverEl.innerText = runCoinsCollected; saveState.coins += runCoinsCollected; saveGame();
    }
}

function updateGame(dt) {
    if (gameState !== 'playing') return;

    // --- Update active powerups ---
    if (activePowerups.speedTimer > 0) {
        activePowerups.speedTimer = Math.max(0, activePowerups.speedTimer - dt);
        document.getElementById('badge-speed').style.display = 'block';
        if (Math.random() < 0.35) {
            spawnParticles(playerCenterX + (Math.random() - 0.5) * 3, 0.2, (Math.random() - 0.5) * 2, 0x00ffff, 2, 5);
        }
    } else {
        document.getElementById('badge-speed').style.display = 'none';
    }

    if (activePowerups.magnetTimer > 0) {
        activePowerups.magnetTimer = Math.max(0, activePowerups.magnetTimer - dt);
        document.getElementById('badge-magnet').style.display = 'block';
    } else {
        document.getElementById('badge-magnet').style.display = 'none';
    }

    const clusterRadius = Math.max(2.0, Math.sqrt(troops.length) * 0.5);

    if (activePowerups.shield) {
        document.getElementById('badge-shield').style.display = 'block';
        if (shieldBubbleMesh) {
            shieldBubbleMesh.position.set(playerCenterX, 0.5, 0);
            shieldBubbleMesh.scale.setScalar(clusterRadius + 1.2);
            shieldBubbleMesh.rotation.y += dt * 1.5;
        }
    } else {
        document.getElementById('badge-shield').style.display = 'none';
        if (shieldBubbleMesh) shieldBubbleMesh.scale.setScalar(0);
    }

    let effectiveScrollSpeed = scrollSpeed;
    if (activePowerups.speedTimer > 0) {
        effectiveScrollSpeed = SCROLL_SPEED_BASE * 1.8;
    } else {
        const fightingCount = troops.filter(t => t.state === 'fighting').length;
        if (fightingCount > 0) effectiveScrollSpeed = scrollSpeed * SCROLL_SPEED_FIGHT;
    }

    distance += effectiveScrollSpeed * dt;
    playerCenterX += (targetX - playerCenterX) * 5 * dt;

    enemies.forEach(e => {
        if (e.dead) return;
        e.z += effectiveScrollSpeed * dt;
        if (e.flashTimer > 0) e.flashTimer -= dt;

        let eRadius = e.isBoss ? 4.0 : 1.5;
        let distToPlayer = Math.abs(e.z) + Math.abs(e.x - playerCenterX);
        if (distToPlayer < clusterRadius + eRadius + 5) {
            troops.forEach(t => {
                if (t.state === 'running' && !e.dead) {
                    let dx = t.x - e.x; let dz = t.z - e.z;
                    if (dx * dx + dz * dz < (eRadius + 1.5) * (eRadius + 1.5)) { t.state = 'fighting'; t.targetEnemy = e; }
                }
            });
        }
    });

    // Update Boss Health Bar Billboard
    const activeBoss = enemies.find(e => e.isBoss && !e.dead);
    if (activeBoss) {
        bossHbBgMesh.visible = true;
        bossHbFillMesh.visible = true;

        let pct = Math.max(0, activeBoss.hp / activeBoss.maxHp);
        bossHbBgMesh.position.set(activeBoss.x, 8.0, activeBoss.z);
        bossHbFillMesh.scale.set(pct, 1, 1);
        bossHbFillMesh.position.set(activeBoss.x - 3.0 * (1 - pct), 8.01, activeBoss.z);
    } else {
        bossHbBgMesh.visible = false;
        bossHbFillMesh.visible = false;
    }

    for (let i = 0; i < troops.length; i++) {
        let t = troops[i];
        if (t.state === 'fighting') {
            if (!t.targetEnemy || t.targetEnemy.dead) { t.state = 'running'; t.targetEnemy = null; }
            else {
                t.x += (t.targetEnemy.x + (Math.random() - 0.5) * 2 - t.x) * 5 * dt; t.z += (t.targetEnemy.z + (Math.random() - 0.5) * 2 - t.z) * 5 * dt;
                t.fightTimer += dt;
                if (t.fightTimer > TROOP_FIGHT_INTERVAL) {
                    let dmg = 1 + (saveState.upgradeAttack - 1) * 0.5;
                    if (saveState.questCompleted) {
                        dmg += 1.0; // Weapon damage boost
                    }
                    t.targetEnemy.hp -= dmg;
                    t.targetEnemy.flashTimer = 0.12;

                    // Per-hit impact: small spark burst + sound
                    if (t.targetEnemy.isBoss) {
                        spawnParticles(t.targetEnemy.x, 1.5, t.targetEnemy.z, 0xff8800, 6, 12);
                        SoundEngine.bossHit();
                    } else {
                        spawnParticles(t.targetEnemy.x, 1, t.targetEnemy.z, 0xffff00, 3, 8);
                        SoundEngine.punch();
                    }

                    let finalDeathChance = Math.max(0.04, TROOP_DEATH_CHANCE - (saveState.upgradeAttack - 1) * 0.02);
                    if (Math.random() < finalDeathChance) { t.dead = true; spawnParticles(t.x, 1, t.z, 0xff3333, 5); hapticBuzz(); }

                    // Enemy kill
                    if (t.targetEnemy.hp <= 0 && !t.targetEnemy.dead) {
                        t.targetEnemy.dead = true;
                        if (t.targetEnemy.isBoss) {
                            // Boss kill — massive impact
                            spawnParticles(t.targetEnemy.x, 3, t.targetEnemy.z, 0xff0000, 80, 30);
                            spawnParticles(t.targetEnemy.x, 2, t.targetEnemy.z, 0xff8800, 60, 20);
                            spawnParticles(t.targetEnemy.x, 4, t.targetEnemy.z, 0xffff00, 40, 15);
                            spawnFloatingText(t.targetEnemy.x, 6, t.targetEnemy.z, "BOSS SLAIN!", "#ff6600", 5);
                            triggerScreenShake(0.7, 1.8);
                            triggerFlash('bad');
                            SoundEngine.victory();
                        } else {
                            // Regular enemy kill — satisfying pop
                            spawnParticles(t.targetEnemy.x, 2, t.targetEnemy.z, 0xff3333, 20, 18);
                            spawnParticles(t.targetEnemy.x, 1.5, t.targetEnemy.z, 0xffaa00, 8, 10);
                            triggerScreenShake(0.18, 0.4);
                            SoundEngine.hit();
                        }
                    }
                }
            }
        }
        if (t.state === 'running') {
            // Separation: O(n·SEPARATION_NEIGHBORS) instead of O(n²).
            // For small crowds check all; for large crowds sample a fixed window of neighbors.
            if (troops.length <= SEPARATION_NEIGHBORS || Math.random() > SEPARATION_SKIP_RAND) {
                let sepX = 0; let sepZ = 0;
                const checkCount = Math.min(troops.length, SEPARATION_NEIGHBORS);
                // Sample neighbors starting from a random offset to avoid always checking the same subset
                const startJ = troops.length <= SEPARATION_NEIGHBORS ? 0 : Math.floor(Math.random() * troops.length);
                for (let k = 0; k < checkCount; k++) {
                    const j = (startJ + k) % troops.length;
                    if (i === j) continue;
                    const o = troops[j];
                    const dx = t.offsetX - o.offsetX; const dz = t.offsetZ - o.offsetZ;
                    const distSq = dx * dx + dz * dz;
                    if (distSq < 1.0 && distSq > 0) {
                        const push = (1.0 - distSq) * 0.5;
                        sepX += dx * push; sepZ += dz * push;
                    }
                }
                t.offsetX += sepX; t.offsetZ += sepZ;
            }
            const dist = Math.sqrt(t.offsetX * t.offsetX + t.offsetZ * t.offsetZ);
            if (dist > clusterRadius) { t.offsetX = (t.offsetX / dist) * clusterRadius; t.offsetZ = (t.offsetZ / dist) * clusterRadius; }
            t.x += (playerCenterX + t.offsetX - t.x) * 5 * dt; t.z += (0 + t.offsetZ - t.z) * 5 * dt;
        }
    }

    let preCount = troops.length; troops = troops.filter(t => !t.dead);
    if (preCount !== troops.length && troops.length === 0) {
        gameState = 'gameover';
        scoreDisplay.style.display = 'none';
        gameOverScreen.style.display = 'flex';
        runCoinsGameOverEl.innerText = runCoinsCollected;
        if (defeatLevelEl) defeatLevelEl.innerText = saveState.level;
        saveState.coins += runCoinsCollected; saveGame(); return;
    }

    if (distance < levelLength) {
        updateProgressBar();
        spawnEnvironmentObjects();
        if (distance % GATE_SPAWN_INTERVAL < effectiveScrollSpeed * dt) {
            let r = Math.random();
            if (r < 0.30) spawnGates();
            else if (r < 0.50) spawnEnemies();
            else if (r < 0.65) spawnObstacle();
            else if (r < 0.80) spawnPowerup();
            else spawnCoins();
        }
    } else if (!finishLineSpawned) spawnFinishLine();

    if (finishLineSpawned && finishLineMesh) {
        finishLineMesh.position.z += effectiveScrollSpeed * dt;
        if (finishLineMesh.position.z > 0) {
            gameState = 'levelcomplete';
            scoreDisplay.style.display = 'none';
            levelCompleteScreen.style.display = 'flex';
            const survivors = troops.length;
            let bonus = Math.floor(survivors * getBonusCoinMultiplier(saveState.level));
            survivingTroopsEl.innerText = survivors;
            bonusCoinsEl.innerText = bonus;
            if (starRatingEl) starRatingEl.textContent = getStarRating(survivors);
            if (nextBiomeNameEl) nextBiomeNameEl.textContent = getBiomeInfo(saveState.level + 1).name;
            saveState.coins += runCoinsCollected + bonus; saveState.level += 1; saveGame(); SoundEngine.victory();
            triggerFlash('victory');
        }
    }

    // Camera zoom: give a minimum 4-unit zoom-in so even a single troop is clearly visible
    let zoomOut = Math.max(3.0, clusterRadius * 0.6);
    let targetCamY = baseCameraPos.y + zoomOut * 0.5;
    let targetCamZ = baseCameraPos.z + zoomOut * 0.4;
    camera.position.y += (targetCamY - camera.position.y) * 2 * dt;
    camera.position.z += (targetCamZ - camera.position.z) * 2 * dt;

    // Micro screen shake — sinusoidal, X-axis only, decays with time (no building wobble)
    if (screenShakeTime > 0) {
        screenShakeTime = Math.max(0, screenShakeTime - dt);
        const decay = screenShakeDuration > 0 ? (screenShakeTime / screenShakeDuration) : 0;
        const mag = Math.min(0.28, screenShakeIntensity * 0.14) * decay;
        camera.position.x = Math.sin(screenShakeTime * 50) * mag;
        if (screenShakeTime <= 0) { screenShakeIntensity = 0; screenShakeDuration = 0; }
    } else {
        camera.position.x += (0 - camera.position.x) * 8 * dt; // smooth return to center
    }

    // Look toward horizon — low angle gives cinematic sky view
    camera.lookAt(playerCenterX * 0.15, 3.5, -80);

    gates.forEach(g => {
        g.mesh.position.z += effectiveScrollSpeed * dt;
        if (!g.used && g.mesh.position.z > -2 && g.mesh.position.z < 2) {
            const isLeftGate = g.mesh.position.x < 0;
            const playerOnLeftSide = playerCenterX < 0;
            if ((isLeftGate && playerOnLeftSide) || (!isLeftGate && !playerOnLeftSide)) {
                g.used = true; gates.forEach(og => { if (Math.abs(og.mesh.position.z - g.mesh.position.z) < 2) og.used = true; });
                let newCount = troops.length;
                if (g.type === 'add') newCount += g.value; if (g.type === 'sub') newCount -= g.value; if (g.type === 'mul') newCount *= g.value;
                adjustTroopCount(newCount, g.mesh.position.x, g.mesh.position.z);
            }
        }
    });

    // Update Obstacles
    obstacles.forEach(o => {
        if (o.hit) return;
        o.mesh.position.z += effectiveScrollSpeed * dt;
        const oZ = o.mesh.position.z;
        if (oZ > -6 && oZ < 6) {
            // Check shield absorption
            if (activePowerups.shield) {
                let isColliding = false;
                if (o.type === 'barrier' && Math.abs(playerCenterX - o.mesh.position.x) < 4.5) isColliding = true;
                else if (o.type === 'wall' && Math.abs(playerCenterX - o.mesh.position.x) < 9.5) isColliding = true;
                else if (o.type === 'spike' && Math.abs(playerCenterX - o.mesh.position.x) < 6.5) isColliding = true;

                if (isColliding) {
                    activePowerups.shield = false;
                    o.hit = true;
                    scene.remove(o.mesh);
                    spawnParticles(o.mesh.position.x, 1, oZ, 0x00aaff, 40);
                    spawnFloatingText(playerCenterX, 3, 0, "SHIELD ABSORBED!", "#00aaff");
                    SoundEngine.gateGood();
                    return;
                }
            }

            // Troop collisions
            troops.forEach(t => {
                if (t.dead) return;
                if (o.type === 'barrier') {
                    if (Math.abs(t.z - oZ) < 0.8 && Math.abs(t.x - o.mesh.position.x) < 4.2) {
                        t.dead = true;
                        spawnParticles(t.x, 1, t.z, 0xffaa00, 4);
                        SoundEngine.punch();
                    }
                } else if (o.type === 'wall') {
                    if (Math.abs(t.z - oZ) < 0.8 && Math.abs(t.x - o.mesh.position.x) < 9.2) {
                        t.dead = true;
                        spawnParticles(t.x, 1, t.z, 0xff3333, 4);
                        SoundEngine.punch();
                    }
                } else if (o.type === 'spike') {
                    if (Math.abs(t.z - oZ) < 3.0 && Math.abs(t.x - o.mesh.position.x) < 6.0) {
                        if (Math.random() < 0.12) {
                            t.dead = true;
                            spawnParticles(t.x, 0.2, t.z, 0xff0000, 6);
                            SoundEngine.hit();
                        }
                    }
                }
            });
        }
    });

    // Update Powerups
    powerups.forEach(p => {
        p.mesh.position.z += effectiveScrollSpeed * dt;
        p.mesh.rotation.y += dt * 2.0;

        let dx = playerCenterX - p.mesh.position.x;
        let dz = 0 - p.mesh.position.z;
        if (!p.collected && dx * dx + dz * dz < (clusterRadius + 1.2) * (clusterRadius + 1.2)) {
            p.collected = true;
            scene.remove(p.mesh);
            spawnParticles(p.mesh.position.x, 1.2, p.mesh.position.z, p.type === 'speed' ? 0x00ffff : p.type === 'shield' ? 0xffaa00 : 0xff00ff, 15);
            SoundEngine.gateGood();

            if (p.type === 'speed') {
                activePowerups.speedTimer = 4.0;
                spawnFloatingText(p.mesh.position.x, 3, p.mesh.position.z, "SPEED BOOST!", "#00ffff");
            } else if (p.type === 'shield') {
                activePowerups.shield = true;
                spawnFloatingText(p.mesh.position.x, 3, p.mesh.position.z, "SHIELD ACTIVE!", "#ffaa00");
            } else if (p.type === 'magnet') {
                activePowerups.magnetTimer = 6.0;
                spawnFloatingText(p.mesh.position.x, 3, p.mesh.position.z, "COIN MAGNET!", "#ff00ff");
            }

            // Quest progression for shield and magnet
            if (p.type === 'shield' || p.type === 'magnet') {
                if (!saveState.questCompleted) {
                    saveState.questProgress = (saveState.questProgress || 0) + 1;
                    if (saveState.questProgress >= 15) {
                        saveState.questCompleted = true;
                        saveState.questProgress = 15;
                        try {
                            const skinsRaw = localStorage.getItem('crowdRunnerSkins');
                            let skins = skinsRaw ? JSON.parse(skinsRaw) : { unlocked: ['cyan'], selected: 'cyan' };
                            if (!skins.unlocked.includes('plasma')) {
                                skins.unlocked.push('plasma');
                                localStorage.setItem('crowdRunnerSkins', JSON.stringify(skins));
                            }
                        } catch (e) {}
                        spawnFloatingText(p.mesh.position.x, 5, p.mesh.position.z, "⚡ LASER SWORDS UNLOCKED! ⚡", "#ff00ff", 5);
                    } else {
                        spawnFloatingText(p.mesh.position.x, 4, p.mesh.position.z, `QUEST: ${saveState.questProgress}/15`, "#00e5ff", 3);
                    }
                    saveGame();
                    updateShopUI();
                }
            }
        }
    });

    coinsList.forEach(c => {
        c.z += effectiveScrollSpeed * dt;

        // Magnet effect
        if (activePowerups.magnetTimer > 0) {
            let dx = playerCenterX - c.x;
            let dz = 0 - c.z;
            let dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 40) {
                c.x += (playerCenterX - c.x) * 10 * dt;
                c.z += (0 - c.z) * 10 * dt;
            }
        }

        let dx = playerCenterX - c.x; let dz = 0 - c.z;
        let baseRadius = clusterRadius + 1.0 + (saveState.upgradeMagnet - 1) * 0.8;
        if (dx * dx + dz * dz < baseRadius * baseRadius) {
            if (!c.collected) {
                c.collected = true; runCoinsCollected++; runCoinsEl.innerText = runCoinsCollected;
                spawnParticles(c.x, 1, c.z, 0xffd700, 5); spawnFloatingText(c.x, 2, c.z, "+1", "#ffd700"); SoundEngine.coin();
                hudCoinFlash();
            }
        }
    });

    // Cleanup offscreen objects
    gates.filter(g => g.mesh.position.z > 20).forEach(g => {
        scene.remove(g.mesh);
        g.mesh.material.map.dispose();
        g.mesh.material.dispose();
    });
    gates = gates.filter(g => g.mesh.position.z <= 20);

    obstacles.filter(o => o.mesh.position.z > 20 || o.hit).forEach(o => {
        scene.remove(o.mesh);
    });
    obstacles = obstacles.filter(o => o.mesh.position.z <= 20 && !o.hit);

    powerups.filter(p => p.mesh.position.z > 20 || p.collected).forEach(p => {
        scene.remove(p.mesh);
    });
    powerups = powerups.filter(p => p.mesh.position.z <= 20 && !p.collected);

    enemies = enemies.filter(e => e.z <= 20 && !e.dead);
    coinsList = coinsList.filter(c => !c.collected && c.z <= 30);
    buildings = buildings.filter(b => b.z <= 100); lakes = lakes.filter(l => l.z <= 100); mountains = mountains.filter(m => m.z <= 100); trees = trees.filter(t => t.z <= 100); animals = animals.filter(a => a.z <= 100);
    streetLights = streetLights.filter(s => s.z <= 10); // Despawn early — beam cones invade camera past z=10

    updateHumanoidMeshes();
    updateEnvironmentMeshes(dt, effectiveScrollSpeed);
    updateCoinsMesh(dt, effectiveScrollSpeed);
    updateParticlesMesh(dt);
    updateTextSprites(dt);

    // ─── NEW VISUAL SYSTEMS ───
    biomeTime += dt;

    // 1. Motion trails — spawn one trail ghost per troop every 4 frames
    if (Math.random() < 0.25) {
        const n = Math.min(troops.length, 60); // cap spawns for perf
        for (let i = 0; i < n; i++) {
            const t = troops[Math.floor(Math.random() * troops.length)];
            if (t.state === 'running') spawnTrail(t.x, t.z, false);
        }
    }
    const activeBossForTrail = enemies.find(e => e.isBoss && !e.dead);
    if (activeBossForTrail) spawnTrail(activeBossForTrail.x, activeBossForTrail.z, true);
    updateTrailMesh(dt);

    // 2. Ambient biome particles
    if (gameState === 'playing' && Math.random() < 0.4) spawnAmbientParticle();
    updateAmbientMesh(dt);

    // 3. Glow auras
    updateGlowSprites(biomeTime);

    // 3b. Night lighting update
    const activeEnemy = enemies.some(e => !e.dead && e.z > -25);
    updateNightLights(currentBiome, timeOfDay, playerCenterX, activeEnemy);

    // 4. Speed lines CSS overlay
    if (speedLinesEl) {
        const hasBoss = !!enemies.find(e => e.isBoss && !e.dead && e.z > -30);
        if (activePowerups.speedTimer > 0) {
            speedLinesEl.classList.remove('boss-danger');
            speedLinesEl.classList.add('active');
        } else if (hasBoss) {
            speedLinesEl.classList.remove('active');
            speedLinesEl.classList.add('boss-danger');
        } else {
            speedLinesEl.classList.remove('active', 'boss-danger');
        }
    }

    // 5. Biome animated shaders
    if (currentBiome === 'lava') {
        // Lava pulse: road emissive and lake glow breathe
        const lavaPulse = 0.7 + Math.sin(biomeTime * 2.5) * 0.4;
        lakeMat.emissiveIntensity = Math.max(0, 1.3 + Math.sin(biomeTime * 2.5) * 0.5);
        bldgMatLava.emissiveIntensity = Math.max(0.5, 1.0 + Math.sin(biomeTime * 1.8) * 0.4);
    } else if (currentBiome === 'neon') {
        // Neon strobe on buildings at 4Hz
        const neonStrobe = Math.sin(biomeTime * 25) > 0.3 ? 0.9 : 0.5;
        bldgMatNeon.emissiveIntensity = neonStrobe;
        lakeMat.emissiveIntensity = 0.5 + Math.sin(biomeTime * 8) * 0.4;
    } else if (currentBiome === 'tundra') {
        // Tundra sparkle: very slow subtle emissive ping
        bldgMatTundra.emissiveIntensity = Math.abs(Math.sin(biomeTime * 0.6)) * 0.15;
    }

    // 6. HUD troop count pop monitoring
    const curTroopCount = troops.length;
    if (curTroopCount !== _lastTroopCount) {
        if (_lastTroopCount > 0) hudTroopPop();
        _lastTroopCount = curTroopCount;
    }

    // 7. Per-biome bloom tuning
    if (Math.floor(biomeTime * 60) % 60 === 0) {
        if (timeOfDay === 'night') {
            if (currentBiome === 'neon' || currentBiome === 'lava') {
                bloomPass.strength = 1.6; bloomPass.threshold = 0.60;
            } else if (currentBiome === 'wasteland') {
                bloomPass.strength = 1.2; bloomPass.threshold = 0.65;
            } else {
                bloomPass.strength = 1.0; bloomPass.threshold = 0.70;
            }
        } else {
            if (currentBiome === 'utopia') {
                bloomPass.strength = 0.5; bloomPass.threshold = 0.90;
            } else {
                bloomPass.strength = 0.8; bloomPass.threshold = 0.85;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2-5: REALISM UPGRADES — Galaxy, Space Creature, Water, Weather
    // ═══════════════════════════════════════════════════════════════════════

    // ─── Galaxy / Nebula System ───────────────────────────────────────────────
    if (typeof updateGalaxy === 'function') updateGalaxy(dt);
    updateCustomSpaceObject(dt);

    // ─── Giant Space Creature ────────────────────────────────────────────────
    if (typeof updateSpaceCreature === 'function') updateSpaceCreature(dt, effectiveScrollSpeed);

    // ─── Volumetric Cloud Layer ──────────────────────────────────────────────
    if (typeof updateClouds === 'function') updateClouds(dt);

    // ─── Weather System ──────────────────────────────────────────────────────
    if (typeof updateWeather === 'function') updateWeather(dt);

    // ─── Tree Wind Sway Animation ────────────────────────────────────────────
    if (typeof updateTreeWind === 'function') updateTreeWind(dt);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: GALAXY & NEBULA SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Galaxy spiral sprite — a large billboard with a procedural galaxy texture
function createGalaxyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Radial gradient background (deep space)
    const bg = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    bg.addColorStop(0, 'rgba(0,0,0,0)');
    bg.addColorStop(0.3, 'rgba(10,5,30,0.3)');
    bg.addColorStop(0.6, 'rgba(30,10,60,0.5)');
    bg.addColorStop(0.8, 'rgba(60,20,100,0.4)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 512);

    // Spiral arms using particles
    for (let i = 0; i < 3000; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 200 + 20;
        const armOffset = Math.sin(radius * 0.05) * 0.8;
        const spiralAngle = angle + radius * 0.02 + armOffset;
        const x = 256 + Math.cos(spiralAngle) * radius;
        const y = 256 + Math.sin(spiralAngle) * radius;
        const dist = Math.sqrt((x - 256) ** 2 + (y - 256) ** 2);
        const alpha = Math.max(0, 1 - dist / 280) * (0.3 + Math.random() * 0.5);
        const hue = 240 + Math.random() * 60 + (dist > 100 ? 20 : -20);
        ctx.fillStyle = `hsla(${hue}, 80%, ${50 + Math.random() * 30}%, ${alpha})`;
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    return new THREE.CanvasTexture(canvas);
}

let galaxySprite = null;
let galaxyTime = 0;

function initGalaxy() {
    if (galaxySprite) return;
    const tex = createGalaxyTexture();
    const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    galaxySprite = new THREE.Sprite(mat);
    galaxySprite.position.set(0, 200, -550);
    galaxySprite.scale.set(350, 250, 1);
    scene.add(galaxySprite);
}

function updateGalaxy(dt) {
    galaxyTime += dt * 0.008;
    if (!galaxySprite) initGalaxy();
    if (timeOfDay === 'night') {
        galaxySprite.visible = true;
        galaxySprite.material.opacity = 0.5 + Math.sin(galaxyTime * 0.5) * 0.15;
        galaxySprite.position.y = 200 + Math.sin(galaxyTime * 0.3) * 15;
    } else {
        galaxySprite.visible = false;
    }
}

// ─── Custom 3D Space Objects System ──────────────────────────────────────────
let customSpaceObject = null;

function updateCustomSpaceObject(dt) {
    const selected = saveState.selectedSpaceObject || 'none';
    
    // If we need to recreate or destroy
    if (customSpaceObject && customSpaceObject.userData.type !== selected) {
        scene.remove(customSpaceObject);
        customSpaceObject = null;
    }
    
    if (selected === 'none') return;
    
    if (!customSpaceObject) {
        const group = new THREE.Group();
        group.userData = { type: selected };
        
        if (selected === 'planet') {
            // Giant Ringed Planet: Sphere + Torus ring
            const planetGeo = new THREE.SphereGeometry(45, 32, 32);
            const planetMat = new THREE.MeshStandardMaterial({
                color: 0xe69d5e,
                roughness: 0.8,
                metalness: 0.1,
                emissive: 0x5a2d0c,
                emissiveIntensity: 0.3
            });
            const planet = new THREE.Mesh(planetGeo, planetMat);
            group.add(planet);
            
            // Ring
            const ringGeo = new THREE.TorusGeometry(75, 4, 2, 40);
            const ringMat = new THREE.MeshStandardMaterial({
                color: 0xd4a373,
                roughness: 0.9,
                transparent: true,
                opacity: 0.75
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2.3;
            ring.rotation.y = Math.PI / 8;
            ring.scale.set(1, 1, 0.05); // flatten it
            group.add(ring);
            
            // Place far in sky
            group.position.set(240, 160, -600);
        } else if (selected === 'station') {
            // Orbiting Space Station: Cylinder hub + large ring
            const stationHubGeo = new THREE.CylinderGeometry(5, 5, 25, 12);
            const stationMat = new THREE.MeshStandardMaterial({
                color: 0xdddddd,
                roughness: 0.2,
                metalness: 0.8
            });
            const hub = new THREE.Mesh(stationHubGeo, stationMat);
            group.add(hub);
            
            // Solar panels (flat boxes)
            const panelGeo = new THREE.BoxGeometry(40, 0.2, 8);
            const panelMat = new THREE.MeshStandardMaterial({ color: 0x004488, emissive: 0x002244, emissiveIntensity: 0.5 });
            const panelsL = new THREE.Mesh(panelGeo, panelMat);
            panelsL.position.set(25, 0, 0);
            group.add(panelsL);
            const panelsR = new THREE.Mesh(panelGeo, panelMat);
            panelsR.position.set(-25, 0, 0);
            group.add(panelsR);
            
            // Place in sky
            group.position.set(-180, 180, -500);
        }
        
        scene.add(group);
        customSpaceObject = group;
    }
    
    // Update space object animation
    if (customSpaceObject) {
        if (selected === 'planet') {
            customSpaceObject.rotation.y += dt * 0.02;
        } else if (selected === 'station') {
            customSpaceObject.rotation.y += dt * 0.08;
            customSpaceObject.rotation.x += dt * 0.03;
        }
        // Slow parallax floating
        customSpaceObject.position.y += Math.sin(performance.now() * 0.0004) * 0.02;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: GIANT SPACE CREATURE
// ═══════════════════════════════════════════════════════════════════════════

// A massive creature that swims across the sky — biome themed
const SPACE_CREATURE_BIOME_TYPES = {
    utopia: { color: 0x88ddff, glow: 0x00aaff, name: 'Cosmic Whale' },
    wasteland: { color: 0xff6633, glow: 0xff2200, name: 'Fire Wyrm' },
    neon: { color: 0xff00ff, glow: 0x8800ff, name: 'Neon Serpent' },
    tundra: { color: 0xccddff, glow: 0x88aaff, name: 'Ice Dragon' },
    lava: { color: 0xff4400, glow: 0xff8800, name: 'Magma Leviathan' },
    dune: { color: 0xffaa00, glow: 0xffcc44, name: 'Sand Kraken' },
    crystal: { color: 0xaa44ff, glow: 0x8800ff, name: 'Prismatic Drake' },
    void: { color: 0x4400aa, glow: 0x6600ff, name: 'Abyssal Horror' }
};

let spaceCreature = null;
let spaceCreatureTimer = 0;
let spaceCreatureActive = false;
let creatureCrossDuration = 20; // seconds to cross the sky

function initSpaceCreature() {
    if (spaceCreature) {
        scene.remove(spaceCreature.group);
        spaceCreature = null;
    }

    const info = SPACE_CREATURE_BIOME_TYPES[currentBiome] || SPACE_CREATURE_BIOME_TYPES.utopia;

    const group = new THREE.Group();

    // Main body — elongated ellipsoid
    const bodyGeo = new THREE.SphereGeometry(1, 12, 8);
    const bodyMat = new THREE.MeshPhysicalMaterial({
        color: info.color, metalness: 0.3, roughness: 0.6,
        emissive: info.glow, emissiveIntensity: 0.5,
        clearcoat: 1.0, clearcoatRoughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(5, 1.2, 1.8);
    group.add(body);

    // Tail — cone
    const tailGeo = new THREE.ConeGeometry(0.8, 3, 6);
    const tailMat = new THREE.MeshPhysicalMaterial({
        color: info.color, emissive: info.glow, emissiveIntensity: 0.3,
        metalness: 0.2, roughness: 0.7
    });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(-3.5, 0, 0);
    tail.rotation.z = 0.3;
    group.add(tail);

    // Wings / fins (two side planes)
    const wingGeo = new THREE.PlaneGeometry(2.5, 1.5);
    const wingMat = new THREE.MeshPhysicalMaterial({
        color: info.color, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
        emissive: info.glow, emissiveIntensity: 0.3,
        metalness: 0.1, roughness: 0.8
    });
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(0.5, 0, 1.8);
    wingL.rotation.x = -0.4;
    group.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(0.5, 0, -1.8);
    wingR.rotation.x = 0.4;
    group.add(wingR);

    // Eye glow
    const eyeGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(2.2, 0.3, 0.5);
    group.add(eye);
    const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
    eye2.position.set(2.2, 0.3, -0.5);
    group.add(eye2);

    // Glow aura sprite
    const glowTex = createGlowTexture(info.glow);
    const auraMat = new THREE.SpriteMaterial({
        map: glowTex, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    const aura = new THREE.Sprite(auraMat);
    aura.scale.set(12, 8, 1);
    group.add(aura);

    // Start position — far left, high up
    group.position.set(-450, 180 + Math.random() * 40, -300 + Math.random() * 100);
    group.scale.setScalar(1.5 + Math.random() * 0.5);

    group.userData = {
        phase: Math.random() * Math.PI * 2,
        wingPhase: 0,
        trailTimer: 0
    };

    scene.add(group);
    spaceCreature = group;
    spaceCreatureActive = true;
}

function updateSpaceCreature(dt, scrollSpeed) {
    spaceCreatureTimer += dt;

    // Only show at night, and not every level
    if (timeOfDay !== 'night') {
        if (spaceCreature && spaceCreature.visible) spaceCreature.visible = false;
        return;
    }

    // Init creature if needed
    if (!spaceCreature) initSpaceCreature();

    if (!spaceCreature) return;
    spaceCreature.visible = true;

    const data = spaceCreature.userData;
    data.wingPhase += dt * 2.5;

    // Move creature across the sky (parallax: slower than scroll speed)
    spaceCreature.position.x += (scrollSpeed * 0.08 + 5) * dt;

    // Slight vertical undulation
    data.phase += dt * 0.7;
    spaceCreature.position.y += Math.sin(data.phase) * 0.3;

    // Bob rotation
    spaceCreature.rotation.z = Math.sin(data.phase * 0.5) * 0.05;
    spaceCreature.rotation.y = Math.sin(data.phase * 0.3) * 0.1;

    // Wing flap animation (scale wings)
    const wingPhase = Math.sin(data.wingPhase) * 0.3;
    if (spaceCreature.children.length > 2) {
        const wL = spaceCreature.children[2];
        const wR = spaceCreature.children[3];
        if (wL && wL.isMesh) {
            wL.rotation.x = -0.4 + wingPhase;
            wR.rotation.x = 0.4 - wingPhase;
        }
    }

    // Particle trail
    data.trailTimer += dt;
    if (data.trailTimer > 0.15 && Math.random() < 0.4) {
        data.trailTimer = 0;
        const tx = spaceCreature.position.x + (Math.random() - 0.5) * 3;
        const ty = spaceCreature.position.y + (Math.random() - 0.5) * 2;
        const tz = spaceCreature.position.z + (Math.random() - 0.5) * 3;
        spawnParticles(tx, ty, tz, 0x88ccff, 2, 4);
    }

    // Reset creature when it goes off screen
    if (spaceCreature.position.x > 500) {
        spaceCreatureActive = false;
        scene.remove(spaceCreature);
        spaceCreature = null;
        spaceCreatureTimer = 0;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: ENHANCED WATER (Reflective Ponds)
// ═══════════════════════════════════════════════════════════════════════════

// We upgrade the lakes mesh to use a reflective material where possible
// For performance, we use a simple animated vertex color approach on the existing lakes

function upgradeLakesReflection() {
    // The existing lakesMesh already uses a semi-transparent blue material.
    // We enhance it with an animated wave effect via the material's emissive
    // and add a ring of greenery sprites around lakes in the spawn function.
}

// ─── Pond Vegetation Ring ──────────────────────────────────────────────────
const MAX_VEGETATION = 200;
const vegGeo = new THREE.PlaneGeometry(0.5, 0.8);
const vegMat = new THREE.MeshBasicMaterial({
    color: 0x33aa44, transparent: true, opacity: 0.8,
    side: THREE.DoubleSide, depthWrite: true
});
const vegMesh = new THREE.InstancedMesh(vegGeo, vegMat, MAX_VEGETATION);
vegMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(vegMesh);
let vegetation = [];
let vegDummy = new THREE.Object3D();

function spawnVegetationAroundLake(lakeX, lakeZ, lakeW, lakeD) {
    const count = Math.floor(Math.random() * 15 + 5);
    for (let i = 0; i < count; i++) {
        if (vegetation.length >= MAX_VEGETATION) break;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.max(lakeW, lakeD) * 0.5 + 2 + Math.random() * 4;
        vegDummy = new THREE.Object3D();
        vegetation.push({
            x: lakeX + Math.cos(angle) * radius,
            z: lakeZ + Math.sin(angle) * radius,
            rot: Math.random() * Math.PI * 2,
            scale: 0.5 + Math.random() * 0.8,
            swayOffset: Math.random() * 10
        });
    }
}

function updateVegetation(dt, effectiveScrollSpeed) {
    const dummy = vegDummy || new THREE.Object3D();
    for (let i = 0; i < MAX_VEGETATION; i++) {
        if (i < vegetation.length) {
            const v = vegetation[i];
            v.z += effectiveScrollSpeed * dt;
            const sway = Math.sin(biomeTime * 2 + v.swayOffset) * 0.15;
            dummy.position.set(v.x, 0.2, v.z);
            dummy.scale.set(v.scale, v.scale, 1);
            dummy.rotation.set(0, v.rot, sway);
            dummy.updateMatrix();
            vegMesh.setMatrixAt(i, dummy.matrix);
        } else {
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            vegMesh.setMatrixAt(i, dummy.matrix);
        }
    }
    vegMesh.instanceMatrix.needsUpdate = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: VOLUMETRIC CLOUDS
// ═══════════════════════════════════════════════════════════════════════════

const MAX_CLOUDS = 60;
const cloudGeo = new THREE.SphereGeometry(1, 6, 6);
const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.5,
    roughness: 0.9, metalness: 0.0
});
const cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, MAX_CLOUDS);
cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(cloudMesh);
let clouds = [];
let cloudDummy = new THREE.Object3D();

function spawnCloud() {
    if (clouds.length >= MAX_CLOUDS) return;
    cloudDummy = new THREE.Object3D();
    const h = Math.random() * 40 + 80;
    clouds.push({
        x: (Math.random() - 0.5) * 800,
        y: h,
        z: -500 - Math.random() * 200,
        scale: 10 + Math.random() * 25,
        speed: 2 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2
    });
}

function updateClouds(dt) {
    if (timeOfDay === 'day' && clouds.length < MAX_CLOUDS && Math.random() < 0.02) spawnCloud();

    const dummy = cloudDummy || new THREE.Object3D();
    for (let i = 0; i < MAX_CLOUDS; i++) {
        if (i < clouds.length) {
            const c = clouds[i];
            c.x += c.speed * dt;
            c.z += 2 * dt;
            if (c.x > 500) c.x = -500;
            if (c.z > 200) c.z = -600;

            const sc = c.scale;
            dummy.position.set(c.x, c.y + Math.sin(biomeTime * 0.3 + c.phase) * 3, c.z);
            dummy.scale.set(sc, sc * 0.4, sc * 0.6);
            dummy.updateMatrix();
            cloudMesh.setMatrixAt(i, dummy.matrix);
            cloudMesh.setColorAt(i, new THREE.Color(timeOfDay === 'day' ? 0xffffff : 0x444466));
        } else {
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            cloudMesh.setMatrixAt(i, dummy.matrix);
        }
    }
    cloudMesh.instanceMatrix.needsUpdate = true;
    if (cloudMesh.instanceColor) cloudMesh.instanceColor.needsUpdate = true;
    clouds = clouds.filter(c => c.z < 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5: WEATHER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

const MAX_RAIN = 800;
const rainGeo = new THREE.BufferGeometry();
const rainPositions = new Float32Array(MAX_RAIN * 3);
for (let i = 0; i < MAX_RAIN; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 50;
    rainPositions[i * 3 + 1] = Math.random() * 30;
    rainPositions[i * 3 + 2] = -Math.random() * 60 - 10;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rainMat = new THREE.PointsMaterial({
    color: 0xaaccff, size: 0.08, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
});
const rainSystem = new THREE.Points(rainGeo, rainMat);
rainSystem.visible = false;
scene.add(rainSystem);

const MAX_SNOW = 500;
const snowGeo = new THREE.BufferGeometry();
const snowPositions = new Float32Array(MAX_SNOW * 3);
for (let i = 0; i < MAX_SNOW; i++) {
    snowPositions[i * 3] = (Math.random() - 0.5) * 60;
    snowPositions[i * 3 + 1] = Math.random() * 25;
    snowPositions[i * 3 + 2] = -Math.random() * 50 - 10;
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
const snowMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.15, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
});
const snowSystem = new THREE.Points(snowGeo, snowMat);
snowSystem.visible = false;
scene.add(snowSystem);

// Ash particles for lava/wasteland
const MAX_ASH = 300;
const ashGeo = new THREE.BufferGeometry();
const ashPositions = new Float32Array(MAX_ASH * 3);
for (let i = 0; i < MAX_ASH; i++) {
    ashPositions[i * 3] = (Math.random() - 0.5) * 60;
    ashPositions[i * 3 + 1] = Math.random() * 20;
    ashPositions[i * 3 + 2] = -Math.random() * 50 - 10;
}
ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
const ashMat = new THREE.PointsMaterial({
    color: 0x444444, size: 0.12, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
});
const ashSystem = new THREE.Points(ashGeo, ashMat);
ashSystem.visible = false;
scene.add(ashSystem);

function updateWeather(dt) {
    // Rain for neon city (always night)
    if (currentBiome === 'neon') {
        rainSystem.visible = true;
        rainSystem.material.opacity = 0.5 + Math.sin(biomeTime * 0.5) * 0.1;
        const pos = rainSystem.geometry.attributes.position;
        for (let i = 0; i < MAX_RAIN; i++) {
            pos.array[i * 3 + 1] -= 15 * dt;
            pos.array[i * 3] += Math.sin(biomeTime + i) * 0.5 * dt;
            if (pos.array[i * 3 + 1] < -2) {
                pos.array[i * 3 + 1] = 25 + Math.random() * 5;
                pos.array[i * 3] = (Math.random() - 0.5) * 50;
                pos.array[i * 3 + 2] = -Math.random() * 60 - 10;
            }
        }
        pos.needsUpdate = true;
        snowSystem.visible = false;
        ashSystem.visible = false;
    }
    // Snow for tundra
    else if (currentBiome === 'tundra') {
        snowSystem.visible = true;
        const spos = snowSystem.geometry.attributes.position;
        for (let i = 0; i < MAX_SNOW; i++) {
            spos.array[i * 3 + 1] -= 4 * dt;
            spos.array[i * 3] += Math.sin(biomeTime * 0.7 + i * 0.1) * 1.5 * dt;
            if (spos.array[i * 3 + 1] < -2) {
                spos.array[i * 3 + 1] = 22 + Math.random() * 3;
                spos.array[i * 3] = (Math.random() - 0.5) * 60;
                spos.array[i * 3 + 2] = -Math.random() * 50 - 10;
            }
        }
        spos.needsUpdate = true;
        rainSystem.visible = false;
        ashSystem.visible = false;
    }
    // Ash for wasteland / lava
    else if (currentBiome === 'wasteland' || currentBiome === 'lava') {
        ashSystem.visible = true;
        const apos = ashSystem.geometry.attributes.position;
        for (let i = 0; i < MAX_ASH; i++) {
            apos.array[i * 3 + 1] -= 8 * dt;
            apos.array[i * 3] += Math.sin(biomeTime + i * 0.3) * 2 * dt;
            if (apos.array[i * 3 + 1] < -2) {
                apos.array[i * 3 + 1] = 18 + Math.random() * 2;
                apos.array[i * 3] = (Math.random() - 0.5) * 60;
                apos.array[i * 3 + 2] = -Math.random() * 50 - 10;
            }
        }
        apos.needsUpdate = true;
        rainSystem.visible = false;
        snowSystem.visible = false;
    }
    // Clear weather for others
    else {
        rainSystem.visible = false;
        snowSystem.visible = false;
        ashSystem.visible = false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: TREE WIND SWAY & IMPROVED FOLIAGE
// ═══════════════════════════════════════════════════════════════════════════

function updateTreeWind(dt) {
    // Apply wind-induced color variation to existing tree materials
    const wind = Math.sin(biomeTime * 1.5) * 0.05 + 0.95;
    // Subtle brightness oscillation simulates wind through leaves
    treeConeMat.color.multiplyScalar(1 + (wind - 0.95) * 0.01);
    treeConeMat.needsUpdate = true;
}

// ─── Level Intro Countdown ───────────────────────────────────────────────────
function showLevelIntro(callback) {
    const info = getBiomeInfo(saveState.level);
    introLevelNum.textContent = saveState.level;
    introBiomeBadge.textContent = info.badge;
    introBiomeBadge.style.background = info.accent;
    introBiomeName.textContent = info.name;
    introBiomeName.style.color = info.accent;
    introDesc.textContent = info.desc;
    introCountdown.textContent = '3';

    startScreen.style.display = 'none';
    levelIntroScreen.style.display = 'flex';
    scoreDisplay.style.display = 'none';

    let count = 3;
    const tick = setInterval(() => {
        count--;
        if (count > 0) {
            introCountdown.textContent = count;
        } else {
            clearInterval(tick);
            introCountdown.textContent = 'GO!';
            introCountdown.style.color = '#00ff88';
            setTimeout(() => {
                levelIntroScreen.style.display = 'none';
                introCountdown.style.color = '';
                callback();
            }, 600);
        }
    }, 1000);
}

// ─── Pause Logic ─────────────────────────────────────────────────────────────
function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    pauseScreen.style.display = 'flex';
}
function resumeGame() {
    if (gameState !== 'paused') return;
    pauseScreen.style.display = 'none';
    gameState = 'playing';
}
function goToMainMenu() {
    stopMusic();
    gameState = 'menu';
    pauseScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    levelIntroScreen.style.display = 'none';
    scoreDisplay.style.display = 'none';
    startScreen.style.display = 'flex';
    updateShopUI();
}

window.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        gameState === 'playing' ? pauseGame() : (gameState === 'paused' ? resumeGame() : null);
    }
});

// ─── Progress Bar update (called from updateGame) ───────────────────────────
function updateProgressBar() {
    const pct = Math.min(100, Math.round((distance / levelLength) * 100));
    progressBarFill.style.width = pct + '%';
    progressLabel.textContent = pct + '%';
    // Swap bar colour near end
    progressBarFill.style.background = pct > 80
        ? 'linear-gradient(90deg, #00ff88, #00cc66)'
        : 'linear-gradient(90deg, #00e5ff, #0077ff)';
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', () => showLevelIntro(initGame));
document.getElementById('pause-btn').addEventListener('click', pauseGame);
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('restart-btn-pause').addEventListener('click', () => { resumeGame(); showLevelIntro(initGame); });
document.getElementById('menu-btn-pause').addEventListener('click', goToMainMenu);
document.getElementById('retry-btn').addEventListener('click', () => { gameOverScreen.style.display = 'none'; showLevelIntro(initGame); });
document.getElementById('menu-btn-gameover').addEventListener('click', goToMainMenu);
document.getElementById('next-level-btn').addEventListener('click', () => {
    levelCompleteScreen.style.display = 'none';
    startScreen.style.display = 'none';
    updateShopUI();
    showLevelIntro(initGame);
});
buyTroopsBtn.addEventListener('click', () => {
    let cost = getUpgradeCost(saveState.upgradeTroops, 'troops');
    if (saveState.coins >= cost) {
        saveState.coins -= cost;
        saveState.upgradeTroops++; saveGame();
    }
});
buyAttackBtn.addEventListener('click', () => {
    let cost = getUpgradeCost(saveState.upgradeAttack, 'attack');
    if (saveState.coins >= cost) {
        saveState.coins -= cost;
        saveState.upgradeAttack++; saveGame();
    }
});
buyMagnetBtn.addEventListener('click', () => {
    let cost = getUpgradeCost(saveState.upgradeMagnet, 'magnet');
    if (saveState.coins >= cost) {
        saveState.coins -= cost;
        saveState.upgradeMagnet++; saveGame();
    }
});

// IAP Shop buttons
document.getElementById('iap-coins-small')?.addEventListener('click', () => purchaseIAP('coins_small'));
document.getElementById('iap-coins-medium')?.addEventListener('click', () => purchaseIAP('coins_medium'));
document.getElementById('iap-coins-large')?.addEventListener('click', () => purchaseIAP('coins_large'));
document.getElementById('iap-remove-ads')?.addEventListener('click', () => purchaseIAP('remove_ads'));

// Custom Sky Shop
document.getElementById('buy-sky-nebula-btn')?.addEventListener('click', () => {
    const isUnlocked = saveState.unlockedSkies.includes('nebula');
    if (!isUnlocked) {
        if (saveState.coins >= 250) {
            saveState.coins -= 250;
            saveState.unlockedSkies.push('nebula');
            saveState.selectedSky = 'nebula';
            saveGame();
            applyBiomeSettings();
            spawnFloatingText(0, 8, -10, "Nebula Sky Unlocked!", "#00e5ff", 3);
        }
    } else {
        if (saveState.selectedSky === 'nebula') {
            saveState.selectedSky = 'default';
        } else {
            saveState.selectedSky = 'nebula';
        }
        saveGame();
        applyBiomeSettings();
    }
});

document.getElementById('buy-sky-supernova-btn')?.addEventListener('click', () => {
    const isUnlocked = saveState.unlockedSkies.includes('supernova');
    if (!isUnlocked) {
        if (saveState.coins >= 400) {
            saveState.coins -= 400;
            saveState.unlockedSkies.push('supernova');
            saveState.selectedSky = 'supernova';
            saveGame();
            applyBiomeSettings();
            spawnFloatingText(0, 8, -10, "Supernova Sky Unlocked!", "#ff5500", 3);
        }
    } else {
        if (saveState.selectedSky === 'supernova') {
            saveState.selectedSky = 'default';
        } else {
            saveState.selectedSky = 'supernova';
        }
        saveGame();
        applyBiomeSettings();
    }
});

// Custom Space Objects Shop (Simulated IAP)
document.getElementById('buy-space-planet-btn')?.addEventListener('click', () => {
    const isUnlocked = saveState.unlockedSpaceObjects.includes('planet');
    if (!isUnlocked) {
        if (confirm("Would you like to purchase the Giant Ringed Planet for $0.99?")) {
            saveState.unlockedSpaceObjects.push('planet');
            saveState.selectedSpaceObject = 'planet';
            saveGame();
            spawnFloatingText(0, 8, -10, "Planet Unlocked!", "#ffd700", 3);
            Analytics.iapPurchase('space_planet', 0.99);
        }
    } else {
        if (saveState.selectedSpaceObject === 'planet') {
            saveState.selectedSpaceObject = 'none';
        } else {
            saveState.selectedSpaceObject = 'planet';
        }
        saveGame();
    }
});

document.getElementById('buy-space-station-btn')?.addEventListener('click', () => {
    const isUnlocked = saveState.unlockedSpaceObjects.includes('station');
    if (!isUnlocked) {
        if (confirm("Would you like to purchase the Orbiting Space Station for $1.99?")) {
            saveState.unlockedSpaceObjects.push('station');
            saveState.selectedSpaceObject = 'station';
            saveGame();
            spawnFloatingText(0, 8, -10, "Space Station Unlocked!", "#ffd700", 3);
            Analytics.iapPurchase('space_station', 1.99);
        }
    } else {
        if (saveState.selectedSpaceObject === 'station') {
            saveState.selectedSpaceObject = 'none';
        } else {
            saveState.selectedSpaceObject = 'station';
        }
        saveGame();
    }
});

// Environment Decor Upgrades
document.getElementById('buy-decor-trees-btn')?.addEventListener('click', () => {
    const lvl = saveState.decorTreesLvl || 0;
    if (lvl >= 5) return;
    const cost = getUpgradeCost(lvl, 'decor_trees');
    if (saveState.coins >= cost) {
        saveState.coins -= cost;
        saveState.decorTreesLvl = lvl + 1;
        saveGame();
        spawnFloatingText(0, 8, -10, `Trees Upgraded to Lv ${lvl + 1}!`, "#00ff88", 3);
    }
});

document.getElementById('buy-decor-ponds-btn')?.addEventListener('click', () => {
    const lvl = saveState.decorPondsLvl || 0;
    if (lvl >= 5) return;
    const cost = getUpgradeCost(lvl, 'decor_ponds');
    if (saveState.coins >= cost) {
        saveState.coins -= cost;
        saveState.decorPondsLvl = lvl + 1;
        saveGame();
        spawnFloatingText(0, 8, -10, `Ponds Upgraded to Lv ${lvl + 1}!`, "#00ff88", 3);
    }
});

document.getElementById('buy-decor-animals-btn')?.addEventListener('click', () => {
    const lvl = saveState.decorAnimalsLvl || 0;
    if (lvl >= 5) return;
    const cost = getUpgradeCost(lvl, 'decor_animals');
    if (saveState.coins >= cost) {
        saveState.coins -= cost;
        saveState.decorAnimalsLvl = lvl + 1;
        saveGame();
        spawnFloatingText(0, 8, -10, `Animals Upgraded to Lv ${lvl + 1}!`, "#00ff88", 3);
    }
});

// ─── WebGL Context Loss Handler ─────────────────────────────────────────────
renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('[CrowdRunner] WebGL context lost');
    if (webglErrorEl) webglErrorEl.style.display = 'flex';
}, false);

renderer.domElement.addEventListener('webglcontextrestored', () => {
    console.log('[CrowdRunner] WebGL context restored');
    if (webglErrorEl) webglErrorEl.style.display = 'none';
}, false);

// ─── Android Back Button ────────────────────────────────────────────────
// Pause if playing; if paused or game over, go to main menu
document.addEventListener('backbutton', (e) => {
    e.preventDefault();
    if (gameState === 'playing') pauseGame();
    else if (gameState === 'paused' || gameState === 'gameover' || gameState === 'levelcomplete') goToMainMenu();
}, false);

// ─── SoundEngine Mute Support ───────────────────────────────────────────
// Override SoundEngine to check mute state
const origPlayTone = SoundEngine.playTone;
SoundEngine.playTone = function (freq, type, duration, vol = 0.1) {
    if (isMuted) return;
    // Reduce volume slightly when system says muted
    origPlayTone.call(this, freq, type, duration, vol * 0.8);
};

// ─── Loading Sequence ────────────────────────────────────────────────────
// Start loading steps, hide loading screen when Three.js is ready
updateLoading(30, 'Initializing 3D engine...');

// After Three.js setup completes (we're at end of file, everything is initialized)
updateLoading(70, 'Loading game assets...');

// Small delay so user sees the loading screen (especially important on fast devices)
window.requestAnimationFrame(() => {
    setTimeout(() => {
        updateLoading(100, 'Ready!');
        setTimeout(() => {
            if (loadingScreen) loadingScreen.style.display = 'none';
            // Show tutorial on first play
            showTutorial();
        }, 300);
    }, 200);
});

// ─── Daily Rewards System ────────────────────────────────────────────────
const DAILY_KEY = 'crowdRunnerDaily';
const DAILY_STREAK_KEY = 'crowdRunnerDailyStreak';
const DAILY_REWARDS = [50, 75, 100, 150, 200, 300, 500]; // week cycle
const DAILY_BONUS_KEY = 'crowdRunnerDailyBonusShown';

function getDailyStreak() {
    try { return parseInt(localStorage.getItem(DAILY_STREAK_KEY) || '0'); } catch (e) { return 0; }
}
function setDailyStreak(v) { try { localStorage.setItem(DAILY_STREAK_KEY, v); } catch (e) { } }

function checkDailyReward() {
    try {
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const last = localStorage.getItem(DAILY_KEY);
        let streak = getDailyStreak();
        if (!last || last !== yesterday) streak = 0;
        if (last === today) return 0;
        streak = Math.min(streak + 1, DAILY_REWARDS.length);
        setDailyStreak(streak);
        localStorage.setItem(DAILY_KEY, today);
        const reward = DAILY_REWARDS[(streak - 1) % DAILY_REWARDS.length];
        saveState.coins += reward; saveGame();
        return { reward, streak };
    } catch (e) { return 0; }
}

function renderDailyGrid() {
    const grid = document.getElementById('daily-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const streak = getDailyStreak();
    for (let i = 0; i < 7; i++) {
        const day = i + 1;
        const claimed = day < streak;
        const isToday = day === streak + 1;
        const reward = DAILY_REWARDS[i];
        const cell = document.createElement('div');
        cell.style.cssText = `background:${claimed ? 'rgba(0,255,136,0.15)' : isToday ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.06)'};border:1px solid ${claimed ? 'rgba(0,255,136,0.4)' : isToday ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.1)'};border-radius:12px;padding:10px 6px;text-align:center;`;
        cell.innerHTML = `<div style="font-size:11px;color:rgba(255,255,255,0.5);">Day ${day}</div><div style="font-size:18px;margin:4px 0;">${claimed ? '✅' : isToday ? '🎁' : '🪙'}</div><div style="font-size:12px;font-weight:700;color:${claimed ? '#00ff88' : isToday ? '#ffd700' : '#fff'};">${reward}</div>`;
        grid.appendChild(cell);
    }
    const claimDay = document.getElementById('claim-day-num');
    if (claimDay) claimDay.textContent = Math.min(streak + 1, 7);
    const streakText = document.getElementById('daily-streak-text');
    if (streakText) streakText.textContent = `Day ${Math.min(streak + 1, 7)} of 7 — tap to claim`;
}

document.getElementById('daily-reward-banner')?.addEventListener('click', () => {
    renderDailyGrid();
    document.getElementById('daily-reward-overlay').style.display = 'flex';
});
document.getElementById('claim-daily-btn')?.addEventListener('click', () => {
    const result = checkDailyReward();
    if (result && result.reward) {
        spawnFloatingText(0, 8, -10, `+${result.reward} coins`, '#ffd700', 3);
        SoundEngine.victory();
        renderDailyGrid();
        updateShopUI();
        setTimeout(() => document.getElementById('daily-reward-overlay').style.display = 'none', 600);
    } else {
        alert('Already claimed today! Come back tomorrow.');
    }
});

// ─── Battle Pass System ──────────────────────────────────────────────────
const BPASS_KEY = 'crowdRunnerBattlePass';
const BPASS_SEASON = 1;
const BPASS_XP_PER_LEVEL = 500;
const BPASS_LEVELS = 30;
const BPASS_REWARDS_FREE = [50, 75, 100, 150, 200, 250, 300, 400, 500, 600];
const BPASS_REWARDS_PREMIUM = [200, 400, 600, 800, 1000, 1500, 2000, 2500, 3000, 4000];

function loadBattlePass() {
    try {
        const raw = localStorage.getItem(BPASS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { }
    return { season: BPASS_SEASON, xp: 0, level: 1, purchased: false, freeClaimed: [], premiumClaimed: [] };
}
function saveBattlePass(bp) { try { localStorage.setItem(BPASS_KEY, JSON.stringify(bp)); } catch (e) { } }
function addBattlePassXP(amount) {
    const bp = loadBattlePass();
    if (bp.season !== BPASS_SEASON) { bp.season = BPASS_SEASON; bp.xp = 0; bp.level = 1; bp.freeClaimed = []; bp.premiumClaimed = []; }
    bp.xp += amount;
    const newLevel = Math.min(1 + Math.floor(bp.xp / BPASS_XP_PER_LEVEL), BPASS_LEVELS);
    if (newLevel > bp.level) {
        bp.level = newLevel;
        spawnFloatingText(0, 10, -10, `Battle Pass Lv${newLevel}!`, '#ffd700', 4);
        SoundEngine.victory();
    }
    saveBattlePass(bp);
    updateBattlePassUI();
}
function updateBattlePassUI() {
    const bp = loadBattlePass();
    const xpEl = document.getElementById('bpass-xp');
    const barEl = document.getElementById('bpass-xp-bar');
    if (xpEl) xpEl.textContent = bp.xp;
    if (barEl) {
        const pct = Math.min(100, ((bp.xp % BPASS_XP_PER_LEVEL) / BPASS_XP_PER_LEVEL) * 100);
        barEl.style.width = pct + '%';
    }
}
document.getElementById('buy-battle-pass')?.addEventListener('click', () => {
    const bp = loadBattlePass();
    if (bp.purchased) { alert('Battle Pass already purchased this season!'); return; }
    if (saveState.coins < 499) { alert('Not enough coins. Need 499 coins.'); return; }
    saveState.coins -= 499;
    bp.purchased = true;
    saveBattlePass(bp); saveGame(); updateShopUI(); updateBattlePassUI();
    spawnFloatingText(0, 8, -10, 'Battle Pass Unlocked!', '#ffd700', 4);
    SoundEngine.victory();
});

// Grant XP on level complete
function grantBattlePassXP(amount) { addBattlePassXP(amount); }

// ─── Event System ────────────────────────────────────────────────────────
const EVENT_KEY = 'crowdRunnerEvent';
function loadEvent() {
    try {
        const raw = localStorage.getItem(EVENT_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { }
    return { active: true, name: 'Weekend Frenzy', end: Date.now() + 48 * 3600 * 1000, multiplier: 2.0 };
}
function saveEvent(e) { try { localStorage.setItem(EVENT_KEY, JSON.stringify(e)); } catch (e) { } }
function getEventMultiplier() {
    const ev = loadEvent();
    if (!ev.active || Date.now() > ev.end) return 1.0;
    return ev.multiplier;
}
function updateEventTimer() {
    const ev = loadEvent();
    const el = document.getElementById('event-timer-text');
    if (!el) return;
    const diff = Math.max(0, ev.end - Date.now());
    const d = Math.floor(diff / 86400000); const h = Math.floor((diff % 86400000) / 3600000); const m = Math.floor((diff % 3600000) / 60000);
    el.textContent = `Ends in ${d}d ${h}h ${m}m`;
    if (diff === 0) { ev.active = false; saveEvent(ev); }
}
setInterval(updateEventTimer, 60000);
updateEventTimer();

// ─── Leaderboard System ──────────────────────────────────────────────────
const LB_KEY = 'crowdRunnerLeaderboard';
function loadLeaderboard() {
    try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch (e) { return []; }
}
function saveLeaderboard(lb) { try { localStorage.setItem(LB_KEY, JSON.stringify(lb)); } catch (e) { } }
function submitScore(score) {
    const lb = loadLeaderboard();
    const entry = { score, level: saveState.level, date: Date.now() };
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    const trimmed = lb.slice(0, 20);
    saveLeaderboard(trimmed);
    return trimmed;
}
function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    const lb = loadLeaderboard();
    list.innerHTML = '';
    if (lb.length === 0) { list.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.4);text-align:center;">No scores yet. Play a level!</div>'; return; }
    lb.forEach((e, i) => {
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.style.background = 'rgba(255,255,255,0.04)';
        row.style.border = '1px solid rgba(255,255,255,0.08)';
        row.style.borderRadius = '10px';
        row.style.padding = '10px';
        row.innerHTML = `<div class="shop-info"><span class="shop-name">#${i + 1} — Lv ${e.level}</span><span class="shop-level">${e.score} pts • ${new Date(e.date).toLocaleDateString()}</span></div>`;
        list.appendChild(row);
    });
}
document.getElementById('clear-leaderboard-btn')?.addEventListener('click', () => {
    if (confirm('Clear all leaderboard scores?')) { saveLeaderboard([]); renderLeaderboard(); }
});

// ─── Rewarded Ad Stubs ───────────────────────────────────────────────────
function showRewardedAd(rewardType) {
    console.log('[CrowdRunner] Show rewarded ad for:', rewardType);
    alert('Rewarded ad would play here.\n\n(Integrate AdMob/AdManager SDK in production.)');
    // Example reward grants:
    if (rewardType === 'coins') {
        const bonus = 100 * getEventMultiplier();
        saveState.coins += Math.floor(bonus);
        saveGame(); updateShopUI();
        spawnFloatingText(0, 8, -10, `+${Math.floor(bonus)} coins (Ad)`, '#00ffff', 3);
    } else if (rewardType === 'revive') {
        if (gameState === 'gameover') {
            troops.push({ x: playerCenterX, z: 0, offsetX: 0, offsetZ: 0, state: 'running', animOffset: Math.random() * 10, fightTimer: 0, color: new THREE.Color(0x00e5ff) });
            gameState = 'playing';
            gameOverScreen.style.display = 'none';
            scoreDisplay.style.display = 'flex';
        }
    }
}

// ─── Analytics Event Stubs ───────────────────────────────────────────────
const Analytics = {
    event(name, params) { console.log('[Analytics]', name, params); },
    levelStart(lvl) { this.event('level_start', { level: lvl }); },
    levelComplete(lvl, survivors) { this.event('level_complete', { level: lvl, survivors }); },
    iapPurchase(productId, price) { this.event('iap_purchase', { productId, price }); },
    adWatched(adType) { this.event('ad_watched', { type: adType }); },
};

// Hook into existing game flows for analytics
const _origInit = initGame;
initGame = function () {
    Analytics.levelStart(saveState.level);
    _origInit();
};
const _origVictory = () => { };
// Track level complete via level complete button
document.getElementById('next-level-btn')?.addEventListener('click', () => {
    Analytics.levelComplete(saveState.level - 1, troops.length);
    // Bonus XP for battle pass
    grantBattlePassXP(50 * getEventMultiplier());
});

// Track IAP purchases
['iap-coins-small', 'iap-coins-medium', 'iap-coins-large', 'iap-value-pack', 'iap-remove-ads', 'buy-battle-pass'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
        const btn = document.getElementById(id);
        const price = btn?.textContent?.trim() || '$';
        Analytics.iapPurchase(id, price);
    });
});

function animate(timestamp) {
    requestAnimationFrame(animate);
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.1);
    updateGame(dt);
    composer.render();
}

// ─── Start the loop ──────────────────────────────────────────────────────
loadSave();

// Apply daily reward when game starts
const dailyResult = checkDailyReward();
if (dailyResult && dailyResult.reward) console.log('[CrowdRunner] Daily login bonus: ' + dailyResult.reward + ' coins!');

renderDailyGrid();
updateBattlePassUI();
renderLeaderboard();
animate();
