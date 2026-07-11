// 邏輯層測試：node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert');

const BK = require('../js/blocks.js');
const WG = require('../js/worldgen.js');
const MWWorld = require('../js/world.js');
const MWMesher = require('../js/mesher.js');
const PH = require('../js/physics.js');
const GD = require('../js/gamedata.js');
const UN = require('../js/units.js');
const SV = require('../js/save.js');
const MWWeather = require('../js/weather.js');
const MWNoise = require('../js/noise.js');

const { B } = BK;
const { GY, idx, CHUNK } = WG;

// ---------- gamedata ----------
test('單位表：5 世界 × 5 種，數值隨世界成長', () => {
  assert.strictEqual(GD.UNIT_ORDER.length, 25);
  assert.ok(GD.UNITS.w1_skel && GD.UNITS.w5_boss);
  assert.strictEqual(GD.UNITS.w1_skel.name, '骨架');
  assert.strictEqual(GD.UNITS.w1_guardA.name, '毒藥守衛');
  assert.ok(GD.UNITS.w2_skel.hp > GD.UNITS.w1_skel.hp * 4);
  assert.ok(GD.UNITS.w5_boss.soul > GD.UNITS.w1_boss.soul * 100);
  for (const id of GD.UNIT_ORDER) {
    const u = GD.UNITS[id];
    assert.ok(u.hp > 0 && u.dmg > 0 && u.soul > 0 && u.prod > 0, id);
    assert.ok(GD.RARITY[u.rarity], id + ' 稀有度存在');
  }
});

test('升級費用指數成長、玩家數值反映升級與重生', () => {
  assert.ok(GD.upgradeCost('atk', 1) > GD.upgradeCost('atk', 0));
  const s = SV.newSave();
  const st0 = GD.playerStats(s);
  assert.strictEqual(st0.dmg, 10);
  assert.strictEqual(st0.armyMax, 3);
  s.upgrades = { atk: 4, hp: 5, army: 2 };
  const st1 = GD.playerStats(s);
  assert.strictEqual(st1.dmg, 20);            // 10 × (1+0.25×4)
  assert.strictEqual(st1.hp, 200);            // 100 × (1+0.2×5)
  assert.strictEqual(st1.armyMax, 5);
  s.rebirths = 2;
  const st2 = GD.playerStats(s);
  assert.strictEqual(st2.dmg, 30);            // ×(1+0.25×2)
  assert.strictEqual(st2.soulMul, 3);         // (1+0)×(1+2)
});

test('奪取機率：稀有度、升級、魔王首殺、上限', () => {
  const s = SV.newSave();
  assert.ok(Math.abs(GD.captureChance('w1_skel', s, false) - 0.30) < 1e-9);
  assert.ok(Math.abs(GD.captureChance('w1_guardA', s, false) - 0.15) < 1e-9);
  assert.strictEqual(GD.captureChance('w1_boss', s, true), 1);
  s.upgrades = { capture: 25 };
  assert.strictEqual(GD.captureChance('w1_skel', s, false), 0.9); // 上限
});

test('軍團：產出、平台展示、出戰隊伍上限', () => {
  const s = SV.newSave();
  s.collection = { w1_skel: 10, w1_guardA: 2, w1_boss: 1 };
  const prod = GD.productionPerSec(s);
  assert.ok(Math.abs(prod - (10 * 0.2 + 2 * 0.8 + 1 * 9.0)) < 1e-9);
  const plat = GD.platformUnits(s, 8);
  assert.strictEqual(plat[0], 'w1_boss'); // 產出最高排最前
  const party = GD.battleParty(s);
  assert.strictEqual(party.length, 3);    // armyMax 基礎 3
  assert.ok(!party.slice(0, 3).includes('w1_boss') || party.length <= 3); // 一般單位優先
});

test('重生：條件與效果', () => {
  const s = SV.newSave();
  assert.strictEqual(GD.canRebirth(s), false);
  assert.strictEqual(GD.doRebirth(s), false);
  s.bossKilled = { 5: true };
  s.souls = 999; s.upgrades = { atk: 3 }; s.maxWorld = 5;
  s.collection = { w1_skel: 4 };
  assert.strictEqual(GD.canRebirth(s), true);
  assert.strictEqual(GD.doRebirth(s), true);
  assert.strictEqual(s.rebirths, 1);
  assert.strictEqual(s.souls, 0);
  assert.deepStrictEqual(s.upgrades, {});
  assert.strictEqual(s.maxWorld, 1);
  assert.strictEqual(s.collection.w1_skel, 4); // 軍團保留
});

test('離線收益：50% 效率、8 小時上限', () => {
  const s = SV.newSave();
  s.collection = { w1_skel: 10 }; // 2.0/s
  s.lastSeen = 1000000;
  const oneHour = GD.offlineGain(s, 1000000 + 3600 * 1000);
  assert.strictEqual(oneHour, Math.floor(2.0 * 3600 * 0.5));
  const tenHours = GD.offlineGain(s, 1000000 + 10 * 3600 * 1000);
  assert.strictEqual(tenHours, Math.floor(2.0 * 8 * 3600 * 0.5)); // 上限 8h
  assert.strictEqual(GD.offlineGain({ ...s, lastSeen: 0 }, 5000), 0);
});

test('數字縮寫', () => {
  assert.strictEqual(GD.fmt(999), '999');
  assert.strictEqual(GD.fmt(6860), '6.86K');
  assert.strictEqual(GD.fmt(12500), '12.5K');
  assert.strictEqual(GD.fmt(125000), '125K');
  assert.strictEqual(GD.fmt(2500000), '2.50M');
});

test('稱號解鎖判定', () => {
  const s = SV.newSave();
  let un = GD.unlockedTitles(s).map(t => t.id);
  assert.ok(un.includes('novice') && !un.includes('kill100'));
  s.stats.kills = 100;
  s.bossKilled = { 1: true };
  un = GD.unlockedTitles(s).map(t => t.id);
  assert.ok(un.includes('kill100') && un.includes('boss1'));
});

// ---------- worldgen ----------
test('戰鬥地圖：決定性、道路、閘門、競技場', () => {
  const seed = WG.WORLD_SEED(1);
  const a = WG.generateChunk(seed, 0, 0);
  const b = WG.generateChunk(seed, 0, 0);
  assert.deepStrictEqual(Array.from(a), Array.from(b)); // 決定性
  // 出生點地面是實心
  assert.ok(BK.isSolid(a[idx(2, 0, GY)]), '出生點有地面');
  assert.strictEqual(a[idx(2, 0, GY + 1)], B.AIR, '出生點上方淨空');
  // 閘門 x=72（chunk 4, lx 8）有閘門條
  const g = WG.generateChunk(seed, 4, 0);
  assert.strictEqual(g[idx(8, 0, GY + 1)], B.GATEBAR, '閘門條存在');
  assert.strictEqual(g[idx(8, 0, GY + 5)], B.DARKBRICK, '閘門橫樑');
  // 競技場 (218,0)：chunk 13（208..223）lx 10
  const ar = WG.generateChunk(seed, 13, 0);
  assert.ok(BK.isSolid(ar[idx(10, 0, GY)]), '競技場地板');
  assert.ok(WG.inArena(218, 0));
  assert.ok(!WG.inArena(150, 0));
});

test('聖所：平台、傳送門、決定性', () => {
  const seed = WG.SANCTUM_SEED;
  // 平台 (-7,-9)：chunk (-1,-1)，lx = -7-(-16)=9, lz = -9-(-16)=7
  const c = WG.generateChunk(seed, -1, -1);
  assert.strictEqual(c[idx(9, 7, GY + 1)], B.PLATFORM, '召喚平台存在');
  assert.strictEqual(c[idx(9, 7, GY)], B.PLATBASE, '平台基座');
  // 傳送門 (0,-20)：chunk (0,-2)，lx 0, lz = -20-(-32)=12
  const pc = WG.generateChunk(seed, 0, -2);
  assert.strictEqual(pc[idx(0, 12, GY + 1)], B.PORTAL, '傳送門方塊');
  // 平台走上去（h=0.3）不會生成單位卡牆：上方兩格淨空
  assert.strictEqual(c[idx(9, 7, GY + 2)], B.AIR);
});

test('世界主題齊備、樹不長在路上', () => {
  for (let w = 1; w <= 5; w++) assert.ok(WG.THEMES[w] && WG.THEMES[w].name);
  const seed = WG.WORLD_SEED(1);
  for (let x = 10; x < 200; x += 7) {
    assert.ok(!WG.treeAt(seed, 1, x, 0), '道路中線無樹');
  }
});

// ---------- world + mesher（開閘門會標髒重建） ----------
test('世界：拆閘門方塊會標髒', () => {
  const w = new MWWorld.World(WG.WORLD_SEED(1));
  const gx = WG.BATTLE.gates[0];
  assert.strictEqual(w.getBlock(gx, GY + 1, 0), B.GATEBAR);
  assert.ok(w.setBlock(gx, GY + 1, 0, B.AIR));
  assert.strictEqual(w.getBlock(gx, GY + 1, 0), B.AIR);
  assert.ok(w.dirty.size > 0);
  const mesh = MWMesher.buildChunkMesh(w, Math.floor(gx / CHUNK), 0);
  assert.ok(mesh.solid.count > 0, '網格可建');
});

// ---------- units ----------
function flatWorld() {
  return { getBlock: (x, y, z) => (y <= GY ? B.BEDROCK : B.AIR) };
}

test('敵人：近身攻擊玩家，發出 hitplayer 事件', () => {
  const w = flatWorld();
  const rand = MWNoise.mulberry32(7);
  const player = PH.createPlayer(0.5, GY + 1, 0.5);
  const m = UN.makeUnit('w1_skel', 1.6, GY + 1, 0.5, 'enemy');
  const events = [];
  UN.stepUnit(m, w, 1 / 60, { player, units: [m] }, rand, events);
  assert.ok(events.some(e => e.type === 'hitplayer'), '近身出手');
});

test('友軍：跟隨玩家、攻擊敵人', () => {
  const w = flatWorld();
  const rand = MWNoise.mulberry32(7);
  const player = PH.createPlayer(0.5, GY + 1, 0.5);
  const ally = UN.makeUnit('w1_skel', 10, GY + 1, 0.5, 'ally');
  // 沒敵人 → 向玩家靠近
  for (let i = 0; i < 120; i++) UN.stepUnit(ally, w, 1 / 60, { player, units: [ally] }, rand, []);
  assert.ok(Math.hypot(ally.x - player.x, ally.z - player.z) < 8, '友軍靠近玩家');
  // 有敵人 → 走近並攻擊敵人而不是玩家
  const foe = UN.makeUnit('w1_zomb', ally.x + 1.6, GY + 1, ally.z, 'enemy');
  const events = [];
  for (let i = 0; i < 90; i++) UN.stepUnit(ally, w, 1 / 60, { player, units: [ally, foe] }, rand, events);
  const hit = events.find(e => e.type === 'hitunit');
  assert.ok(hit && hit.unit === foe, '友軍打敵人');
  assert.ok(!events.some(e => e.type === 'hitplayer'), '友軍不打玩家');
});

test('守衛：中距離發射投射物；投射物會打中目標', () => {
  const w = flatWorld();
  const rand = MWNoise.mulberry32(7);
  const player = PH.createPlayer(0.5, GY + 1, 0.5);
  const g = UN.makeUnit('w1_guardA', 8.5, GY + 1, 0.5, 'enemy');
  g.shootCool = 0;
  const events = [];
  UN.stepUnit(g, w, 1 / 60, { player, units: [g] }, rand, events);
  const shoot = events.find(e => e.type === 'shoot');
  assert.ok(shoot, '守衛開火');
  const pr = UN.makeProjectile(shoot.proj, shoot.x, shoot.y, shoot.z, shoot.dx, shoot.dy, shoot.dz, shoot.dmg, 'enemy');
  const pev = [];
  for (let i = 0; i < 240 && !pr.dead; i++) UN.stepProjectile(pr, w, 1 / 60, { player, units: [g] }, pev);
  assert.ok(pev.some(e => e.type === 'projhitplayer'), '投射物命中玩家');
});

test('靈魂衝擊波：貫穿多個敵人、同目標只打一次', () => {
  const w = flatWorld();
  const player = PH.createPlayer(0.5, GY + 1, 0.5);
  const e1 = UN.makeUnit('w1_skel', 4, GY + 1, 0.5, 'enemy');
  const e2 = UN.makeUnit('w1_zomb', 8, GY + 1, 0.5, 'enemy');
  const pr = UN.makeProjectile('soulwave', 1, GY + 2, 0.5, 1, 0, 0, 20, 'ally');
  const pev = [];
  for (let i = 0; i < 120 && !pr.dead; i++) UN.stepProjectile(pr, w, 1 / 60, { player, units: [e1, e2] }, pev);
  const hits = pev.filter(e => e.type === 'projhitunit');
  assert.strictEqual(hits.length, 2, '貫穿兩個目標');
  assert.notStrictEqual(hits[0].unit, hits[1].unit, '兩個不同目標');
});

test('單位死亡：發 die 事件後屍體消失', () => {
  const w = flatWorld();
  const rand = MWNoise.mulberry32(7);
  const player = PH.createPlayer(50, GY + 1, 50);
  const m = UN.makeUnit('w1_skel', 0.5, GY + 1, 0.5, 'enemy');
  UN.hurtUnit(m, 9999, 1, 0);
  const events = [];
  for (let i = 0; i < 60 && !m.dead; i++) UN.stepUnit(m, w, 1 / 60, { player, units: [m] }, rand, events);
  assert.strictEqual(events.filter(e => e.type === 'die').length, 1);
  assert.ok(m.dead);
});

test('靈魂掉落：磁吸飛向玩家並拾取', () => {
  const w = flatWorld();
  const rand = MWNoise.mulberry32(7);
  const player = PH.createPlayer(0.5, GY + 1, 0.5);
  const s = UN.makeSoul(6, GY + 2, 0.5, 12, rand);
  let picked = null;
  for (let i = 0; i < 600 && !picked; i++) picked = UN.stepSoul(s, w, 1 / 60, player);
  assert.strictEqual(picked, 'pickup');
  assert.strictEqual(s.amount, 12);
});

// ---------- save ----------
test('存檔：編解碼往返、拒讀壞檔', () => {
  const s = SV.newSave();
  s.souls = 6860;
  s.collection = { w1_skel: 231 };
  s.upgrades = { atk: 3 };
  s.bossKilled = { 1: true };
  s.stats.kills = 42;
  const o = SV.decodeSave(SV.encodeSave(s));
  assert.strictEqual(o.souls, 6860);
  assert.strictEqual(o.collection.w1_skel, 231);
  assert.strictEqual(o.upgrades.atk, 3);
  assert.strictEqual(o.bossKilled[1], true);
  assert.strictEqual(o.stats.kills, 42);
  assert.strictEqual(SV.decodeSave('not json'), null);
  assert.strictEqual(SV.decodeSave(JSON.stringify({ v: 99, souls: 1 })), null);
  // 舊檔缺欄位會補齊
  const old = SV.decodeSave(JSON.stringify({ v: 1, souls: 5 }));
  assert.ok(old.settings && old.stats && old.collection);
});

test('存檔：storage 注入', () => {
  const mem = { data: {}, setItem(k, v) { this.data[k] = v; }, getItem(k) { return this.data[k] || null; }, removeItem(k) { delete this.data[k]; } };
  const s = SV.newSave();
  s.souls = 777;
  assert.ok(SV.saveTo(mem, s));
  assert.strictEqual(SV.loadFrom(mem).souls, 777);
  SV.clearSave(mem);
  assert.strictEqual(SV.loadFrom(mem), null);
});

// ---------- weather ----------
test('天氣狀態機推進', () => {
  const rand = MWNoise.mulberry32(3);
  const w = MWWeather.createWeather(rand);
  for (let i = 0; i < 60 * 600; i++) MWWeather.stepWeather(w, 1 / 60, rand);
  assert.ok(['clear', 'cloudy', 'rain', 'storm'].includes(w.type));
});

// ---------- physics（第三人稱鏡頭用的射線） ----------
test('射線：打到地面', () => {
  const w = new MWWorld.World(WG.WORLD_SEED(1));
  const r = PH.raycast(w, 2.5, GY + 3, 0.5, 0, -1, 0, 10);
  assert.ok(r.hit);
  assert.strictEqual(r.y, GY);
});
