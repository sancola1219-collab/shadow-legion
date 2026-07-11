// 方塊定義表 — 純邏輯，node 可測。
// 本作是戰鬥/收集遊戲，不能挖掘放置；方塊只是場景素材。
// tile: 圖集格編號（16x16 圖集，由 textures.js 依同一編號繪製）。
'use strict';
(function () { // IIFE：避免傳統 script 頂層 const 撞名

const B = {
  AIR: 0,
  BEDROCK: 1,
  // 地面
  GRASS: 2,        // 亮綠草（卡通風）
  DIRT: 3,
  PATH: 4,         // 土路（戰鬥區道路）
  PLAZA: 5,        // 聖所石板（亮灰）
  PLAZA2: 6,       // 聖所石板（暗格，棋盤用）
  STONE: 7,
  STONEBRICK: 8,
  DARKBRICK: 9,    // 深色磚（圍牆）
  SNOW: 10,        // W2 雪地
  ICE: 11,
  CHAR: 12,        // W3 焦黑地
  BASALT: 13,      // W3 黑石
  LAVA: 14,        // W3 熔岩（發光，不是液體，走上去也安全——卡通遊戲）
  BOG: 15,         // W4 沼澤地
  MUD: 16,         // W4 泥沼
  VOID: 17,        // W5 虛空地
  VOIDBRICK: 18,   // W5 虛空磚
  // 裝飾
  LOG: 19,
  LEAF_ORANGE: 20, // W1 橘樹
  LEAF_GREEN: 21,
  LEAF_SNOW: 22,
  LEAF_PURPLE: 23, // W5
  FENCE: 24,       // 木柵欄（cutout 貼圖假柵欄）
  GRAVE: 25,       // 墓碑（h=0.9）
  GRAVE2: 26,      // 圓頂墓碑
  CRYSTAL: 27,     // 紫水晶（發光）
  PORTAL: 28,      // 閘口傳送門方塊（發光紫）
  GATEBAR: 29,     // 區域閘門（清完拆除）
  PLATFORM: 30,    // 召喚平台（h=0.3，發光邊）
  PLATBASE: 31,    // 平台基座（暗石）
  GLOWPURPLE: 32,  // 紫光燈
  LANTERN: 33,     // 橘光燈
  ANVIL: 34,       // 商店鐵砧檯（h=0.8）
  BANNER: 35,      // 旗幟方塊
  MUSHROOM: 36,    // W4 蘑菇（cross）
  DEADBUSH: 37,    // 枯枝（cross）
  STAR: 38,        // W5 星光碎片（cross、發光）
  SKULLROCK: 39,   // 骷髏石（魔王區裝飾）
  GLOWPAD: 40,     // 粉紅發光壇（聖所地板裝飾）
};

// solid：擋人。cross：十字面片。cutout：鏤空。emissive：自發光。light：入點光源表。h：高度。
const DEFS = {
  [B.AIR]:        { name: '空氣', solid: false },
  [B.BEDROCK]:    { name: '基岩', solid: true, tiles: 1 },
  [B.GRASS]:      { name: '草地', solid: true, tiles: { top: 2, bottom: 3, side: 4 } },
  [B.DIRT]:       { name: '泥土', solid: true, tiles: 3 },
  [B.PATH]:       { name: '土路', solid: true, tiles: { top: 5, bottom: 3, side: 4 } },
  [B.PLAZA]:      { name: '石板', solid: true, tiles: 6 },
  [B.PLAZA2]:     { name: '暗石板', solid: true, tiles: 7 },
  [B.STONE]:      { name: '石頭', solid: true, tiles: 8 },
  [B.STONEBRICK]: { name: '石磚', solid: true, tiles: 9 },
  [B.DARKBRICK]:  { name: '深磚', solid: true, tiles: 10 },
  [B.SNOW]:       { name: '雪地', solid: true, tiles: { top: 11, bottom: 3, side: 12 } },
  [B.ICE]:        { name: '冰', solid: true, tiles: 13 },
  [B.CHAR]:       { name: '焦土', solid: true, tiles: 14 },
  [B.BASALT]:     { name: '黑石', solid: true, tiles: 15 },
  [B.LAVA]:       { name: '熔岩', solid: true, tiles: 16, emissive: true, light: true },
  [B.BOG]:        { name: '沼地', solid: true, tiles: { top: 17, bottom: 3, side: 18 } },
  [B.MUD]:        { name: '泥沼', solid: true, tiles: 19 },
  [B.VOID]:       { name: '虛空地', solid: true, tiles: 20 },
  [B.VOIDBRICK]:  { name: '虛空磚', solid: true, tiles: 21 },
  [B.LOG]:        { name: '原木', solid: true, tiles: { top: 23, bottom: 23, side: 22 } },
  [B.LEAF_ORANGE]:{ name: '橘葉', solid: true, tiles: 24, cutout: true },
  [B.LEAF_GREEN]: { name: '綠葉', solid: true, tiles: 25, cutout: true },
  [B.LEAF_SNOW]:  { name: '雪葉', solid: true, tiles: 26, cutout: true },
  [B.LEAF_PURPLE]:{ name: '紫葉', solid: true, tiles: 27, cutout: true },
  [B.FENCE]:      { name: '柵欄', solid: true, tiles: 28, cutout: true },
  [B.GRAVE]:      { name: '墓碑', solid: true, h: 0.9, tiles: 29 },
  [B.GRAVE2]:     { name: '圓墓碑', solid: true, h: 0.9, tiles: 30 },
  [B.CRYSTAL]:    { name: '紫水晶', solid: true, tiles: 31, emissive: true, light: true },
  [B.PORTAL]:     { name: '閘口', solid: true, tiles: 32, emissive: true, light: true },
  [B.GATEBAR]:    { name: '閘門', solid: true, tiles: 33, cutout: true },
  [B.PLATFORM]:   { name: '召喚平台', solid: true, h: 0.3, tiles: 34, emissive: true },
  [B.PLATBASE]:   { name: '平台基座', solid: true, tiles: 35 },
  [B.GLOWPURPLE]: { name: '紫光燈', solid: true, tiles: 36, emissive: true, light: true },
  [B.LANTERN]:    { name: '橘光燈', solid: true, tiles: 37, emissive: true, light: true },
  [B.ANVIL]:      { name: '鐵砧檯', solid: true, h: 0.8, tiles: 38 },
  [B.BANNER]:     { name: '旗幟', solid: true, tiles: 39, cutout: true },
  [B.MUSHROOM]:   { name: '蘑菇', solid: false, tiles: 40, cross: true },
  [B.DEADBUSH]:   { name: '枯枝', solid: false, tiles: 41, cross: true },
  [B.STAR]:       { name: '星光', solid: false, tiles: 42, cross: true, emissive: true, light: true },
  [B.SKULLROCK]:  { name: '骷髏石', solid: true, tiles: 43 },
  [B.GLOWPAD]:    { name: '光壇', solid: true, tiles: 58, emissive: true },
};

function def(id) { return DEFS[id] || DEFS[B.AIR]; }
function isSolid(id) { return !!def(id).solid; }
function isLiquid() { return false; } // 本作沒有液體（介面保留給 mesher/physics）
function isCross(id) { return !!def(id).cross; }
// 不透明：擋光、遮蔽相鄰面（半高/鏤空/十字不遮）
function isOpaque(id) {
  const d = def(id);
  return !!d.solid && !d.cutout && !d.cross && d.h === undefined;
}
function tileOf(id, face) { // face: 'top' | 'bottom' | 'side'
  const t = def(id).tiles;
  if (typeof t === 'number') return t;
  if (!t) return 0;
  return t[face] !== undefined ? t[face] : t.side;
}

const SLBlocks = { B, DEFS, def, isSolid, isLiquid, isCross, isOpaque, tileOf };
if (typeof module !== 'undefined') module.exports = SLBlocks;
if (typeof window !== 'undefined') window.MWBlocks = SLBlocks; // 沿用 MWBlocks 名，讓重用模組不用改
})();
