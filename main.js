import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

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

// --- Game Tuning Constants ---
const SCROLL_SPEED_BASE = 40;    // World units per second (base run speed)
const SCROLL_SPEED_FIGHT = 0.2;   // Multiplier applied when troops are fighting
const MAX_CROWD = 1000;  // Hard cap on total player troops
const TROOP_FIGHT_INTERVAL = 0.5;   // Seconds between each troop attack
const TROOP_DEATH_CHANCE = 0.2;   // Probability a troop dies per attack
const LEVEL_BASE_LENGTH = 400;   // Base distance units per level (was 500)
const LEVEL_LENGTH_SCALE = 80;    // Extra distance added per level number (was 100)
const SEPARATION_NEIGHBORS = 60;    // Max neighbors checked in separation (caps O(n²) to O(n·60))
const SEPARATION_SKIP_RAND = 0.3;   // Per-frame probability to skip sep. for a troop (perf relief)
const GATE_SPAWN_INTERVAL = 80;    // Distance units between obstacle spawns
const BONUS_COINS_RATIO = 0.5;   // Surviving-troop multiplier for end-of-level bonus coins

// --- Difficulty Curve Helpers ---
function getBossSpawnChance(level) {
    // Bosses become more common at higher levels: 80% at level 1, 40% at level 20+
    return Math.max(0.4, 0.8 - (level - 1) * 0.02);
}
function getEnemyBaseHp(level) {
    // Enemies get tougher: 2 HP at level 1, 12 HP at level 20
    return 2 + Math.floor(level * 0.5);
}
function getBossHp(level) {
    // Boss HP scales smoothly: 90 at level 1, 850 at level 20
    return 50 + 40 * level;
}
function getEnemyCount(level) {
    // More enemies at higher levels: 3 at level 1, 23 at level 20
    return Math.floor(Math.random() * 5) + 3 + level;
}
function getGateAddValue(level) {
    // Gate bonuses scale with level: 5-25 at level 1, 11-31 at level 20
    return Math.floor(Math.random() * 20) + 5 + Math.floor(level * 0.3);
}
function getGateSubValue(level) {
    // Penalty gates also scale: 3-10 at level 1, 3-30 at level 20
    return Math.floor(Math.random() * 8) + 3 + Math.floor(level * 0.5);
}
function getCoinSpawnCount(level) {
    // More coins per spawn at higher levels: 8 at level 1, 28 at level 20
    return 8 + level;
}
function getBonusCoinMultiplier(level) {
    // Bonus coins scale with level: 0.5x at level 1, 2.5x at level 20
    return 0.5 + level * 0.1;
}

// --- Meta-Game State ---
const SAVE_KEY = 'crowdRunnerSave2';
const DEFAULT_SAVE = { coins: 0, upgradeTroops: 1, upgradeAttack: 1, upgradeMagnet: 1, level: 1 };
let saveState = { ...DEFAULT_SAVE };

function validateSave(data) {
    // Guard against corrupted or manually-edited localStorage
    if (typeof data !== 'object' || data === null) return false;
    if (typeof data.coins !== 'number' || data.coins < 0) return false;
    if (typeof data.upgradeTroops !== 'number' || data.upgradeTroops < 1) return false;
    if (typeof data.upgradeAttack !== 'number' || data.upgradeAttack < 1) return false;
    if (typeof data.upgradeMagnet !== 'number' || data.upgradeMagnet < 1) return false;
    if (typeof data.level !== 'number' || data.level < 1) return false;
    return true;
}

function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            // Backward compatibility: fill defaults for missing upgrade attributes
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
    updateShopUI();
}
function saveGame() { localStorage.setItem(SAVE_KEY, JSON.stringify(saveState)); updateShopUI(); }

function getUpgradeCost(level, type) {
    if (type === 'attack') return level * 15;
    if (type === 'magnet') return level * 12;
    return level * 10; // default for troops
}

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
    // Dynamic settings based on level (5-biome cycle)
    const biomeCycle = ['utopia', 'wasteland', 'neon', 'tundra', 'lava'];
    const timeCycle = ['day', 'night', 'night', 'day', 'night'];
    const index = (saveState.level - 1) % 5;

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
    if (lakes.length < MAX_LAKES && Math.random() < 0.04) {
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
    if (trees.length < MAX_TREES && Math.random() < 0.3) {
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

// We split meshes by alliance (Troops vs Enemies/Boss) to give them high-quality custom textures and glossiness
const headMeshT = new THREE.InstancedMesh(headGeo, troopMaterial, MAX_HUMANS);
const bodyMeshT = new THREE.InstancedMesh(bodyGeo, troopMaterial, MAX_HUMANS);
const lArmMeshT = new THREE.InstancedMesh(armGeo, troopMaterial, MAX_HUMANS);
const rArmMeshT = new THREE.InstancedMesh(armGeo, troopMaterial, MAX_HUMANS);
const lLegMeshT = new THREE.InstancedMesh(legGeo, troopMaterial, MAX_HUMANS);
const rLegMeshT = new THREE.InstancedMesh(legGeo, troopMaterial, MAX_HUMANS);

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
    const dummy = new THREE.Object3D();
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

    troops = []; gates.forEach(g => {
        scene.remove(g.mesh);
        g.mesh.material.map.dispose();
        g.mesh.material.dispose();
        // Note: do NOT dispose g.mesh.geometry — it's the shared cachedGateGeo
    }); gates = []; textSprites.forEach(t => scene.remove(t.sprite)); textSprites = [];
    if (finishLineMesh) { scene.remove(finishLineMesh); finishLineMesh = null; }
    enemies = []; particles = []; coinsList = [];
    buildings = []; lakes = []; mountains = []; trees = []; streetLights = [];
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
    for (let i = 0; i < startCount; i++) {
        let col = new THREE.Color().setHSL(0.5 + (Math.random() - 0.5) * 0.15, 0.95, 0.5);
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
                    t.fightTimer = 0;
                    let dmg = 1 + (saveState.upgradeAttack - 1) * 0.5;
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
                    if (Math.random() < finalDeathChance) { t.dead = true; spawnParticles(t.x, 1, t.z, 0xff3333, 5); }

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
            if (r < 0.35) spawnGates();
            else if (r < 0.55) spawnEnemies();
            else if (r < 0.70) spawnObstacle();
            else if (r < 0.82) spawnPowerup();
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
    buildings = buildings.filter(b => b.z <= 100); lakes = lakes.filter(l => l.z <= 100); mountains = mountains.filter(m => m.z <= 100); trees = trees.filter(t => t.z <= 100);
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
            // Night: lower threshold so troop/enemy emissive halos bloom more
            if (currentBiome === 'neon' || currentBiome === 'lava') {
                bloomPass.strength = 1.6; bloomPass.threshold = 0.60;
            } else if (currentBiome === 'wasteland') {
                bloomPass.strength = 1.2; bloomPass.threshold = 0.65;
            } else {
                bloomPass.strength = 1.0; bloomPass.threshold = 0.70;
            }
        } else {
            // Day: conservative bloom
            if (currentBiome === 'utopia') {
                bloomPass.strength = 0.5; bloomPass.threshold = 0.90;
            } else {
                bloomPass.strength = 0.8; bloomPass.threshold = 0.85;
            }
        }
    }
}

function animate(timestamp) {
    requestAnimationFrame(animate);
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.1);
    updateGame(dt);
    composer.render();
}

// ─── Level Intro Countdown ───────────────────────────────────────────────────
const BIOME_INFO = [
    { name: 'Utopia Day', badge: 'UTOPIA', accent: '#00e5ff', desc: 'Build your army through the golden city gates.', nextName: 'Wasteland Night' },
    { name: 'Wasteland Night', badge: 'WASTELAND', accent: '#ff4422', desc: 'Survive the ruins. The enemies are stronger here.', nextName: 'Neon City Night' },
    { name: 'Neon City Night', badge: 'NEON CITY', accent: '#ff00ff', desc: 'Slick cyberpunk speedway. Watch your corners.', nextName: 'Arctic Tundra' },
    { name: 'Arctic Tundra', badge: 'TUNDRA', accent: '#aaddff', desc: 'Battle through freezing snow and icy winds.', nextName: 'Lava Fields' },
    { name: 'Lava Fields', badge: 'LAVA FIELDS', accent: '#ff4500', desc: 'Avoid boiling lava pools and ash clouds.', nextName: 'Utopia Day' }
];

function getBiomeInfo(level) {
    // Cycle through 5 biomes
    return BIOME_INFO[(level - 1) % 5];
}

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

// ─── Level Complete star rating ───────────────────────────────────────────────
function getStarRating(survivorCount) {
    if (survivorCount >= 50) return '⭐⭐⭐';
    if (survivorCount >= 20) return '⭐⭐';
    return '⭐';
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
const DAILY_REWARD = 50; // bonus coins per day

function checkDailyReward() {
    try {
        const raw = localStorage.getItem(DAILY_KEY);
        const today = new Date().toDateString();
        if (!raw || raw !== today) {
            // First play today — grant reward
            localStorage.setItem(DAILY_KEY, today);
            saveState.coins += DAILY_REWARD;
            saveGame();
            return DAILY_REWARD;
        }
    } catch (e) { /* localStorage unavailable */ }
    return 0;
}

// Apply daily reward when game starts
const dailyBonus = checkDailyReward();
if (dailyBonus > 0) {
    console.log('[CrowdRunner] Daily login bonus: ' + dailyBonus + ' coins!');
}

// ─── Start the loop ──────────────────────────────────────────────────────
loadSave(); animate();
