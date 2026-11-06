// tuning.js — every tunable number in the game, named, so it can be changed without touching other files.

// Movement and the golem
export const moveSpeed = 14;         // metres per second (bigger arena needs faster movement)
export const playerHP = 100;
export const playerRadius = 0.6;

// Firing
export const fireRate = 4;           // shots per second
export const projectileSpeed = 40;   // metres per second
export const projectileDamage = 25;
export const projectileRange = 70;   // metres before the shot expires
export const projectileRadius = 0.35;

// Enemies
export const enemySpeed = 4.0;       // faster across the bigger floor
export const enemyHP = 50;
export const enemyRadius = 0.7;
export const contactDamage = 10;
export const contactCooldown = 0.8;  // seconds between contact hits on the golem
export const contactPushDistance = 1.2;   // how far the player is knocked back on contact
export const contactPushEnemy = 0.6;      // how far the enemy is knocked back on contact

// Enemy roles
export const enemyRoleWeights = { brawler: 0.45, archer: 0.20, mage: 0.15, healer: 0.20 };
export const brawlerModelScale = 1.0;   // scale for Flow Studio fire/earth brawler models
export const archerModelScale = 1.0;    // scale for Flow Studio water archer model
export const mageModelScale = 1.1;      // scale for Flow Studio water mage model

// Archer
export const archerSpeed = 2.8;
export const archerPreferredRange = 18;   // tries to stay this far from the golem
export const archerRangeTolerance = 4;    // within this band it stops backing up
export const archerFireRate = 1.2;        // shots per second
export const archerProjectileSpeed = 22;
export const archerProjectileDamage = 8;
export const archerProjectileRadius = 0.3;
export const archerProjectileRange = 35;

// Mage
export const mageSpeed = 2.4;
export const magePreferredRange = 22;     // hangs back farther than archers
export const mageRangeTolerance = 5;
export const mageFireRate = 0.7;          // slower, heavier shots
export const mageProjectileSpeed = 16;
export const mageProjectileDamage = 15;
export const mageProjectileRadius = 0.7;
export const mageProjectileRange = 30;
export const mageBlastRadius = 4;         // splash radius on hit (visual + damage)

// Healer
export const healerSpeed = 2.2;
export const healerPreferredRange = 24;   // stays far back
export const healerRangeTolerance = 5;
export const healerHealRange = 18;
export const healerHealAmount = 15;
export const healerHealRate = 0.5;        // heals per second
export const healerModelScale = 1.0;

// Enemy personalities
export const personalityWeights = { grunt: 0.5, leader: 0.15, hero: 0.15, coward: 0.2 };
export const leaderAuraRadius = 12;       // nearby allies are spurred on
export const leaderSpeedMul = 1.25;
export const heroHpMul = 1.5;
export const heroSpeedMul = 1.3;
export const cowardFleeHpRatio = 0.4;     // below this HP a coward runs away
export const arrowTurnSpeed = 4.0;      // radians per second when rotating with arrow keys

// Waves
export const spawnInterval = 2.5;    // seconds of quiet before the next wave
export const waveSize = 8;           // enemies in wave 1
export const waveGrowth = 4;         // extra enemies per floor (used from M2)
export const wavesPerFloor = 3;      // how many waves before descending to the next floor

// Spawning
export const spawnMargin = 5;          // extra distance outside the camera view to spawn
export const minSpawnDistance = 28;    // minimum distance from player to spawn
export const spawnIndicatorSize = 16;  // px
export const spawnIndicatorDuration = 1.5; // seconds the arrow stays on screen
export const spawnIndicatorColor = '#f2f2f2';

// Floor — 4x larger area: half-extent doubled from 20 to 40
export const arenaSize = 40;
export const columnCount = 14;
export const columnRadius = 1.5;
export const columnMinDistanceFromPlayer = 12;
export const wallHeight = 4;
export const wallThickness = 1.5;
export const internalWallCount = 4;
export const internalWallLength = 18;
export const internalWallThickness = 1.8;

// Elements
export const elementTypes = ['fire', 'water', 'earth'];
export const elementColors = {
  fire: '#e74c3c',   // warm red-orange
  water: '#3498db',  // cool blue
  earth: '#8e44ad',  // stone purple / brownish
};

// Per-element projectile behaviour
export const fireProjectileSpeed = 35;   // fast bolt
export const waterProjectileSpeed = 28;  // piercing beam
export const earthProjectileSpeed = 18;  // heavy slow blast
export const earthProjectileScale = 2.0; // bigger projectile
export const waterPierceCount = 3;       // how many enemies a water shot passes through

// Element fields
export const elementFieldCount = 2;      // fields spawned per floor
export const elementFieldRadius = 1.8;
export const enemyElementDropChance = 0.25; // chance an enemy drops a field on death

// Per-element tempo modifiers (multipliers)
export const elementMoveSpeedMul = {
  fire: 1.0,
  water: 1.25,   // water feels flowing and mobile
  earth: 0.75,   // earth feels heavy
};

export const elementFireRateMul = {
  fire: 1.0,     // fast
  water: 0.8,    // steady
  earth: 0.55,   // slow, heavy shots
};

export const elementRotationSpeedMul = {
  fire: 1.2,     // snappy
  water: 1.0,    // normal
  earth: 0.6,    // heavy and slow to turn
};

// Alternate-fire abilities (one per element)
export const abilityCooldown = { fire: 5, water: 5, earth: 6 }; // seconds
export const fireGrenadeSpeed = 12;
export const fireGrenadeFuse = 1.2;         // seconds until explosion if it doesn't hit first
export const fireGrenadeBlastRadius = 6;
export const fireGrenadeDamage = 40;
export const waterWaveSpeed = 18;
export const waterWaveWidth = 8;            // across the front of the wave
export const waterWaveRange = 20;           // how far the wave travels
export const waterWaveDamage = 15;
export const waterWaveKnockback = 8;        // metres per second push
export const earthquakeRadius = 14;
export const earthquakeDamage = 30;
export const earthquakeKnockback = 10;
export const earthquakeDuration = 0.5;      // seconds for the shockwave to expand

// Elemental status effects
export const burnDamagePerSecond = 5;      // fire damage over time
export const burnDuration = 3;             // seconds
export const waterSpeedBoostMul = 1.35;    // temporary move-speed boost
export const waterSpeedBoostDuration = 2;  // seconds
export const earthSlowChance = 0.25;       // chance earth attacks slow
export const earthSlowMul = 0.5;           // speed multiplier while slowed
export const earthSlowDuration = 2;        // seconds

// FX timing
export const muzzleFlashDuration = 0.06;
export const trailSpawnInterval = 0.04;  // seconds between trail dots
export const burstParticleCount = 12;
export const burstLifetime = 0.35;
export const screenShakeAmount = 0.25;
export const screenShakeDecay = 5;

// Camera
export const cameraHeight = 14;          // zoomed in half
export const cameraDistance = 11;        // zoomed in half
export const cameraFollowSpeed = 8;      // lerp speed
export const cameraAngle = Math.PI / 4;  // 45 degrees around the golem

// Enemy health bar
export const enemyHealthBarWidth = 40;   // pixels
export const enemyHealthBarHeight = 5;   // pixels
export const enemyHealthBarYOffset = 28; // pixels above enemy centre on screen
export const enemyHealthBarColor = '#e74c3c';
export const enemyHealthBarBg = '#333333';

// XP / level-up meta progression
export const xpBase = 100;               // XP to reach level 2
export const xpGrowth = 1.25;            // multiply xpToNext each level
export const xpValues = {                // XP awarded on kill
  brawler: 10,
  archer: 14,
  mage: 18,
  healer: 20,
  heroMul: 1.5,
};
export const levelUpChoices = 3;         // how many upgrade cards to offer
export const upgradeOptions = [
  { key: 'damage', label: '+10% Shot Damage', mul: 1.10 },
  { key: 'speed', label: '+10% Move Speed', mul: 1.10 },
  { key: 'maxHp', label: '+10% Max HP', mul: 1.10 },
  { key: 'fireRate', label: '+10% Fire Rate', mul: 1.10 },
];

// Item drops
export const itemDropChance = 0.05;      // chance an enemy drops an item on death
export const itemDuration = 10;          // seconds temporary buffs last
