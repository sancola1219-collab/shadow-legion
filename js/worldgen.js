// 場景式地圖生成 — 純邏輯，node 可測。
// seed 即場景 id：2000＝聖所；1001..1005＝戰鬥世界 W1..W5。
// 決定性：任何 (seed, 世界座標) 永遠產生同一結果，跨區塊一致。
'use strict';
(function () { // IIFE：避免傳統 script 頂層 const 撞名

const N = (typeof module !== 'undefined') ? require('./noise.js') : window.MWNoise;
const BK = (typeof module !== 'undefined') ? require('./blocks.js') : window.MWBlocks;
const { B } = BK;

const CHUNK = 16;      // 區塊邊長
const WORLD_H = 48;    // 世界高度
const SEA = 0;         // 本作無水（world.js 介面保留）
const GY = 8;          // 地面高度（最上層地面方塊的 y）

const SANCTUM_SEED = 2000;
const WORLD_SEED = (w) => 1000 + w; // w = 1..5

function idx(x, z, y) { return ((x << 4) | z) * WORLD_H + y; } // x,z 為區塊內 0..15

function sceneFor(seed) {
  if (seed === SANCTUM_SEED) return { kind: 'sanctum' };
  if (seed > 1000 && seed <= 1005) return { kind: 'battle', w: seed - 1000 };
  return { kind: 'battle', w: 1 };
}

// ---- 世界主題（地面/樹葉/裝飾/魔王區地板） ----
const THEMES = {
  1: { ground: B.GRASS, path: B.PATH, leaf: B.LEAF_ORANGE, deco: [B.GRAVE, B.GRAVE2, B.DEADBUSH], arena: B.PLAZA2, name: '陰影墓園' },
  2: { ground: B.SNOW, path: B.ICE, leaf: B.LEAF_SNOW, deco: [B.GRAVE, B.GRAVE2, B.DEADBUSH], arena: B.ICE, name: '冰霜墓地' },
  3: { ground: B.CHAR, path: B.BASALT, leaf: null, deco: [B.LAVA, B.SKULLROCK, B.DEADBUSH], arena: B.BASALT, name: '熔岩要塞' },
  4: { ground: B.BOG, path: B.MUD, leaf: B.LEAF_GREEN, deco: [B.MUSHROOM, B.GRAVE2, B.MUSHROOM], arena: B.MUD, name: '毒霧沼澤' },
  5: { ground: B.VOID, path: B.VOIDBRICK, leaf: B.LEAF_PURPLE, deco: [B.STAR, B.SKULLROCK, B.STAR], arena: B.VOIDBRICK, name: '虛空王座' },
};

// ---- 戰鬥世界佈局（單位：世界座標） ----
// 道路沿 +x；z=0 為中線。三個區域＋魔王競技場。
const BATTLE = {
  spawn: [2.5, GY + 1.05, 0.5],       // 玩家出生
  pathHalf: 8,                         // 可走廊道半寬（柵欄在 ±9）
  zones: [                             // [起點x, 終點x]（敵人活動範圍）
    [14, 70], [76, 130], [136, 190],
  ],
  gates: [72, 132, 192],               // 閘門（拆 GATEBAR 開門）
  arena: { cx: 218, cz: 0, r: 20 },    // 魔王競技場（圓形）
  bossAt: [218, GY + 1.05, 0],
  xMin: -6, xMax: 244,
};

// ---- 聖所佈局 ----
const SANCTUM = {
  spawn: [0.5, GY + 1.05, 15.5],
  half: 24,                            // 廣場半寬（x、z 各 ±24）
  portal: { x: 0, z: -20 },            // 閘口傳送門（北側）
  // 8 座召喚平台：走道（x=0）兩側各 4 座
  platforms: [
    [-7, -9], [-7, -3], [-7, 3], [-7, 9],
    [7, -9], [7, -3], [7, 3], [7, 9],
  ],
  shopAt: [14, 14],                    // 商店鐵砧檯
  indexAt: [-14, 14],                  // 索引檯
};

// ---- 生成一個區塊 ----
function generateChunk(seed, cx, cz) {
  const data = new Uint8Array(CHUNK * CHUNK * WORLD_H);
  const scene = sceneFor(seed);
  const baseX = cx * CHUNK, baseZ = cz * CHUNK;
  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const wx = baseX + lx, wz = baseZ + lz;
      if (scene.kind === 'sanctum') genSanctumColumn(seed, wx, wz, data, lx, lz);
      else genBattleColumn(seed, scene.w, wx, wz, data, lx, lz);
    }
  }
  // 樹木（跨區塊決定性）
  if (scene.kind === 'battle') {
    const th = THEMES[scene.w];
    if (th.leaf) {
      for (let wx = baseX - 3; wx < baseX + CHUNK + 3; wx++) {
        for (let wz = baseZ - 3; wz < baseZ + CHUNK + 3; wz++) {
          if (treeAt(seed, scene.w, wx, wz)) stampTree(seed, th, wx, wz, data, baseX, baseZ);
        }
      }
    }
  }
  return data;
}

function put(data, baseX, baseZ, wx, y, wz, id, onlyAir) {
  const lx = wx - baseX, lz = wz - baseZ;
  if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= WORLD_H) return;
  const i = idx(lx, lz, y);
  if (onlyAir && data[i] !== B.AIR) return;
  data[i] = id;
}

// ---- 聖所 ----
function genSanctumColumn(seed, wx, wz, data, lx, lz) {
  const S = SANCTUM.half;
  const inPlaza = Math.abs(wx) <= S && Math.abs(wz) <= S;
  const inApron = Math.abs(wx) <= S + 4 && Math.abs(wz) <= S + 4;
  if (!inApron) return; // 廣場外＝虛空（浮空聖島）

  const col = (y, id) => { data[idx(lx, lz, y)] = id; };
  // 地基
  col(0, B.BEDROCK);
  for (let y = 1; y < GY; y++) col(y, B.DARKBRICK);
  if (!inPlaza) { col(GY, B.PLATBASE); return; } // 外圍深色裙台

  // 棋盤石板
  col(GY, ((wx + wz) & 1) ? B.PLAZA : B.PLAZA2);

  // 中央走道（深色）＋走道發光點綴
  const P0 = SANCTUM.portal;
  if (Math.abs(wx) <= 1 && wz >= P0.z + 1 && wz <= 17) col(GY, B.PLATBASE);
  if (wx === 0 && wz > P0.z + 1 && wz < 15 && ((wz % 6) + 6) % 6 === 1) col(GY, B.GLOWPAD);
  // 每座召喚平台前的粉紅光壇
  for (const [px2, pz2] of SANCTUM.platforms) {
    if (wz === pz2 && wx === (px2 < 0 ? -4 : 4)) col(GY, B.GLOWPAD);
  }

  // 外圈深色矮牆＋定距紫燈、四角燈塔
  const edge = Math.abs(wx) === S || Math.abs(wz) === S;
  if (edge) {
    const corner = Math.abs(wx) === S && Math.abs(wz) === S;
    if (corner) { col(GY + 1, B.DARKBRICK); col(GY + 2, B.DARKBRICK); col(GY + 3, B.GLOWPURPLE); }
    else if (!(wz === -S && Math.abs(wx) <= 3)) { // 北側閘口留缺
      col(GY + 1, B.DARKBRICK);
      if (((wx + wz) % 8 + 8) % 8 === 0) col(GY + 2, B.GLOWPURPLE);
    }
  }

  // 閘口傳送門（北側）：5 寬 5 高拱門，中央 3×3 傳送門
  const P = SANCTUM.portal;
  if (wz === P.z && Math.abs(wx - P.x) <= 3) {
    const dx = Math.abs(wx - P.x);
    if (dx === 3) { for (let y = 1; y <= 5; y++) col(GY + y, B.DARKBRICK); }
    else { for (let y = 1; y <= 3; y++) col(GY + y, B.PORTAL); col(GY + 4, B.DARKBRICK); }
    if (dx === 0) col(GY + 5, B.CRYSTAL);
  }

  // 召喚平台（兩排）
  for (const [px, pz] of SANCTUM.platforms) {
    if (wx === px && wz === pz) { col(GY, B.PLATBASE); col(GY + 1, B.PLATFORM); }
    // 平台間走道燈
  }
  // 走道兩側紫水晶柱
  if ((wz === -12 || wz === 12) && (wx === -3 || wx === 3)) {
    col(GY + 1, B.DARKBRICK); col(GY + 2, B.CRYSTAL);
  }
  // 商店/索引檯（鐵砧＋旗幟）
  const [sx, sz] = SANCTUM.shopAt, [ix, iz] = SANCTUM.indexAt;
  if (wx === sx && wz === sz) col(GY + 1, B.ANVIL);
  if (wx === sx && wz === sz + 1) col(GY + 1, B.BANNER);
  if (wx === ix && wz === iz) col(GY + 1, B.ANVIL);
  if (wx === ix && wz === iz + 1) col(GY + 1, B.BANNER);
}

// ---- 戰鬥世界 ----
function inArena(wx, wz) {
  const a = BATTLE.arena;
  const dx = wx - a.cx, dz = wz - a.cz;
  return dx * dx + dz * dz <= a.r * a.r;
}

function treeAt(seed, w, wx, wz) {
  // 道路與競技場外的裝飾樹
  if (Math.abs(wz) <= BATTLE.pathHalf + 2 || wx < 0 || wx > BATTLE.arena.cx - BATTLE.arena.r - 4) return false;
  if (Math.abs(wz) > 26) return false;
  return N.hash2(seed + 41, wx, wz) < 0.02;
}

function genBattleColumn(seed, w, wx, wz, data, lx, lz) {
  const th = THEMES[w];
  const arena = inArena(wx, wz);
  const onMap = (wx >= BATTLE.xMin && wx <= BATTLE.xMax && Math.abs(wz) <= 30) || arena;
  if (!onMap) return; // 地圖外＝虛空

  const col = (y, id) => { data[idx(lx, lz, y)] = id; };
  col(0, B.BEDROCK);
  for (let y = 1; y < GY; y++) col(y, B.DIRT);

  const onPath = Math.abs(wz) <= 4 && wx >= BATTLE.xMin && wx <= BATTLE.arena.cx;
  if (arena) {
    // 競技場：棋盤地板＋外圈牆
    const a = BATTLE.arena;
    const dx = wx - a.cx, dz = wz - a.cz;
    const d2 = dx * dx + dz * dz;
    col(GY, ((wx + wz) & 1) ? th.arena : B.DARKBRICK);
    const rimIn = (a.r - 1) * (a.r - 1);
    if (d2 > rimIn && !(wz > -3 && wz < 3 && wx < a.cx)) { // 入口缺西側
      col(GY + 1, B.DARKBRICK); col(GY + 2, B.DARKBRICK);
      if (N.hash2(seed + 77, wx, wz) < 0.14) col(GY + 3, B.SKULLROCK);
      else if (N.hash2(seed + 78, wx, wz) < 0.1) col(GY + 3, B.GLOWPURPLE);
    }
    return;
  }

  // 一般地面：路 / 草地（路緣做淺色跳格點綴）
  if (onPath) {
    col(GY, ((N.hash2(seed + 9, wx, wz) < 0.12) ? th.ground : th.path));
  } else {
    col(GY, th.ground);
  }

  // 道路兩側柵欄＋燈柱
  if (Math.abs(wz) === BATTLE.pathHalf + 1 && wx >= 0 && wx <= BATTLE.arena.cx - 6) {
    col(GY + 1, B.FENCE);
    if (wx % 14 === 7) { col(GY + 1, B.LOG); col(GY + 2, w === 3 ? B.LANTERN : B.GLOWPURPLE); }
  }
  // 出生點後方擋牆
  if (wx === BATTLE.xMin && Math.abs(wz) <= BATTLE.pathHalf + 1) {
    for (let y = 1; y <= 3; y++) col(GY + y, B.DARKBRICK);
  }

  // 區域閘門：拱門柱＋GATEBAR（main 清區後拆）
  for (let gi = 0; gi < BATTLE.gates.length; gi++) {
    const gx = BATTLE.gates[gi];
    if (wx !== gx) continue;
    const az = Math.abs(wz);
    if (az === BATTLE.pathHalf + 1 || az === 5) { // 柱
      for (let y = 1; y <= 4; y++) col(GY + y, B.DARKBRICK);
      col(GY + 5, B.GLOWPURPLE);
    } else if (az < 5) { // 門洞：橫樑＋閘門條
      col(GY + 5, B.DARKBRICK);
      for (let y = 1; y <= 4; y++) col(GY + y, B.GATEBAR);
    }
  }

  // 裝飾：墓碑/骷髏石/枯枝/蘑菇（柵欄外側）
  if (Math.abs(wz) > BATTLE.pathHalf + 2 && Math.abs(wz) <= 26 && wx > 4 && wx < BATTLE.arena.cx - 8) {
    const r = N.hash2(seed + 33, wx, wz);
    if (r < 0.015) col(GY + 1, th.deco[0]);
    else if (r < 0.03) col(GY + 1, th.deco[1]);
    else if (r < 0.05) col(GY + 1, th.deco[2]);
  }
}

function stampTree(seed, th, wx, wz, data, baseX, baseZ) {
  const v = (N.hash2(seed + 42, wx, wz) * 1000) | 0;
  const trunk = 3 + v % 3;
  for (let dy = 1; dy <= trunk; dy++) put(data, baseX, baseZ, wx, GY + dy, wz, B.LOG, false);
  for (let dy = trunk - 1; dy <= trunk + 2; dy++) {
    const r = dy <= trunk ? 2 : 1;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) === r && Math.abs(dz) === r && N.hash3(seed + 45, wx + dx, dy, wz + dz) < 0.6) continue;
      put(data, baseX, baseZ, wx + dx, GY + dy + 1, wz + dz, th.leaf, true);
    }
  }
}

const SLWorldgen = {
  CHUNK, WORLD_H, SEA, GY, idx,
  SANCTUM_SEED, WORLD_SEED, sceneFor, THEMES, BATTLE, SANCTUM,
  generateChunk, treeAt, inArena,
};
if (typeof module !== 'undefined') module.exports = SLWorldgen;
if (typeof window !== 'undefined') window.MWWorldgen = SLWorldgen; // 沿用 MWWorldgen 名
})();
