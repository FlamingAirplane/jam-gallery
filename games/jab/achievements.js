// achievements.js — simple in-run achievements that unlock passive bonuses.

export const ACHIEVEMENTS = [
  {
    id: 'first_blood',
    label: 'First Blood',
    desc: 'Kill your first enemy.',
    check: (s) => s.totalKills >= 1,
    reward: { key: 'damage', mul: 1.05 },
  },
  {
    id: 'brawler_basher',
    label: 'Brawler Basher',
    desc: 'Kill 10 brawlers.',
    check: (s) => s.brawlerKills >= 10,
    reward: { key: 'damage', mul: 1.05 },
  },
  {
    id: 'mage_hunter',
    label: 'Mage Hunter',
    desc: 'Kill 5 mages.',
    check: (s) => s.mageKills >= 5,
    reward: { key: 'fireRate', mul: 1.05 },
  },
  {
    id: 'healer_hunter',
    label: 'Healer Hunter',
    desc: 'Kill 3 healers.',
    check: (s) => s.healerKills >= 3,
    reward: { key: 'speed', mul: 1.05 },
  },
  {
    id: 'hero_slayer',
    label: 'Hero Slayer',
    desc: 'Kill 5 hero enemies.',
    check: (s) => s.heroKills >= 5,
    reward: { key: 'damage', mul: 1.10 },
  },
  {
    id: 'floor_dweller',
    label: 'Floor Dweller',
    desc: 'Reach floor 3.',
    check: (s) => s.floorReached >= 3,
    reward: { key: 'maxHp', mul: 1.10 },
  },
];

export function createStats() {
  return {
    totalKills: 0,
    brawlerKills: 0,
    archerKills: 0,
    mageKills: 0,
    healerKills: 0,
    heroKills: 0,
    floorReached: 1,
    unlocked: new Set(),
  };
}

export function recordKill(stats, enemy) {
  stats.totalKills += 1;
  if (enemy.role === 'brawler') stats.brawlerKills += 1;
  if (enemy.role === 'archer') stats.archerKills += 1;
  if (enemy.role === 'mage') stats.mageKills += 1;
  if (enemy.role === 'healer') stats.healerKills += 1;
  if (enemy.personality === 'hero') stats.heroKills += 1;
}

export function recordFloor(stats, floor) {
  stats.floorReached = Math.max(stats.floorReached, floor);
}

export function checkAchievements(stats) {
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (stats.unlocked.has(ach.id)) continue;
    if (ach.check(stats)) {
      stats.unlocked.add(ach.id);
      newlyUnlocked.push(ach);
    }
  }
  return newlyUnlocked;
}
