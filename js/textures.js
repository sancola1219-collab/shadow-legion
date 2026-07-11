// 程序材質圖集 — 瀏覽器層。256×256（16×16 個 16px tile），全部用 Canvas 畫。
// tile 1..43 = 方塊（與 blocks.js 對應）；44.. = 玩家/特效；64.. = 各世界單位皮膚（每世界 12 格）。
'use strict';

(function () {
  const T = 16; // tile 尺寸

  // 皮膚 tile 配置：base = 64 + (w-1)*12
  // +0 骨架身 +1 骨架臉 +2 殭屍身 +3 殭屍臉 +4 殭屍衣
  // +5 守衛A身 +6 守衛A臉 +7 守衛B身 +8 守衛B臉 +9 魔王身 +10 魔王臉
  function skinBase(w) { return 64 + (w - 1) * 12; }

  function makeAtlas() {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const rand = MWNoise.mulberry32(20260711);

    function tilePos(t) { return [(t % 16) * T, Math.floor(t / 16) * T]; }
    function noiseTile(t, r, g, b, jitter, alpha) {
      const [ox, oy] = tilePos(t);
      const img = ctx.createImageData(T, T);
      for (let i = 0; i < T * T; i++) {
        const j = (rand() - 0.5) * 2 * jitter;
        img.data[i * 4] = Math.max(0, Math.min(255, r + j));
        img.data[i * 4 + 1] = Math.max(0, Math.min(255, g + j));
        img.data[i * 4 + 2] = Math.max(0, Math.min(255, b + j));
        img.data[i * 4 + 3] = alpha === undefined ? 255 : alpha;
      }
      ctx.putImageData(img, ox, oy);
    }
    function px(t, x, y, style) {
      const [ox, oy] = tilePos(t);
      ctx.fillStyle = style;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
    function rect(t, x, y, w, h, style) {
      const [ox, oy] = tilePos(t);
      ctx.fillStyle = style;
      ctx.fillRect(ox + x, oy + y, w, h);
    }
    function speckle(t, n, style) {
      for (let i = 0; i < n; i++) px(t, (rand() * T) | 0, (rand() * T) | 0, style);
    }
    function clearTile(t) {
      const [ox, oy] = tilePos(t);
      ctx.clearRect(ox, oy, T, T);
    }
    function border(t, style) {
      rect(t, 0, 0, 16, 1, style); rect(t, 0, 15, 16, 1, style);
      rect(t, 0, 0, 1, 16, style); rect(t, 15, 0, 1, 16, style);
    }

    // ---- 方塊 ----
    noiseTile(0, 240, 240, 240, 6);                       // 0 保留白
    noiseTile(1, 55, 55, 60, 26);                         // 1 基岩
    noiseTile(2, 110, 205, 70, 14);                       // 2 草地頂（卡通亮綠）
    noiseTile(3, 150, 105, 70, 20);                       // 3 泥土
    noiseTile(4, 150, 105, 70, 16);                       // 4 草地側
    rect(4, 0, 0, 16, 4, '#6ecb46');
    noiseTile(5, 190, 150, 105, 14);                      // 5 土路頂（沙土）
    speckle(5, 12, 'rgba(120,86,54,0.5)');
    noiseTile(6, 205, 205, 212, 8);                       // 6 石板亮
    border(6, 'rgba(150,150,162,0.7)');
    noiseTile(7, 168, 168, 178, 8);                       // 7 石板暗
    border(7, 'rgba(120,120,134,0.7)');
    noiseTile(8, 132, 132, 138, 16);                      // 8 石頭
    noiseTile(9, 128, 128, 134, 10);                      // 9 石磚
    { const [ox, oy] = tilePos(9); ctx.strokeStyle = '#5a5a62';
      for (const [x, y, w, h] of [[0, 0, 16, 8], [0, 8, 8, 8], [8, 8, 8, 8]]) ctx.strokeRect(ox + x + 0.5, oy + y + 0.5, w - 1, h - 1); }
    noiseTile(10, 62, 58, 78, 10);                        // 10 深磚（帶紫調）
    { const [ox, oy] = tilePos(10); ctx.strokeStyle = '#2e2a40';
      for (const [x, y, w, h] of [[0, 0, 16, 8], [0, 8, 8, 8], [8, 8, 8, 8]]) ctx.strokeRect(ox + x + 0.5, oy + y + 0.5, w - 1, h - 1); }
    noiseTile(11, 238, 243, 250, 8);                      // 11 雪頂
    noiseTile(12, 150, 105, 70, 16);                      // 12 雪側
    rect(12, 0, 0, 16, 5, '#eef2f8');
    noiseTile(13, 160, 205, 240, 10);                     // 13 冰
    rect(13, 2, 3, 5, 1, '#d8f0fc'); rect(13, 9, 9, 4, 1, '#d8f0fc');
    noiseTile(14, 70, 58, 52, 18);                        // 14 焦土
    speckle(14, 10, 'rgba(255,120,40,0.35)');
    noiseTile(15, 44, 42, 48, 12);                        // 15 黑石
    speckle(15, 8, 'rgba(120,120,130,0.4)');
    noiseTile(16, 250, 120, 30, 26);                      // 16 熔岩（發光）
    for (let i = 0; i < 5; i++) rect(16, (rand() * 12) | 0, (rand() * 14) | 0, 3 + (rand() * 3 | 0), 2, 'rgba(255,230,120,0.7)');
    noiseTile(17, 90, 140, 70, 16);                       // 17 沼地頂（暗綠）
    speckle(17, 14, 'rgba(60,100,50,0.6)');
    noiseTile(18, 110, 90, 60, 16);                       // 18 沼地側
    rect(18, 0, 0, 16, 4, '#5a8c46');
    noiseTile(19, 96, 78, 52, 18);                        // 19 泥沼
    for (let i = 0; i < 4; i++) rect(19, (rand() * 12) | 0, (rand() * 14) | 0, 3, 1, 'rgba(140,180,90,0.4)');
    noiseTile(20, 52, 40, 78, 14);                        // 20 虛空地
    speckle(20, 8, 'rgba(180,140,255,0.5)');
    noiseTile(21, 66, 52, 100, 10);                       // 21 虛空磚
    { const [ox, oy] = tilePos(21); ctx.strokeStyle = '#2a2044';
      for (const [x, y, w, h] of [[0, 0, 16, 8], [0, 8, 8, 8], [8, 8, 8, 8]]) ctx.strokeRect(ox + x + 0.5, oy + y + 0.5, w - 1, h - 1); }
    noiseTile(22, 104, 82, 50, 16);                       // 22 原木側
    for (let x = 1; x < T; x += 3) rect(22, x, 0, 1, 16, 'rgba(70,52,28,0.55)');
    noiseTile(23, 168, 136, 92, 12);                      // 23 原木頂
    { const [ox, oy] = tilePos(23); ctx.strokeStyle = '#8a6a40';
      for (let r = 2; r <= 7; r += 2) { ctx.beginPath(); ctx.arc(ox + 8, oy + 8, r, 0, 7); ctx.stroke(); } }
    // 24..27 樹葉（鏤空）
    noiseTile(24, 235, 140, 40, 26);                      // 橘
    noiseTile(25, 70, 160, 60, 24);                       // 綠
    noiseTile(26, 200, 225, 245, 16);                     // 雪白
    noiseTile(27, 150, 90, 220, 24);                      // 紫
    for (const t of [24, 25, 26, 27]) {
      const [ox, oy] = tilePos(t);
      const img = ctx.getImageData(ox, oy, T, T);
      for (let i = 0; i < T * T; i++) if (rand() < 0.16) img.data[i * 4 + 3] = 0;
      ctx.putImageData(img, ox, oy);
    }
    clearTile(28);                                        // 28 柵欄（鏤空：橫桿×2＋立柱）
    rect(28, 6, 0, 4, 16, '#5c4530');
    rect(28, 0, 3, 16, 3, '#6e543a'); rect(28, 0, 10, 16, 3, '#6e543a');
    noiseTile(29, 150, 150, 158, 10);                     // 29 墓碑（方）
    rect(29, 4, 4, 8, 1, '#6a6a72'); rect(29, 4, 7, 8, 1, '#6a6a72');
    border(29, 'rgba(90,90,100,0.8)');
    noiseTile(30, 138, 138, 148, 10);                     // 30 圓墓碑
    rect(30, 0, 0, 16, 2, '#8a8a94'); rect(30, 0, 0, 3, 3, '#71717c'); rect(30, 13, 0, 3, 3, '#71717c');
    rect(30, 5, 5, 6, 6, '#5c5c66');
    noiseTile(31, 190, 120, 255, 20);                     // 31 紫水晶（發光）
    rect(31, 4, 2, 3, 12, 'rgba(240,200,255,0.8)'); rect(31, 10, 4, 2, 9, 'rgba(240,200,255,0.6)');
    noiseTile(32, 150, 60, 230, 26);                      // 32 閘口傳送門（發光渦漩）
    { const [ox, oy] = tilePos(32); ctx.strokeStyle = 'rgba(240,190,255,0.85)';
      for (let r = 2; r <= 7; r += 2) { ctx.beginPath(); ctx.arc(ox + 8, oy + 8, r, r, r + 4.5); ctx.stroke(); } }
    clearTile(33);                                        // 33 閘門條（鏤空鐵欄）
    for (let x = 1; x < 16; x += 4) rect(33, x, 0, 2, 16, '#3a3548');
    rect(33, 0, 1, 16, 2, '#4a4460'); rect(33, 0, 13, 16, 2, '#4a4460');
    noiseTile(34, 40, 34, 60, 8);                         // 34 召喚平台（發光紫邊）
    border(34, '#b45aff');
    rect(34, 2, 2, 12, 1, 'rgba(180,90,255,0.4)'); rect(34, 2, 13, 12, 1, 'rgba(180,90,255,0.4)');
    noiseTile(35, 58, 54, 72, 10);                        // 35 平台基座
    noiseTile(36, 190, 120, 255, 22);                     // 36 紫光燈
    speckle(36, 22, '#f0d8ff');
    noiseTile(37, 255, 180, 70, 22);                      // 37 橘光燈
    speckle(37, 22, '#fff0c0');
    noiseTile(38, 74, 74, 84, 12);                        // 38 鐵砧檯
    rect(38, 2, 2, 12, 3, '#9a9aa8'); rect(38, 5, 6, 6, 8, '#5a5a68');
    clearTile(39);                                        // 39 旗幟（鏤空紫旗）
    rect(39, 7, 0, 2, 16, '#5c4530');
    rect(39, 9, 1, 6, 9, '#7a30c8'); rect(39, 9, 1, 6, 2, '#9a50e8');
    px(39, 11, 4, '#ffd24a'); px(39, 12, 5, '#ffd24a'); px(39, 11, 6, '#ffd24a');
    clearTile(40);                                        // 40 蘑菇（十字）
    rect(40, 6, 8, 4, 8, '#e8e0d0');
    rect(40, 3, 4, 10, 4, '#c84a8a'); rect(40, 4, 3, 8, 2, '#c84a8a');
    px(40, 5, 5, '#f0d0e0'); px(40, 10, 4, '#f0d0e0');
    clearTile(41);                                        // 41 枯枝（十字）
    rect(41, 7, 6, 2, 10, '#7a5c3a');
    rect(41, 3, 4, 4, 1, '#6e4e30'); rect(41, 10, 3, 4, 1, '#6e4e30'); rect(41, 5, 8, 6, 1, '#6e4e30');
    clearTile(42);                                        // 42 星光（十字、發光）
    rect(42, 7, 2, 2, 12, '#e8d8ff'); rect(42, 2, 7, 12, 2, '#e8d8ff');
    rect(42, 5, 5, 6, 6, 'rgba(200,160,255,0.6)'); px(42, 8, 8, '#ffffff');
    noiseTile(43, 120, 116, 128, 14);                     // 43 骷髏石
    rect(43, 3, 4, 3, 3, '#1c1c22'); rect(43, 10, 4, 3, 3, '#1c1c22'); rect(43, 5, 10, 6, 2, '#1c1c22');

    // ---- 44.. 玩家（金甲勇者）與特效 ----
    noiseTile(44, 235, 185, 60, 14);                      // 44 玩家鎧甲（金）
    rect(44, 0, 0, 16, 2, '#f8e0a0'); rect(44, 0, 14, 16, 2, '#b8842a');
    for (let y = 4; y < 14; y += 4) rect(44, 2, y, 12, 1, 'rgba(150,100,30,0.5)');
    noiseTile(45, 240, 205, 160, 8);                      // 45 玩家臉
    rect(45, 3, 5, 3, 3, '#2a2a33'); rect(45, 10, 5, 3, 3, '#2a2a33');
    rect(45, 6, 11, 4, 1, '#a06a50');
    rect(45, 0, 0, 16, 3, '#a8302a');                     // 紅髮瀏海
    noiseTile(46, 168, 42, 38, 12);                       // 46 玩家紅髮（馬尾/後腦）
    rect(46, 0, 0, 16, 2, '#c85048');
    clearTile(47);                                        // 47 金劍（斜）
    for (let i = 0; i < 10; i++) rect(47, 4 + i, 12 - i, 2, 2, i < 2 ? '#8a5c20' : '#f0e0a0');
    for (let i = 2; i < 10; i++) px(47, 4 + i, 13 - i, '#c89a30');
    rect(47, 3, 11, 5, 1, '#e8c93e');
    clearTile(48);                                        // 48 靈魂紫焰
    rect(48, 6, 3, 4, 10, 'rgba(160,80,255,0.85)');
    rect(48, 4, 6, 8, 6, 'rgba(140,60,235,0.75)');
    rect(48, 6, 6, 4, 5, '#e8c8ff'); rect(48, 7, 8, 2, 3, '#ffffff');
    clearTile(49);                                        // 49 orbA 毒彈（綠）
    rect(49, 5, 5, 6, 6, '#58e858'); rect(49, 6, 6, 4, 4, '#c8ffb0'); px(49, 7, 7, '#ffffff');
    clearTile(50);                                        // 50 orbB 電彈（青）
    rect(50, 5, 5, 6, 6, '#48c8ff'); rect(50, 6, 6, 4, 4, '#c0f0ff'); px(50, 8, 7, '#ffffff');
    clearTile(51);                                        // 51 orbBoss 魔王彈（紫紅）
    rect(51, 4, 4, 8, 8, '#e04898'); rect(51, 6, 6, 4, 4, '#ffc0e0'); px(51, 7, 8, '#ffffff');
    clearTile(52);                                        // 52 斬擊特效（白弧）
    { const [ox, oy] = tilePos(52); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ox + 8, oy + 8, 6, -0.8, 0.8); ctx.stroke(); }

    // ---- 64.. 各世界單位皮膚 ----
    // 每世界調色盤：[骨, 殭屍膚, 殭屍衣, 守衛甲, 守A眼, 守B眼, 魔王甲, 魔王眼]
    const PAL = {
      1: { bone: [232, 228, 214], zskin: [123, 160, 90], zcloth: [70, 90, 150], armor: [52, 50, 70], eyeA: '#58e858', eyeB: '#48c8ff', bossA: [70, 40, 46], eyeBoss: '#ff4858' },
      2: { bone: [200, 225, 245], zskin: [150, 190, 200], zcloth: [80, 120, 180], armor: [90, 120, 160], eyeA: '#a0e8ff', eyeB: '#ffffff', bossA: [60, 90, 140], eyeBoss: '#80e0ff' },
      3: { bone: [80, 70, 66], zskin: [150, 70, 45], zcloth: [90, 40, 30], armor: [60, 40, 36], eyeA: '#ffb030', eyeB: '#ff6020', bossA: [90, 30, 20], eyeBoss: '#ffd24a' },
      4: { bone: [190, 200, 150], zskin: [100, 140, 70], zcloth: [60, 80, 40], armor: [56, 72, 48], eyeA: '#b0ff40', eyeB: '#e8ff80', bossA: [50, 70, 36], eyeBoss: '#d0ff50' },
      5: { bone: [150, 130, 190], zskin: [110, 90, 160], zcloth: [50, 40, 90], armor: [40, 32, 66], eyeA: '#c090ff', eyeB: '#fff0a0', bossA: [30, 22, 56], eyeBoss: '#ffffff' },
    };
    for (let w = 1; w <= 5; w++) {
      const p = PAL[w], b = skinBase(w);
      // 骨架：骨白身＋黑眼窩臉＋肋骨線
      noiseTile(b + 0, p.bone[0], p.bone[1], p.bone[2], 10);
      for (let y = 3; y < 13; y += 3) rect(b + 0, 3, y, 10, 1, 'rgba(0,0,0,0.18)');
      noiseTile(b + 1, p.bone[0], p.bone[1], p.bone[2], 8);
      rect(b + 1, 3, 4, 3, 3, '#15151c'); rect(b + 1, 10, 4, 3, 3, '#15151c'); rect(b + 1, 6, 10, 4, 2, '#15151c');
      px(b + 1, 4, 5, w === 3 ? '#ffb030' : '#b45aff'); px(b + 1, 11, 5, w === 3 ? '#ffb030' : '#b45aff');
      // 殭屍：膚＋臉＋衣
      noiseTile(b + 2, p.zskin[0], p.zskin[1], p.zskin[2], 14);
      noiseTile(b + 3, p.zskin[0], p.zskin[1], p.zskin[2], 8);
      rect(b + 3, 3, 4, 3, 3, '#151515'); rect(b + 3, 10, 4, 3, 3, '#151515'); rect(b + 3, 5, 10, 6, 2, '#3a2020');
      noiseTile(b + 4, p.zcloth[0], p.zcloth[1], p.zcloth[2], 14);
      // 守衛（共用甲底、眼色分 A/B）：塊甲＋鉚釘
      const mkGuard = (bt, eye) => {
        noiseTile(bt, p.armor[0], p.armor[1], p.armor[2], 12);
        for (let y = 3; y < 16; y += 4) for (let x = 1; x < 16; x += 5) px(bt, x, y, 'rgba(255,255,255,0.18)');
        noiseTile(bt + 1, p.armor[0], p.armor[1], p.armor[2], 8);
        rect(bt + 1, 3, 5, 10, 2, eye);                    // 發光眼縫
        rect(bt + 1, 5, 10, 6, 1, 'rgba(0,0,0,0.5)');
      };
      mkGuard(b + 5, p.eyeA);
      mkGuard(b + 7, p.eyeB);
      // 魔王：暗甲＋骷髏臉＋裂紋
      noiseTile(b + 9, p.bossA[0], p.bossA[1], p.bossA[2], 12);
      for (let i = 0; i < 8; i++) px(b + 9, (rand() * 16) | 0, (rand() * 16) | 0, p.eyeBoss);
      noiseTile(b + 10, p.bossA[0], p.bossA[1], p.bossA[2], 8);
      rect(b + 10, 2, 4, 4, 4, p.eyeBoss); rect(b + 10, 10, 4, 4, 4, p.eyeBoss);
      rect(b + 10, 5, 11, 6, 3, '#0c0c10'); rect(b + 10, 6, 11, 1, 3, p.eyeBoss); rect(b + 10, 9, 11, 1, 3, p.eyeBoss);
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
