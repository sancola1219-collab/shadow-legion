// 遊戲資料 — 純邏輯，node 可測。
// 單位表（5 世界 × 5 種）、稀有度、經濟數值、商店升級、重生、稱號。
'use strict';
(function () { // IIFE：避免傳統 script 頂層 const 撞名

// ---- 稀有度 ----
const RARITY = {
  common:    { name: '常見', color: '#9ab0c8', capture: 0.30, prodBase: 0.2 },
  rare:      { name: '稀有', color: '#4aa8ff', capture: 0.15, prodBase: 0.8 },
  epic:      { name: '史詩', color: '#b45aff', capture: 0.06, prodBase: 2.2 },
  legendary: { name: '傳說', color: '#ffd24a', capture: 0.10, prodBase: 9.0 }, // 魔王首殺必得，之後 10%
};

// ---- 世界 ----
const WORLDS = {
  1: { name: '陰影墓園', sky: 'dusk' },
  2: { name: '冰霜墓地', sky: 'ice' },
  3: { name: '熔岩要塞', sky: 'ember' },
  4: { name: '毒霧沼澤', sky: 'toxic' },
  5: { name: '虛空王座', sky: 'void' },
};
const WORLD_COUNT = 5;
const STAT_MUL = 6;   // 每升一個世界，敵人數值 ×6
const SOUL_MUL = 6;   // 每升一個世界，靈魂獎勵 ×6
const PROD_MUL = 4;   // 每升一個世界，產出/秒 ×4

// ---- 單位原型（W1 基準值；skin 為 render 模型鍵） ----
const ARCHETYPES = {
  skel:   { rarity: 'common', hp: 22, dmg: 3, speed: 2.5, soul: 6, skin: 'skel' },
  zomb:   { rarity: 'common', hp: 34, dmg: 4, speed: 2.0, soul: 9, skin: 'zomb' },
  guardA: { rarity: 'rare', hp: 80, dmg: 6, speed: 2.2, soul: 28, skin: 'guardA', proj: 'orbA', scale: 1.12 },
  guardB: { rarity: 'epic', hp: 130, dmg: 9, speed: 2.2, soul: 55, skin: 'guardB', proj: 'orbB', scale: 1.18 },
  boss:   { rarity: 'legendary', hp: 1000, dmg: 16, speed: 2.7, soul: 650, skin: 'boss', proj: 'orbBoss', scale: 1.9, boss: true },
};

// 每世界的單位命名（原創）
const UNIT_NAMES = {
  1: { skel: '骨架', zomb: '殭屍', guardA: '毒藥守衛', guardB: '閃電守衛', boss: '骸骨領主' },
  2: { skel: '冰骨架', zomb: '雪殭屍', guardA: '冰霜守衛', guardB: '暴雪守衛', boss: '冰霜君王' },
  3: { skel: '熔岩骷髏', zomb: '焦炎殭屍', guardA: '烈焰守衛', guardB: '熔核守衛', boss: '炎獄魔王' },
  4: { skel: '沼澤骷髏', zomb: '腐沼殭屍', guardA: '劇毒守衛', guardB: '瘴氣守衛', boss: '毒沼霸主' },
  5: { skel: '虛空骷髏', zomb: '暗影殭屍', guardA: '虛空守衛', guardB: '星辰守衛', boss: '虛空皇帝' },
};

// 攤平成單位表：id 'w1_skel' ...
const UNITS = {};
const UNIT_ORDER = []; // 索引圖鑑順序
for (let w = 1; w <= WORLD_COUNT; w++) {
  for (const arch of ['skel', 'zomb', 'guardA', 'guardB', 'boss']) {
    const a = ARCHETYPES[arch];
    const m = Math.pow(STAT_MUL, w - 1);
    const id = 'w' + w + '_' + arch;
    UNITS[id] = {
      id, world: w, arch,
      name: UNIT_NAMES[w][arch],
      rarity: a.rarity,
      hp: Math.round(a.hp * m),
      dmg: Math.round(a.dmg * m),
      speed: a.speed,
      soul: Math.round(a.soul * Math.pow(SOUL_MUL, w - 1)),
      prod: +(RARITY[a.rarity].prodBase * Math.pow(PROD_MUL, w - 1)).toFixed(2), // 靈魂/s
      skin: a.skin, proj: a.proj || null, scale: a.scale || 1, boss: !!a.boss,
    };
    UNIT_ORDER.push(id);
  }
}

// ---- 區域 ----
// 每世界三個區域＋魔王。need：擊殺數；pool：出沒單位（arch）；max：同時在場上限。
const ZONES = [
  { need: 8, pool: ['skel', 'skel', 'zomb'], max: 4 },
  { need: 10, pool: ['skel', 'zomb', 'zomb', 'guardA'], max: 5 },
  { need: 12, pool: ['skel', 'zomb', 'guardA', 'guardB'], max: 5 },
];
const BOSS_ADDS = { pool: ['skel'], max: 2 }; // 魔王戰的小怪

// ---- 玩家與商店 ----
const PLAYER_BASE = { hp: 100, dmg: 10, speed: 1.0 };
const UPGRADES = {
  atk:     { name: '攻擊力', desc: '玩家攻擊 +25%', icon: '⚔', base: 100, growth: 1.7, max: 60, bonus: 0.25 },
  hp:      { name: '生命值', desc: '玩家生命 +20%', icon: '❤', base: 80, growth: 1.7, max: 60, bonus: 0.20 },
  capture: { name: '奪取率', desc: '奪取機率 +12%', icon: '👻', base: 150, growth: 1.8, max: 25, bonus: 0.12 },
  army:    { name: '軍團人數', desc: '出戰影子 +1（上限 8）', icon: '🛡', base: 500, growth: 4.0, max: 5, bonus: 1 },
  soul:    { name: '靈魂加成', desc: '靈魂獲得 +15%', icon: '🔥', base: 200, growth: 1.75, max: 60, bonus: 0.15 },
};
const ARMY_BASE = 3; // 出戰影子基礎數

function upgradeCost(key, level) {
  const u = UPGRADES[key];
  return Math.round(u.base * Math.pow(u.growth, level));
}

// ---- 玩家有效數值（依升級與重生） ----
function playerStats(save) {
  const up = save.upgrades || {};
  const R = save.rebirths || 0;
  return {
    hp: Math.round(PLAYER_BASE.hp * (1 + UPGRADES.hp.bonus * (up.hp || 0))),
    dmg: Math.round(PLAYER_BASE.dmg * (1 + UPGRADES.atk.bonus * (up.atk || 0)) * (1 + 0.25 * R)),
    armyMax: ARMY_BASE + (up.army || 0),
    soulMul: (1 + UPGRADES.soul.bonus * (up.soul || 0)) * (1 + R),
    captureMul: 1 + UPGRADES.capture.bonus * (up.capture || 0),
  };
}

// 奪取機率（bossFirst＝該世界魔王首殺）
function captureChance(unitId, save, bossFirst) {
  const u = UNITS[unitId];
  if (!u) return 0;
  if (u.boss && bossFirst) return 1;
  const c = RARITY[u.rarity].capture * playerStats(save).captureMul;
  return Math.min(0.9, c);
}

// ---- 重生 ----
// 條件：打敗 W5 魔王。效果：重置靈魂/升級/世界進度，保留圖鑑軍團；
// 每次重生 靈魂獲得 +100%、攻擊 +25%。
function canRebirth(save) { return !!(save.bossKilled && save.bossKilled[5]); }
function doRebirth(save) {
  if (!canRebirth(save)) return false;
  save.rebirths = (save.rebirths || 0) + 1;
  save.souls = 0;
  save.upgrades = {};
  save.maxWorld = 1;
  save.bossKilled = {};
  return true;
}

// ---- 稱號 ----
const TITLES = [
  { id: 'novice', name: '初出茅廬', desc: '踏上旅程', check: () => true },
  { id: 'soul1k', name: '靈魂新星', desc: '累積獲得 1,000 靈魂', check: (s) => (s.stats.soulsEarned || 0) >= 1000 },
  { id: 'kill100', name: '骷髏剋星', desc: '擊殺 100 個敵人', check: (s) => (s.stats.kills || 0) >= 100 },
  { id: 'cap10', name: '奪魂者', desc: '奪取 10 個影子', check: (s) => (s.stats.captures || 0) >= 10 },
  { id: 'army50', name: '軍團統帥', desc: '軍團收藏達 50 隻', check: (s) => collectionSize(s) >= 50 },
  { id: 'boss1', name: '屠魔者', desc: '擊敗第一個魔王', check: (s) => Object.keys(s.bossKilled || {}).length > 0 },
  { id: 'w3', name: '深淵行者', desc: '解鎖第三世界', check: (s) => (s.maxWorld || 1) >= 3 },
  { id: 'w5boss', name: '虛空征服者', desc: '擊敗虛空皇帝', check: (s) => !!(s.bossKilled && s.bossKilled[5]) },
  { id: 'reborn', name: '重生者', desc: '完成一次重生', check: (s) => (s.rebirths || 0) >= 1 },
];
function unlockedTitles(save) { return TITLES.filter(t => t.check(save)); }

// ---- 軍團 ----
function collectionSize(save) {
  let n = 0;
  for (const k in (save.collection || {})) n += save.collection[k];
  return n;
}
// 全收藏的靈魂產出（/s）
function productionPerSec(save) {
  let p = 0;
  for (const k in (save.collection || {})) {
    const u = UNITS[k];
    if (u) p += u.prod * save.collection[k];
  }
  return p;
}
// 聖所平台展示：取收藏中最強（產出最高）的前 n 種
function platformUnits(save, n) {
  const owned = Object.keys(save.collection || {}).filter(k => save.collection[k] > 0 && UNITS[k]);
  owned.sort((a, b) => UNITS[b].prod - UNITS[a].prod);
  return owned.slice(0, n);
}
// 出戰隊伍：預設取最強 armyMax 種（可之後做手動編隊）
function battleParty(save) {
  const st = playerStats(save);
  const owned = Object.keys(save.collection || {}).filter(k => save.collection[k] > 0 && UNITS[k] && !UNITS[k].boss);
  owned.sort((a, b) => (UNITS[b].hp * UNITS[b].dmg) - (UNITS[a].hp * UNITS[a].dmg));
  const party = [];
  for (const k of owned) {
    const take = Math.min(save.collection[k], st.armyMax - party.length);
    for (let i = 0; i < take; i++) party.push(k);
    if (party.length >= st.armyMax) break;
  }
  // 魔王影子最後補位（強力但每種限 1）
  if (party.length < st.armyMax) {
    for (const k of Object.keys(save.collection || {})) {
      if (UNITS[k] && UNITS[k].boss && save.collection[k] > 0 && party.length < st.armyMax) party.push(k);
    }
  }
  return party;
}

// 離線收益：50% 效率、上限 8 小時
function offlineGain(save, nowMs) {
  if (!save.lastSeen) return 0;
  const sec = Math.min(8 * 3600, Math.max(0, (nowMs - save.lastSeen) / 1000));
  if (sec < 30) return 0;
  return Math.floor(productionPerSec(save) * sec * 0.5 * playerStats(save).soulMul);
}

// ---- 數字縮寫 ----
function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [v, s] of units) {
    if (n >= v) {
      const x = n / v;
      return (x >= 100 ? Math.floor(x) : x.toFixed(x >= 10 ? 1 : 2)) + s;
    }
  }
  return String(n);
}

const SLData = {
  RARITY, WORLDS, WORLD_COUNT, STAT_MUL, SOUL_MUL, PROD_MUL,
  ARCHETYPES, UNITS, UNIT_ORDER, ZONES, BOSS_ADDS,
  PLAYER_BASE, UPGRADES, ARMY_BASE, upgradeCost, playerStats, captureChance,
  canRebirth, doRebirth, TITLES, unlockedTitles,
  collectionSize, productionPerSec, platformUnits, battleParty, offlineGain, fmt,
};
if (typeof module !== 'undefined') module.exports = SLData;
if (typeof window !== 'undefined') window.SLData = SLData;
})();
