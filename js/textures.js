// 程序材質圖集 — 瀏覽器層。512×512（16×16 個 32px tile），全部用 Canvas 畫。
// v2 畫風升級：乾淨卡通風——柔和漸層＋少量點綴取代高噪點；tile 編號不變。
// tile 1..43 = 方塊（與 blocks.js 對應）；44.. = 玩家/特效；64.. = 各世界單位皮膚（每世界 12 格）。
'use strict';

(function () {
  const T = 32;        // tile 實際像素
  const S = T / 16;    // 16 單位設計空間 → 實際像素倍率

  // 皮膚 tile 配置：base = 64 + (w-1)*12
  // +0 骨架身 +1 骨架臉 +2 殭屍身 +3 殭屍臉 +4 殭屍衣
  // +5 守衛A身 +6 守衛A臉 +7 守衛B身 +8 守衛B臉 +9 魔王身 +10 魔王臉
  function skinBase(w) { return 64 + (w - 1) * 12; }

  function makeAtlas() {
    const cv = document.createElement('canvas');
    cv.width = 16 * T; cv.height = 16 * T;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const rand = MWNoise.mulberry32(20260711);

    function tilePos(t) { return [(t % 16) * T, Math.floor(t / 16) * T]; }
    const rgb = (r, g, b, a) => `rgba(${Math.max(0, Math.min(255, r | 0))},${Math.max(0, Math.min(255, g | 0))},${Math.max(0, Math.min(255, b | 0))},${a === undefined ? 1 : a})`;

    // 材質底：上亮下暗的柔和漸層＋少量色斑（低密度）＋微邊框
    function matTile(t, r, g, b, opts) {
      const o = opts || {};
      const [ox, oy] = tilePos(t);
      const gr = ctx.createLinearGradient(ox, oy, ox, oy + T);
      const k = o.grad === undefined ? 0.10 : o.grad;
      gr.addColorStop(0, rgb(r * (1 + k), g * (1 + k), b * (1 + k), o.alpha));
      gr.addColorStop(1, rgb(r * (1 - k), g * (1 - k), b * (1 - k), o.alpha));
      ctx.fillStyle = gr;
      ctx.fillRect(ox, oy, T, T);
      // 少量圓潤色斑
      const n = o.spots === undefined ? 5 : o.spots;
      for (let i = 0; i < n; i++) {
        const j = (rand() - 0.5) * (o.jit === undefined ? 30 : o.jit);
        ctx.fillStyle = rgb(r + j, g + j, b + j, 0.5);
        const sx = rand() * (T - 6), sy = rand() * (T - 6), sw = 3 + rand() * 5;
        ctx.fillRect(ox + sx, oy + sy, sw, sw * (0.5 + rand() * 0.8));
      }
      if (o.edge) {
        ctx.fillStyle = rgb(r * 0.72, g * 0.72, b * 0.72, 0.85);
        ctx.fillRect(ox, oy, T, 1.5); ctx.fillRect(ox, oy + T - 1.5, T, 1.5);
        ctx.fillRect(ox, oy, 1.5, T); ctx.fillRect(ox + T - 1.5, oy, 1.5, T);
      }
    }
    // 16 單位設計空間的繪圖（沿用舊版座標，自動放大）
    function px(t, x, y, style) {
      const [ox, oy] = tilePos(t);
      ctx.fillStyle = style;
      ctx.fillRect(ox + x * S, oy + y * S, S, S);
    }
    function rect(t, x, y, w, h, style) {
      const [ox, oy] = tilePos(t);
      ctx.fillStyle = style;
      ctx.fillRect(ox + x * S, oy + y * S, w * S, h * S);
    }
    function clearTile(t) {
      const [ox, oy] = tilePos(t);
      ctx.clearRect(ox, oy, T, T);
    }
    // 磚縫（真實像素細線）
    function mortar(t, color, rows) {
      const [ox, oy] = tilePos(t);
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      for (const [x, y, w, h] of rows) ctx.strokeRect(ox + x * S + 1, oy + y * S + 1, w * S - 2, h * S - 2);
    }
    // 發光暈（真實像素、柔和圓）
    function glow(t, x, y, r, color, a) {
      const [ox, oy] = tilePos(t);
      const g = ctx.createRadialGradient(ox + x * S, oy + y * S, 0, ox + x * S, oy + y * S, r * S);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a === undefined ? 0.6 : a;
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy, T, T);
      ctx.globalAlpha = 1;
    }

    // ---- 方塊 ----
    matTile(0, 240, 240, 240, { spots: 0 });                    // 0 保留白
    matTile(1, 55, 55, 62, { spots: 8, jit: 40 });              // 1 基岩
    matTile(2, 108, 200, 66, { spots: 4, jit: 22 });            // 2 草地頂（卡通亮綠）
    matTile(3, 152, 108, 72, { spots: 5, jit: 20 });            // 3 泥土
    matTile(4, 152, 108, 72, { spots: 4, jit: 18 });            // 4 草地側
    { const [ox, oy] = tilePos(4);
      const g = ctx.createLinearGradient(ox, oy, ox, oy + 9);
      g.addColorStop(0, '#74d148'); g.addColorStop(1, '#5cae3a');
      ctx.fillStyle = g; ctx.fillRect(ox, oy, T, 9);
      ctx.fillStyle = '#5cae3a';
      for (let x = 0; x < T; x += 4) ctx.fillRect(ox + x, oy + 9, 3, 2 + (x * 7 % 3)); }
    matTile(5, 196, 158, 110, { spots: 6, jit: 18 });           // 5 土路頂
    matTile(6, 174, 182, 204, { spots: 2, jit: 8, edge: true }); // 6 石板亮（藍灰）
    matTile(7, 142, 150, 176, { spots: 2, jit: 8, edge: true }); // 7 石板暗（藍灰）
    matTile(8, 136, 136, 144, { spots: 6, jit: 18 });           // 8 石頭
    matTile(9, 132, 132, 140, { spots: 3, jit: 10 });           // 9 石磚
    mortar(9, 'rgba(80,80,92,0.8)', [[0, 0, 16, 8], [0, 8, 8, 8], [8, 8, 8, 8]]);
    matTile(10, 64, 58, 84, { spots: 3, jit: 12 });             // 10 深磚（帶紫調）
    mortar(10, 'rgba(38,32,58,0.9)', [[0, 0, 16, 8], [0, 8, 8, 8], [8, 8, 8, 8]]);
    matTile(11, 238, 244, 252, { spots: 3, jit: 8 });           // 11 雪頂
    matTile(12, 152, 108, 72, { spots: 3, jit: 16 });           // 12 雪側
    { const [ox, oy] = tilePos(12);
      const g = ctx.createLinearGradient(ox, oy, ox, oy + 11);
      g.addColorStop(0, '#f2f6fc'); g.addColorStop(1, '#dbe6f2');
      ctx.fillStyle = g; ctx.fillRect(ox, oy, T, 11); }
    matTile(13, 158, 208, 240, { spots: 2, jit: 10, edge: true }); // 13 冰
    rect(13, 2, 3, 6, 1, 'rgba(240,252,255,0.8)'); rect(13, 9, 9, 4, 1, 'rgba(240,252,255,0.7)');
    matTile(14, 74, 60, 54, { spots: 6, jit: 20 });             // 14 焦土
    glow(14, 5, 11, 4, 'rgba(255,120,40,0.5)'); glow(14, 12, 4, 3, 'rgba(255,120,40,0.4)');
    matTile(15, 46, 44, 52, { spots: 5, jit: 16 });             // 15 黑石
    matTile(16, 250, 130, 34, { spots: 0, grad: 0.06 });        // 16 熔岩（發光）
    glow(16, 5, 6, 6, 'rgba(255,236,140,0.95)', 0.9);
    glow(16, 12, 12, 5, 'rgba(255,236,140,0.9)', 0.8);
    matTile(17, 92, 138, 72, { spots: 6, jit: 20 });            // 17 沼地頂
    matTile(18, 112, 92, 62, { spots: 4, jit: 16 });            // 18 沼地側
    { const [ox, oy] = tilePos(18);
      ctx.fillStyle = '#5d8f48'; ctx.fillRect(ox, oy, T, 8); }
    matTile(19, 98, 80, 54, { spots: 5, jit: 16 });             // 19 泥沼
    rect(19, 2, 4, 5, 1, 'rgba(150,190,100,0.5)'); rect(19, 9, 11, 5, 1, 'rgba(150,190,100,0.4)');
    matTile(20, 54, 42, 82, { spots: 4, jit: 14 });             // 20 虛空地
    px(20, 4, 4, '#b48cff'); px(20, 12, 9, '#b48cff'); px(20, 8, 13, '#8a64d8');
    matTile(21, 68, 54, 104, { spots: 3, jit: 12 });            // 21 虛空磚
    mortar(21, 'rgba(36,26,64,0.9)', [[0, 0, 16, 8], [0, 8, 8, 8], [8, 8, 8, 8]]);
    matTile(22, 108, 84, 52, { spots: 2, jit: 12 });            // 22 原木側
    { const [ox, oy] = tilePos(22);
      ctx.fillStyle = 'rgba(72,54,30,0.55)';
      for (let x = 3; x < T; x += 7) ctx.fillRect(ox + x, oy, 2, T); }
    matTile(23, 172, 140, 96, { spots: 2, jit: 10 });           // 23 原木頂：年輪
    { const [ox, oy] = tilePos(23); ctx.strokeStyle = '#8a6a40'; ctx.lineWidth = 2;
      for (let r = 4; r <= 14; r += 5) { ctx.beginPath(); ctx.arc(ox + 16, oy + 16, r, 0, 7); ctx.stroke(); } }
    // 24..27 樹葉（鏤空少一點、色斑柔和）
    matTile(24, 238, 142, 44, { spots: 8, jit: 26 });           // 橘
    matTile(25, 76, 168, 64, { spots: 8, jit: 24 });            // 綠
    matTile(26, 205, 228, 246, { spots: 6, jit: 14 });          // 雪白
    matTile(27, 156, 96, 224, { spots: 8, jit: 26 });           // 紫
    for (const t of [24, 25, 26, 27]) {
      const [ox, oy] = tilePos(t);
      const img = ctx.getImageData(ox, oy, T, T);
      for (let i = 0; i < T * T; i++) if (rand() < 0.07) img.data[i * 4 + 3] = 0;
      ctx.putImageData(img, ox, oy);
    }
    clearTile(28);                                              // 28 柵欄（鏤空）
    { const g = (x, w) => { rect(28, x, 0, w, 16, '#5f4832'); rect(28, x, 0, 1, 16, '#75593d'); };
      g(6, 4);
      rect(28, 0, 3, 16, 3, '#6e543a'); rect(28, 0, 3, 16, 1, '#82643f');
      rect(28, 0, 10, 16, 3, '#6e543a'); rect(28, 0, 10, 16, 1, '#82643f'); }
    // 29 方墓碑：圓角頂＋銘文
    matTile(29, 156, 156, 166, { spots: 2, jit: 8, edge: true });
    { const [ox, oy] = tilePos(29);
      ctx.fillStyle = 'rgba(90,90,104,0.85)';
      ctx.fillRect(ox + 7 * S, oy + 4 * S, 8 * S, 2); ctx.fillRect(ox + 5 * S, oy + 7 * S, 6 * S, 2);
      ctx.fillRect(ox + 6 * S, oy + 10 * S, 7 * S, 2); }
    // 30 圓頂墓碑
    matTile(30, 142, 142, 154, { spots: 2, jit: 8 });
    { const [ox, oy] = tilePos(30);
      ctx.fillStyle = '#9a9aa8';
      ctx.beginPath(); ctx.arc(ox + 16, oy + 6, 12, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#5c5c6a'; ctx.fillRect(ox + 10, oy + 12, 12, 12); }
    // 31 紫水晶（發光）
    matTile(31, 186, 118, 250, { spots: 0, grad: 0.14 });
    { const [ox, oy] = tilePos(31);
      ctx.fillStyle = 'rgba(244,214,255,0.9)';
      ctx.beginPath(); ctx.moveTo(ox + 9, oy + 28); ctx.lineTo(ox + 13, oy + 4); ctx.lineTo(ox + 17, oy + 28); ctx.fill();
      ctx.fillStyle = 'rgba(230,190,255,0.7)';
      ctx.beginPath(); ctx.moveTo(ox + 19, oy + 29); ctx.lineTo(ox + 23, oy + 9); ctx.lineTo(ox + 26, oy + 29); ctx.fill(); }
    // 32 閘口傳送門：發光渦漩
    matTile(32, 128, 52, 208, { spots: 0, grad: 0.1 });
    { const [ox, oy] = tilePos(32);
      glow(32, 8, 8, 9, 'rgba(236,190,255,0.9)', 0.75);
      ctx.strokeStyle = 'rgba(246,214,255,0.9)'; ctx.lineWidth = 2.5;
      for (let r = 4; r <= 14; r += 5) { ctx.beginPath(); ctx.arc(ox + 16, oy + 16, r, r * 0.7, r * 0.7 + 4.2); ctx.stroke(); } }
    clearTile(33);                                              // 33 閘門條（鏤空鐵欄）
    for (let x = 1; x < 16; x += 4) { rect(33, x, 0, 2, 16, '#3c3650'); rect(33, x, 0, 1, 16, '#544c70'); }
    rect(33, 0, 1, 16, 2, '#4c4468'); rect(33, 0, 13, 16, 2, '#4c4468');
    // 34 召喚平台（發光紫邊）
    matTile(34, 42, 36, 64, { spots: 2, jit: 10 });
    { const [ox, oy] = tilePos(34);
      ctx.strokeStyle = '#c46aff'; ctx.lineWidth = 3;
      ctx.strokeRect(ox + 2, oy + 2, T - 4, T - 4);
      ctx.strokeStyle = 'rgba(196,106,255,0.45)'; ctx.lineWidth = 2;
      ctx.strokeRect(ox + 7, oy + 7, T - 14, T - 14);
      glow(34, 8, 8, 7, 'rgba(180,90,255,0.5)', 0.5); }
    matTile(35, 60, 56, 76, { spots: 3, jit: 10, edge: true }); // 35 平台基座
    matTile(36, 192, 124, 255, { spots: 0 });                   // 36 紫光燈
    glow(36, 8, 8, 9, 'rgba(246,226,255,0.95)', 0.95);
    matTile(37, 255, 184, 74, { spots: 0 });                    // 37 橘光燈
    glow(37, 8, 8, 9, 'rgba(255,244,200,0.95)', 0.95);
    // 38 鐵砧檯
    matTile(38, 78, 78, 90, { spots: 2, jit: 10 });
    rect(38, 2, 2, 12, 3, '#a2a2b2'); rect(38, 2, 2, 12, 1, '#c2c2d0');
    rect(38, 5, 6, 6, 8, '#5a5a6a'); rect(38, 3, 13, 10, 2, '#4a4a58');
    clearTile(39);                                              // 39 旗幟（鏤空紫旗）
    rect(39, 7, 0, 2, 16, '#5f4832'); rect(39, 7, 0, 1, 16, '#75593d');
    { const [ox, oy] = tilePos(39);
      const g = ctx.createLinearGradient(ox + 18, oy, ox + 30, oy);
      g.addColorStop(0, '#9a4ae8'); g.addColorStop(1, '#6c28b0');
      ctx.fillStyle = g; ctx.fillRect(ox + 18, oy + 2, 12, 18);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(ox + 24, oy + 10, 3.4, 0, 7); ctx.fill(); }
    clearTile(40);                                              // 40 蘑菇（十字）
    rect(40, 6, 8, 4, 8, '#ece4d4'); rect(40, 6, 8, 1, 8, '#f8f2e6');
    { const [ox, oy] = tilePos(40);
      ctx.fillStyle = '#cc4e90';
      ctx.beginPath(); ctx.arc(ox + 16, oy + 15, 11, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f2d2e4';
      ctx.beginPath(); ctx.arc(ox + 11, oy + 10, 2.4, 0, 7); ctx.arc(ox + 21, oy + 8, 2, 0, 7); ctx.fill(); }
    clearTile(41);                                              // 41 枯枝（十字）
    rect(41, 7, 6, 2, 10, '#7a5c3a');
    rect(41, 3, 4, 4, 1, '#6e4e30'); rect(41, 10, 3, 4, 1, '#6e4e30'); rect(41, 5, 8, 6, 1, '#6e4e30');
    clearTile(42);                                              // 42 星光（十字、發光）
    glow(42, 8, 8, 8, 'rgba(216,186,255,0.9)', 0.8);
    rect(42, 7, 2, 2, 12, '#f0e4ff'); rect(42, 2, 7, 12, 2, '#f0e4ff');
    px(42, 8, 8, '#ffffff');
    // 43 骷髏石
    matTile(43, 124, 120, 134, { spots: 3, jit: 12 });
    { const [ox, oy] = tilePos(43);
      ctx.fillStyle = '#1a1a22';
      ctx.beginPath(); ctx.arc(ox + 10, oy + 12, 4, 0, 7); ctx.arc(ox + 22, oy + 12, 4, 0, 7); ctx.fill();
      ctx.fillRect(ox + 10, oy + 20, 12, 4);
      ctx.fillStyle = '#8c8898';
      ctx.fillRect(ox + 12, oy + 20, 2, 4); ctx.fillRect(ox + 18, oy + 20, 2, 4); }

    // ---- 44.. 玩家（金甲勇者）與特效 ----
    // 44 手臂：金甲＋深色護腕＋金邊
    matTile(44, 232, 178, 58, { spots: 0, grad: 0.16 });
    { const [ox, oy] = tilePos(44);
      ctx.fillStyle = '#f6e2a2'; ctx.fillRect(ox, oy, T, 2);        // 肩口高光
      ctx.fillStyle = '#2e2a3e'; ctx.fillRect(ox, oy + 19, T, 9);   // 深色護腕
      ctx.fillStyle = '#ffd977'; ctx.fillRect(ox, oy + 17, T, 2);   // 金邊
      ctx.fillStyle = '#c99b32'; ctx.fillRect(ox, oy + 28, T, 4); } // 手
    // 45 玩家臉：大眼＋眉＋微笑＋腮紅（Q 版）
    matTile(45, 248, 214, 172, { spots: 0, grad: 0.05 });
    rect(45, 3, 6, 4, 5, '#33231d'); rect(45, 9, 6, 4, 5, '#33231d');
    rect(45, 3, 6, 4, 2, '#5a3a2c'); rect(45, 9, 6, 4, 2, '#5a3a2c'); // 虹膜上緣
    rect(45, 4, 8, 2, 2, '#ffffff'); rect(45, 10, 8, 2, 2, '#ffffff'); // 高光
    rect(45, 3, 4, 4, 1, '#9a4e34'); rect(45, 9, 4, 4, 1, '#9a4e34'); // 眉
    rect(45, 6, 13, 4, 1, '#b06a4a'); px(45, 5, 12, '#b06a4a'); px(45, 10, 12, '#b06a4a'); // 微笑
    rect(45, 1, 11, 2, 1, 'rgba(255,140,120,0.5)'); rect(45, 13, 11, 2, 1, 'rgba(255,140,120,0.5)'); // 腮紅
    // 46 玩家紅髮：漸層＋髮絲
    matTile(46, 178, 48, 44, { spots: 0, grad: 0.2 });
    { const [ox, oy] = tilePos(46);
      ctx.fillStyle = 'rgba(255,124,110,0.35)';
      for (let x = 2; x < T; x += 7) ctx.fillRect(ox + x, oy, 2, T);
      ctx.fillStyle = 'rgba(90,16,14,0.4)';
      for (let x = 6; x < T; x += 7) ctx.fillRect(ox + x, oy, 2, T); }
    clearTile(47);                                              // 47 金劍
    for (let i = 0; i < 10; i++) rect(47, 4 + i, 12 - i, 2, 2, i < 2 ? '#8a5c20' : '#f0e0a0');
    for (let i = 2; i < 10; i++) px(47, 4 + i, 13 - i, '#c89a30');
    rect(47, 3, 11, 5, 1, '#e8c93e');
    clearTile(48);                                              // 48 靈魂紫焰
    { const [ox, oy] = tilePos(48);
      glow(48, 8, 9, 9, 'rgba(170,90,255,0.85)', 0.85);
      ctx.fillStyle = 'rgba(150,70,240,0.9)';
      ctx.beginPath();
      ctx.moveTo(ox + 16, oy + 3);
      ctx.quadraticCurveTo(ox + 26, oy + 12, ox + 22, oy + 22);
      ctx.quadraticCurveTo(ox + 20, oy + 28, ox + 16, oy + 28);
      ctx.quadraticCurveTo(ox + 12, oy + 28, ox + 10, oy + 22);
      ctx.quadraticCurveTo(ox + 6, oy + 12, ox + 16, oy + 3);
      ctx.fill();
      ctx.fillStyle = '#e8ccff';
      ctx.beginPath();
      ctx.moveTo(ox + 16, oy + 10);
      ctx.quadraticCurveTo(ox + 21, oy + 16, ox + 18, oy + 24);
      ctx.quadraticCurveTo(ox + 16, oy + 26, ox + 14, oy + 24);
      ctx.quadraticCurveTo(ox + 11, oy + 16, ox + 16, oy + 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ox + 16, oy + 20, 3, 0, 7); ctx.fill(); }
    // 49..51 能量彈（圓形發光）
    function orb(t, outer, inner) {
      clearTile(t);
      const [ox, oy] = tilePos(t);
      glow(t, 8, 8, 8, outer, 0.8);
      ctx.fillStyle = outer;
      ctx.beginPath(); ctx.arc(ox + 16, oy + 16, 8, 0, 7); ctx.fill();
      ctx.fillStyle = inner;
      ctx.beginPath(); ctx.arc(ox + 16, oy + 16, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ox + 14, oy + 14, 2, 0, 7); ctx.fill();
    }
    orb(49, 'rgba(88,232,88,0.95)', '#d0ffc0');   // 毒彈
    orb(50, 'rgba(72,200,255,0.95)', '#d0f0ff');  // 電彈
    orb(51, 'rgba(224,72,152,0.95)', '#ffd0e8');  // 魔王彈
    clearTile(52);                                              // 52 斬擊特效（白弧）
    { const [ox, oy] = tilePos(52); ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(ox + 16, oy + 16, 12, -0.8, 0.8); ctx.stroke(); }
    // 53 玩家胸甲前板：深色側披＋金邊＋紫寶石
    matTile(53, 232, 178, 58, { spots: 0, grad: 0.16 });
    { const [ox, oy] = tilePos(53);
      ctx.fillStyle = '#2e2a3e'; ctx.fillRect(ox, oy, 4, T); ctx.fillRect(ox + T - 4, oy, 4, T);
      ctx.fillStyle = '#ffd977'; ctx.fillRect(ox + 4, oy, 2, T); ctx.fillRect(ox + T - 6, oy, 2, T);
      ctx.fillStyle = '#f6e2a2'; ctx.fillRect(ox + 6, oy + 2, T - 12, 3);
      ctx.fillStyle = '#7a2ee0';
      ctx.beginPath(); ctx.moveTo(ox + 16, oy + 9); ctx.lineTo(ox + 22, oy + 16); ctx.lineTo(ox + 16, oy + 23); ctx.lineTo(ox + 10, oy + 16); ctx.fill();
      ctx.fillStyle = '#c9a0ff'; ctx.fillRect(ox + 13, oy + 12, 4, 4);
      ctx.fillStyle = '#2e2a3e'; ctx.fillRect(ox, oy + 26, T, 6);
      ctx.fillStyle = '#ffd977'; ctx.fillRect(ox, oy + 24, T, 2); }
    // 54 玩家軀幹側背/肩甲：金板＋飾線
    matTile(54, 232, 178, 58, { spots: 0, grad: 0.16 });
    { const [ox, oy] = tilePos(54);
      ctx.fillStyle = '#f6e2a2'; ctx.fillRect(ox, oy, T, 2);
      ctx.fillStyle = 'rgba(150,100,30,0.55)'; ctx.fillRect(ox, oy + 10, T, 2); ctx.fillRect(ox, oy + 19, T, 2);
      ctx.fillStyle = '#2e2a3e'; ctx.fillRect(ox, oy + 26, T, 6);
      ctx.fillStyle = '#ffd977'; ctx.fillRect(ox, oy + 24, T, 2); }
    // 55 玩家腿：深色褲＋金靴
    matTile(55, 46, 42, 62, { spots: 0, grad: 0.1 });
    { const [ox, oy] = tilePos(55);
      ctx.fillStyle = '#e8b84e'; ctx.fillRect(ox, oy + 17, T, 15);
      ctx.fillStyle = '#f6e2a2'; ctx.fillRect(ox, oy + 17, T, 2);
      ctx.fillStyle = '#b8842a'; ctx.fillRect(ox, oy + 28, T, 4); }
    // 56 玩家腰帶：深色＋金扣
    matTile(56, 40, 36, 54, { spots: 0, grad: 0.08 });
    rect(56, 6, 4, 4, 8, '#ffd24a'); rect(56, 7, 6, 2, 4, '#8a5c20');
    // 58 粉紅發光壇（聖所地板）
    matTile(58, 236, 74, 190, { spots: 0, grad: 0.06 });
    glow(58, 8, 8, 10, 'rgba(255,214,244,0.95)', 0.92);
    { const [ox, oy] = tilePos(58);
      ctx.strokeStyle = '#8a1e66'; ctx.lineWidth = 3;
      ctx.strokeRect(ox + 1.5, oy + 1.5, T - 3, T - 3); }

    // ---- 64.. 各世界單位皮膚 ----
    // 每世界調色盤：[骨, 殭屍膚, 殭屍衣, 守衛甲, 守A眼, 守B眼, 魔王甲, 魔王眼]
    const PAL = {
      1: { bone: [234, 230, 216], zskin: [126, 164, 92], zcloth: [72, 92, 154], armor: [54, 52, 74], eyeA: '#58e858', eyeB: '#48c8ff', bossA: [72, 42, 48], eyeBoss: '#ff4858' },
      2: { bone: [204, 228, 246], zskin: [152, 192, 202], zcloth: [82, 122, 182], armor: [92, 122, 162], eyeA: '#a0e8ff', eyeB: '#ffffff', bossA: [62, 92, 142], eyeBoss: '#80e0ff' },
      3: { bone: [84, 74, 70], zskin: [152, 72, 46], zcloth: [92, 42, 32], armor: [62, 42, 38], eyeA: '#ffb030', eyeB: '#ff6020', bossA: [92, 32, 22], eyeBoss: '#ffd24a' },
      4: { bone: [192, 202, 152], zskin: [102, 142, 72], zcloth: [62, 82, 42], armor: [58, 74, 50], eyeA: '#b0ff40', eyeB: '#e8ff80', bossA: [52, 72, 38], eyeBoss: '#d0ff50' },
      5: { bone: [152, 132, 192], zskin: [112, 92, 162], zcloth: [52, 42, 92], armor: [42, 34, 68], eyeA: '#c090ff', eyeB: '#fff0a0', bossA: [32, 24, 58], eyeBoss: '#ffffff' },
    };
    // 發光眼（真實像素：光暈＋眼芯＋高光）
    function eyes(t, exL, exR, ey, ew, eh, color) {
      glow(t, exL + ew / 2, ey + eh / 2, 4.5, color, 0.55);
      glow(t, exR + ew / 2, ey + eh / 2, 4.5, color, 0.55);
      rect(t, exL, ey, ew, eh, color);
      rect(t, exR, ey, ew, eh, color);
      px(t, exL, ey, 'rgba(255,255,255,0.85)');
      px(t, exR, ey, 'rgba(255,255,255,0.85)');
    }
    for (let w = 1; w <= 5; w++) {
      const p = PAL[w], b = skinBase(w);
      // 骨架：骨白身＋黑眼窩臉（紫/橘瞳）＋肋骨線
      matTile(b + 0, p.bone[0], p.bone[1], p.bone[2], { spots: 2, jit: 12, grad: 0.1 });
      for (let y = 4; y < 14; y += 3) rect(b + 0, 3, y, 10, 1, 'rgba(0,0,0,0.16)');
      matTile(b + 1, p.bone[0], p.bone[1], p.bone[2], { spots: 0, grad: 0.08 });
      rect(b + 1, 3, 4, 3, 3, '#14141c'); rect(b + 1, 10, 4, 3, 3, '#14141c');
      rect(b + 1, 6, 10, 4, 2, '#14141c');
      { const pc = w === 3 ? '#ffb030' : '#c46aff';
        px(b + 1, 4, 5, pc); px(b + 1, 11, 5, pc);
        glow(b + 1, 4.5, 5.5, 3.5, pc, 0.4); glow(b + 1, 11.5, 5.5, 3.5, pc, 0.4); }
      // 殭屍：膚＋臉＋衣
      matTile(b + 2, p.zskin[0], p.zskin[1], p.zskin[2], { spots: 3, jit: 16, grad: 0.1 });
      matTile(b + 3, p.zskin[0], p.zskin[1], p.zskin[2], { spots: 0, grad: 0.08 });
      rect(b + 3, 3, 4, 3, 3, '#131313'); rect(b + 3, 10, 4, 3, 3, '#131313');
      px(b + 3, 4, 5, '#e8e8e8'); px(b + 3, 11, 5, '#e8e8e8');
      rect(b + 3, 5, 10, 6, 2, '#3a2020'); rect(b + 3, 6, 10, 1, 2, '#f0f0e0'); rect(b + 3, 9, 10, 1, 2, '#f0f0e0');
      matTile(b + 4, p.zcloth[0], p.zcloth[1], p.zcloth[2], { spots: 3, jit: 16, grad: 0.12 });
      rect(b + 4, 3, 3, 2, 4, 'rgba(0,0,0,0.22)'); rect(b + 4, 11, 8, 2, 4, 'rgba(0,0,0,0.22)'); // 破布
      // 守衛（塊甲＋鉚釘＋發光眼縫）
      const mkGuard = (bt, eye) => {
        matTile(bt, p.armor[0], p.armor[1], p.armor[2], { spots: 0, grad: 0.16 });
        rect(bt, 1, 1, 14, 1, 'rgba(255,255,255,0.22)');
        rect(bt, 1, 14, 14, 1, 'rgba(0,0,0,0.3)');
        rect(bt, 0, 7, 16, 1, 'rgba(0,0,0,0.25)'); // 甲片分段線
        for (const [x, y] of [[3, 4], [12, 4], [3, 11], [12, 11]]) px(bt, x, y, 'rgba(255,255,255,0.35)');
        matTile(bt + 1, p.armor[0], p.armor[1], p.armor[2], { spots: 0, grad: 0.1 });
        glow(bt + 1, 8, 6, 7, eye, 0.5);
        rect(bt + 1, 3, 5, 10, 2, eye);
        rect(bt + 1, 3, 5, 10, 1, 'rgba(255,255,255,0.5)');
        rect(bt + 1, 5, 10, 6, 1, 'rgba(0,0,0,0.5)');
      };
      mkGuard(b + 5, p.eyeA);
      mkGuard(b + 7, p.eyeB);
      // 魔王：暗甲＋裂紋光＋骷髏臉大眼
      matTile(b + 9, p.bossA[0], p.bossA[1], p.bossA[2], { spots: 2, jit: 12, grad: 0.16 });
      { const [ox, oy] = tilePos(b + 9);
        ctx.strokeStyle = p.eyeBoss; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(ox + 5, oy + 3); ctx.lineTo(ox + 11, oy + 12); ctx.lineTo(ox + 8, oy + 20);
        ctx.moveTo(ox + 22, oy + 6); ctx.lineTo(ox + 18, oy + 16); ctx.lineTo(ox + 24, oy + 27);
        ctx.stroke(); ctx.globalAlpha = 1; }
      matTile(b + 10, p.bossA[0], p.bossA[1], p.bossA[2], { spots: 0, grad: 0.1 });
      eyes(b + 10, 2, 10, 4, 4, 4, p.eyeBoss);
      rect(b + 10, 5, 11, 6, 3, '#0a0a0e');
      rect(b + 10, 6, 11, 1, 3, p.eyeBoss); rect(b + 10, 9, 11, 1, 3, p.eyeBoss);
    }

    return cv;
  }

  // 雲朵透明貼圖（獨立 128×128）
  function makeClouds() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const n = MWNoise.fbm2(555, x * 0.18, y * 0.18, 3, 2, 0.5);
      if (n > 0.55) {
        ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.9, (n - 0.55) * 5) + ')';
        ctx.fillRect(x * 4, y * 4, 4, 4);
      }
    }
    return cv;
  }

  window.MWTextures = { makeAtlas, makeClouds, TILE: T, skinBase };
})();
