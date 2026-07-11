// 主程式：狀態機、60Hz 固定時步、第三人稱、區塊串流、戰鬥/聖所、HUD 與面板 — 瀏覽器層。
'use strict';

(function () {
  const { B, def, isSolid, tileOf } = MWBlocks;
  const WG = MWWorldgen;
  const { CHUNK, WORLD_H, GY, SANCTUM_SEED, WORLD_SEED, THEMES, BATTLE, SANCTUM } = WG;
  const PH = MWPhysics;
  const UN = SLUnits;
  const GD = SLData;
  const SV = SLSave;
  const SFX = MWAudio.SFX;
  const { UNITS, RARITY, WORLDS, ZONES, BOSS_ADDS, fmt } = GD;

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const renderer = MWRender.createRenderer(canvas);
  if (!renderer) {
    $('loading').style.display = 'none';
    $('error').style.display = 'flex';
    return;
  }
  MWInput.attach(canvas);
  const atlasCv = MWTextures.makeAtlas(); // 2D 圖示用
  const skinBase = MWTextures.skinBase;

  // ---------- 天空主題 ----------
  const SKIES = {
    dusk:  { top: [0.30, 0.12, 0.46], hor: [0.72, 0.42, 0.72], day: 0.88, stars: 0.25, moon: [0.95, 0.9, 1] },
    ice:   { top: [0.22, 0.34, 0.60], hor: [0.70, 0.82, 0.95], day: 0.96, stars: 0.1, moon: [1, 1, 1] },
    ember: { top: [0.22, 0.07, 0.10], hor: [0.85, 0.38, 0.18], day: 0.82, stars: 0.15, moon: [1, 0.8, 0.6] },
    toxic: { top: [0.13, 0.26, 0.18], hor: [0.55, 0.75, 0.45], day: 0.85, stars: 0.15, moon: [0.85, 1, 0.8] },
    void:  { top: [0.05, 0.02, 0.13], hor: [0.28, 0.14, 0.48], day: 0.72, stars: 0.9, moon: [0.9, 0.85, 1] },
  };

  // ---------- 遊戲狀態 ----------
  const VIEW_R = 6;          // 顯示半徑（區塊）
  const GEN_R = VIEW_R + 1;
  const G = {
    state: 'title',          // title | playing | panel | dead | victory
    scene: 'sanctum',        // sanctum | battle
    worldNum: 1,
    world: null,
    save: null,
    player: null,
    units: [], projectiles: [], soulDrops: [], burst: [],
    zoneIdx: 0, zoneKills: 0, bossSpawned: false, bossRef: null,
    dropCount: 0,
    weather: null,
    playedT: 0, autosaveT: 0, unloadT: 0, spawnT: 0, prodAcc: 0,
    attackCool: 0, attackAnim: 0, hurtFlash: 0,
    camDist: 4.6,
    lights: [],
    meshed: new Set(),
    panel: null,
    rand: MWNoise.mulberry32((Math.random() * 1e9) | 0),
  };

  const SPIRAL = [];
  for (let dx = -GEN_R; dx <= GEN_R; dx++) for (let dz = -GEN_R; dz <= GEN_R; dz++) SPIRAL.push([dx, dz]);
  SPIRAL.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));

  // ---------- 存檔 ----------
  function doSave() {
    if (!G.save) return;
    G.save.lastSeen = Date.now();
    SV.saveTo(localStorage, G.save);
  }
  function playerStats() { return GD.playerStats(G.save); }

  // ---------- 場景切換 ----------
  function startScene(scene, worldNum) {
    G.scene = scene;
    G.worldNum = worldNum || 1;
    const seed = scene === 'sanctum' ? SANCTUM_SEED : WORLD_SEED(G.worldNum);
    G.world = new MWWorld.World(seed);
    G.meshed.clear();
    renderer && clearAllMeshes();
    G.units = []; G.projectiles = []; G.soulDrops = []; G.burst = [];
    G.zoneIdx = 0; G.zoneKills = 0; G.bossSpawned = false; G.bossRef = null;
    G.dropCount = 0; G.spawnT = 0;
    G.weather = MWWeather.createWeather(G.rand);

    const st = playerStats();
    const sp = scene === 'sanctum' ? SANCTUM.spawn : BATTLE.spawn;
    G.player = PH.createPlayer(sp[0], sp[1], sp[2]);
    G.player.maxHp = st.hp; G.player.hp = st.hp;
    MWInput.state.yaw = scene === 'sanctum' ? 0 : Math.PI / 2 * 3; // 聖所面向北（yaw=0 朝 -z，看向傳送門）；戰場面向 +x
    MWInput.state.pitch = -0.28;

    buildLights(seed);

    G.summonCool = 0;
    if (scene === 'battle') {
      const party = GD.battleParty(G.save);
      showHint(party.length
        ? `⚔ ${WORLDS[G.worldNum].name}：按「召喚」叫出你的亡靈軍團，讓他們替你打！`
        : `⚔ ${WORLDS[G.worldNum].name}：打倒敵人有機率奪取影子，之後就能召喚亡靈幫你打！`, 6000);
    }
    updateSceneHud();
  }

  function clearAllMeshes() {
    // renderer 沒有清空全部的 API：逐一刪
    for (const key of Array.from(G.meshed)) renderer.deleteChunkMesh(key);
    G.meshed.clear();
  }

  // ---------- 燈光（依場景佈局靜態註冊，取最近 16 盞進 shader） ----------
  function buildLights(seed) {
    G.lights = [];
    if (seed === SANCTUM_SEED) {
      const S = SANCTUM.half;
      for (const [x, z] of [[-S, -S], [S, -S], [-S, S], [S, S]]) G.lights.push([x + 0.5, GY + 3.6, z + 0.5]);
      for (const z of [-12, 12]) for (const x of [-3, 3]) G.lights.push([x + 0.5, GY + 2.6, z + 0.5]);
      G.lights.push([SANCTUM.portal.x + 0.5, GY + 3, SANCTUM.portal.z + 0.5]);
    } else {
      const w = seed - 1000;
      for (let x = 7; x < BATTLE.arena.cx - 6; x += 14) {
        G.lights.push([x + 0.5, GY + 2.6, BATTLE.pathHalf + 1.5]);
        G.lights.push([x + 0.5, GY + 2.6, -BATTLE.pathHalf - 0.5]);
      }
      for (const gx of BATTLE.gates) {
        G.lights.push([gx + 0.5, GY + 5.6, 5.5]);
        G.lights.push([gx + 0.5, GY + 5.6, -4.5]);
      }
      G.lights.push([BATTLE.arena.cx + 0.5, GY + 3, BATTLE.arena.cz + 0.5]);
    }
  }

  // ---------- 區塊串流 ----------
  function chunkWork(budgetMs) {
    const t0 = performance.now();
    const w = G.world;
    const pcx = Math.floor(G.player.x / CHUNK), pcz = Math.floor(G.player.z / CHUNK);
    for (const key of w.dirty) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - pcx) <= VIEW_R && Math.abs(cz - pcz) <= VIEW_R) {
        renderer.setChunkMesh(key, cx, cz, MWMesher.buildChunkMesh(w, cx, cz));
        G.meshed.add(key);
      }
      w.dirty.delete(key);
      if (performance.now() - t0 > budgetMs) return;
    }
    for (const [dx, dz] of SPIRAL) {
      const cx = pcx + dx, cz = pcz + dz;
      const key = w.key(cx, cz);
      const d = Math.max(Math.abs(dx), Math.abs(dz));
      if (!w.hasChunk(cx, cz)) {
        w.getChunk(cx, cz);
        if (performance.now() - t0 > budgetMs) return;
        continue;
      }
      if (d <= VIEW_R && !G.meshed.has(key)) {
        if (w.hasChunk(cx - 1, cz) && w.hasChunk(cx + 1, cz) && w.hasChunk(cx, cz - 1) && w.hasChunk(cx, cz + 1)) {
          renderer.setChunkMesh(key, cx, cz, MWMesher.buildChunkMesh(w, cx, cz));
          G.meshed.add(key);
          if (performance.now() - t0 > budgetMs) return;
        }
      }
    }
  }
  function unloadFar() {
    const pcx = Math.floor(G.player.x / CHUNK), pcz = Math.floor(G.player.z / CHUNK);
    const removed = G.world.unloadBeyond(pcx, pcz, GEN_R + 2);
    for (const key of removed) { renderer.deleteChunkMesh(key); G.meshed.delete(key); }
  }

  // ---------- 敵人生成 ----------
  function currentZoneCfg() {
    return G.zoneIdx < 3 ? ZONES[G.zoneIdx] : BOSS_ADDS;
  }
  function aliveEnemies() { return G.units.filter(u => u.faction === 'enemy' && u.hp > 0 && !u.boss).length; }

  function spawnEnemies(dt) {
    if (G.scene !== 'battle') return;
    G.spawnT -= dt;
    if (G.spawnT > 0) return;
    G.spawnT = 0.6;
    const w = G.worldNum;
    if (G.zoneIdx < 3) {
      const cfg = ZONES[G.zoneIdx];
      const alive = aliveEnemies();
      if (alive >= cfg.max) return;
      if (G.zoneKills + alive >= cfg.need) return; // 不超量生成
      const [x0, x1] = BATTLE.zones[G.zoneIdx];
      // 出生在區域內、玩家前方附近
      const px = Math.max(x0, Math.min(x1, G.player.x));
      const sx = Math.max(x0, Math.min(x1, px + 6 + G.rand() * 18));
      const sz = (G.rand() * 2 - 1) * (BATTLE.pathHalf - 1.5);
      const arch = cfg.pool[(G.rand() * cfg.pool.length) | 0];
      G.units.push(UN.makeUnit('w' + w + '_' + arch, sx + 0.5, GY + 1.1, sz + 0.5, 'enemy'));
    } else if (G.bossSpawned && G.bossRef && G.bossRef.hp > 0) {
      // 魔王戰小怪
      if (aliveEnemies() >= BOSS_ADDS.max) return;
      const a = G.rand() * Math.PI * 2;
      const arch = BOSS_ADDS.pool[(G.rand() * BOSS_ADDS.pool.length) | 0];
      G.units.push(UN.makeUnit('w' + w + '_' + arch,
        BATTLE.arena.cx + Math.cos(a) * 10, GY + 1.1, BATTLE.arena.cz + Math.sin(a) * 10, 'enemy'));
    }
  }

  // 區域閘門開啟
  function openGate(gi) {
    const gx = BATTLE.gates[gi];
    for (let z = -4; z <= 4; z++) {
      for (let y = GY + 1; y <= GY + 4; y++) {
        if (G.world.getBlock(gx, y, z) === B.GATEBAR) G.world.setBlock(gx, y, z, B.AIR);
      }
    }
    SFX.victory();
    showHint('✅ 區域清除！閘門開啟，繼續前進 →', 4000);
  }

  // ---------- 召喚亡靈 ----------
  function summonParty(quiet) {
    if (G.scene !== 'battle' || G.state !== 'playing' || G.summonCool > 0) return;
    const party = GD.battleParty(G.save);
    if (!party.length) { if (!quiet) showHint('還沒有亡靈可以召喚——先打倒敵人「奪取」他們的影子！', 3500); return; }
    // 找出缺席的名額（同種可疊，用多重集差集）
    const need = {};
    for (const id of party) need[id] = (need[id] || 0) + 1;
    for (const u of G.units) {
      if (u.faction === 'ally' && u.hp > 0 && need[u.unitId]) need[u.unitId]--;
    }
    const spawnList = [];
    for (const id in need) for (let i = 0; i < need[id]; i++) spawnList.push(id);
    if (!spawnList.length) { if (!quiet) showHint('軍團已全數在場，殺啊！', 2500); return; }
    G.summonCool = 6;
    const p = G.player;
    for (let i = 0; i < spawnList.length; i++) {
      const a = (i / spawnList.length) * Math.PI * 2 + G.rand() * 0.5;
      const x = p.x + Math.cos(a) * 2.2, z = p.z + Math.sin(a) * 2.2;
      const u = UN.makeUnit(spawnList[i], x, p.y + 0.1, z, 'ally');
      u.yaw = p.yaw;
      G.units.push(u);
      spawnBurst(x, p.y + 1, z, 48, 10, 3.5); // 紫焰召喚特效
    }
    SFX.magic();
    SFX.zombie();
    showHint(`👻 召喚 ${spawnList.length} 名亡靈參戰！`, 2500);
  }

  // ---------- 戰鬥 ----------
  function playerAttack() {
    if (G.attackCool > 0) return;
    G.attackCool = 0.45;
    G.attackAnim = 1;
    const p = G.player;
    const st = playerStats();
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let hitAny = false;
    for (const u of G.units) {
      if (u.faction !== 'enemy' || u.hp <= 0) continue;
      const dx = u.x - p.x, dz = u.z - p.z;
      const d = Math.hypot(dx, dz);
      const reach = 2.8 + (u.scale - 1);
      if (d > reach) continue;
      if ((dx * fx + dz * fz) / (d || 1) < 0.35) continue; // 約 ±70° 扇形
      UN.hurtUnit(u, st.dmg, dx, dz);
      hitAny = true;
      spawnBurst(u.x, u.y + 1.2, u.z, 52, 5, 2.5);
    }
    if (hitAny) SFX.attackHit(); else SFX.throwWhoosh();
  }

  function damagePlayer(dmg, src) {
    const p = G.player;
    if (p.hurtCool > 0 || dmg <= 0 || p.hp <= 0) return;
    p.hp -= dmg;
    p.hurtCool = 0.55;
    G.sinceHurt = 0;
    G.hurtFlash = 0.35;
    SFX.hurt();
    if (src) {
      const dx = p.x - src.x, dz = p.z - src.z, l = Math.hypot(dx, dz) || 1;
      p.vx += dx / l * 6; p.vz += dz / l * 6; p.vy = 4.5;
    }
    if (p.hp <= 0) onDeath();
  }

  function onDeath() {
    SFX.die();
    G.state = 'dead';
    MWInput.releaseLock();
    $('death').style.display = 'flex';
    doSave();
  }

  // 擊殺獎勵：靈魂掉落＋奪取判定
  function onEnemyKilled(u) {
    const unit = UNITS[u.unitId];
    if (!unit) return;
    G.save.stats.kills = (G.save.stats.kills || 0) + 1;
    const st = playerStats();
    const total = Math.max(1, Math.round(unit.soul * st.soulMul));
    const n = unit.boss ? 8 : (2 + ((G.rand() * 3) | 0));
    for (let i = 0; i < n; i++) {
      const s = UN.makeSoul(u.x, u.y + 1, u.z, Math.max(1, Math.round(total / n)), G.rand);
      G.soulDrops.push(s);
    }
    // 奪取
    const first = unit.boss && !G.save.bossKilled[unit.world];
    const chance = GD.captureChance(u.unitId, G.save, first);
    if (G.rand() < chance) {
      G.save.collection[u.unitId] = (G.save.collection[u.unitId] || 0) + 1;
      G.save.stats.captures = (G.save.stats.captures || 0) + 1;
      SFX.magic();
      spawnBurst(u.x, u.y + 1.4, u.z, 48, 14, 4);
      showHint(`👻 奪取成功！${unit.name} 加入你的陰影軍團`, 3500);
      addFloater(u.x, u.y + 2.2, u.z, '👻 奪取！', '#d8a8ff');
    }
    // 魔王擊殺 → 過關
    if (u.boss) onBossKilled(unit);
  }

  function onBossKilled(unit) {
    const w = unit.world;
    G.save.bossKilled[w] = true;
    if (w < GD.WORLD_COUNT) G.save.maxWorld = Math.max(G.save.maxWorld || 1, w + 1);
    doSave();
    SFX.victory();
    setTimeout(() => {
      if (G.state !== 'playing') return;
      G.state = 'victory';
      MWInput.releaseLock();
      $('victory-title').textContent = `🏆 ${WORLDS[w].name}　制霸！`;
      $('victory-text').textContent = w < GD.WORLD_COUNT
        ? `你打敗了 ${unit.name}！已解鎖下一個世界：${WORLDS[w + 1].name}`
        : `你打敗了 ${unit.name}！五個世界全部制霸——商店裡的「重生」已解鎖！`;
      $('victory').style.display = 'flex';
    }, 900);
  }

  // ---------- 粒子與浮字 ----------
  function spawnBurst(x, y, z, tile, n, spread) {
    const s = spread || 3;
    for (let i = 0; i < n; i++) {
      G.burst.push({
        x, y, z, tile,
        vx: (Math.random() - 0.5) * s, vy: Math.random() * s * 0.8 + 1, vz: (Math.random() - 0.5) * s,
        size: 0.10 + Math.random() * 0.1,
        life: 0.5 + Math.random() * 0.4,
      });
    }
  }

  const floaters = [];
  function addFloater(x, y, z, text, color) {
    floaters.push({ x, y, z, text, color: color || '#c8a8ff', t: 0 });
    if (floaters.length > 14) floaters.shift();
  }

  // ---------- 自動戰鬥 ----------
  function autoSteer(axes) {
    if (G.scene !== 'battle') return axes;
    const p = G.player;
    if (G.summonCool <= 0) summonParty(true); // 自動模式自動補召亡靈（安靜）
    // 目標：最近敵人 > 閘門/競技場
    let tx = null, tz = null, best = 60;
    for (const u of G.units) {
      if (u.faction !== 'enemy' || u.hp <= 0) continue;
      const d = Math.hypot(u.x - p.x, u.z - p.z);
      if (d < best) { best = d; tx = u.x; tz = u.z; }
    }
    if (tx === null) {
      if (G.zoneIdx < 3) { tx = BATTLE.gates[G.zoneIdx] + 3; tz = 0; }
      else { tx = BATTLE.arena.cx; tz = BATTLE.arena.cz; }
    }
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d > (best < 60 ? 2.2 : 1.5)) {
      // 轉向目標並前進
      MWInput.state.yaw = Math.atan2(-dx, -dz);
      return { mf: 1, ms: 0, run: d > 8 };
    }
    if (best < 3.2) playerAttack();
    return { mf: 0, ms: 0, run: false };
  }

  // ---------- 主邏輯（60Hz） ----------
  function tick(dt) {
    if (G.state !== 'playing') return;
    const p = G.player, w = G.world, inp = MWInput.state;

    G.playedT += dt;
    G.autosaveT += dt;
    if (G.autosaveT > 10) { G.autosaveT = 0; doSave(); }
    G.unloadT += dt;
    if (G.unloadT > 5) { G.unloadT = 0; unloadFar(); }
    if (G.hurtFlash > 0) G.hurtFlash -= dt;
    if (p.hurtCool > 0) p.hurtCool -= dt;
    if (G.attackCool > 0) G.attackCool -= dt;
    if (G.attackAnim > 0) G.attackAnim -= dt * 2.4;
    if (G.summonCool > 0) G.summonCool -= dt;

    // 脫戰回血：4 秒沒受傷 → 每秒回 4% 最大生命（聖所加倍）
    G.sinceHurt = (G.sinceHurt || 0) + dt;
    if (p.hp > 0 && p.hp < p.maxHp && G.sinceHurt > 4) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (G.scene === 'sanctum' ? 0.12 : 0.04) * dt);
    }

    if (G.weather) MWWeather.stepWeather(G.weather, dt, G.rand);

    // 聖所：軍團產出
    if (G.scene === 'sanctum') {
      const st = playerStats();
      G.prodAcc += GD.productionPerSec(G.save) * st.soulMul * dt;
      if (G.prodAcc >= 1) {
        const add = Math.floor(G.prodAcc);
        G.prodAcc -= add;
        G.save.souls += add;
        G.save.stats.soulsEarned = (G.save.stats.soulsEarned || 0) + add;
      }
    }

    // 移動（自動模式時合成輸入）
    let axes = MWInput.moveAxes();
    if (G.save.settings.auto && G.scene === 'battle') axes = autoSteer(axes);
    p.yaw = inp.yaw; p.pitch = inp.pitch;
    PH.stepPlayer(p, w, {
      mf: axes.mf, ms: axes.ms, run: axes.run,
      jump: inp.keys.has('Space'),
      up: false, down: false,
    }, dt, 'battle');
    if (p.y < -12) { // 掉出地圖：拉回
      const sp = G.scene === 'sanctum' ? SANCTUM.spawn : BATTLE.spawn;
      p.x = sp[0]; p.y = sp[1]; p.z = sp[2]; p.vx = p.vy = p.vz = 0;
    }

    // 攻擊（點擊/按鈕/連按住）
    if (inp.transient.leftClick || inp.mouseDown[0]) {
      if (G.scene === 'battle') playerAttack();
      inp.transient.leftClick = false;
    }

    // 碎屑粒子
    if (G.burst.length) {
      for (const b of G.burst) {
        b.life -= dt;
        b.vy -= 18 * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      }
      G.burst = G.burst.filter(b => b.life > 0);
    }

    if (G.scene === 'battle') tickBattle(dt);
    else tickSanctum(dt);

    // 浮字
    for (const f of floaters) f.t += dt;
    while (floaters.length && floaters[0].t > 1.1) floaters.shift();

    MWInput.clearTransient();
    updateHud();
  }

  function tickSanctum(dt) {
    const p = G.player;
    // 走近傳送門 → 開世界選單
    const P = SANCTUM.portal;
    const d = Math.hypot(p.x - (P.x + 0.5), p.z - (P.z + 1.5));
    if (d < 2.2 && G.state === 'playing') {
      p.z = P.z + 3.5; p.vx = 0; p.vz = 0; // 退後避免重複觸發
      openPanel('worldsel');
    }
  }

  function tickBattle(dt) {
    const p = G.player;
    spawnEnemies(dt);

    // 魔王觸發：踏進競技場
    if (G.zoneIdx >= 3 && !G.bossSpawned) {
      const a = BATTLE.arena;
      if (Math.hypot(p.x - a.cx, p.z - a.cz) < a.r - 2) {
        const boss = UN.makeUnit('w' + G.worldNum + '_boss', BATTLE.bossAt[0], BATTLE.bossAt[1], BATTLE.bossAt[2], 'enemy');
        G.units.push(boss);
        G.bossSpawned = true;
        G.bossRef = boss;
        SFX.zombie();
        showHint(`💀 ${UNITS['w' + G.worldNum + '_boss'].name} 現身了！`, 5000);
      }
    }

    // 單位
    const ctx = { player: p.hp > 0 ? p : null, units: G.units };
    const events = [];
    for (const u of G.units) {
      UN.stepUnit(u, G.world, dt, ctx, G.rand, events);
      // 友軍離太遠 → 瞬移到玩家旁（跟上進度）
      if (u.faction === 'ally' && u.hp > 0 && Math.hypot(u.x - p.x, u.z - p.z) > 26) {
        u.x = p.x + (G.rand() * 2 - 1) * 2; u.z = p.z + (G.rand() * 2 - 1) * 2; u.y = p.y + 0.1;
      }
    }
    for (const e of events) {
      if (e.type === 'hitplayer') damagePlayer(e.dmg, e);
      else if (e.type === 'hitunit') UN.hurtUnit(e.unit, e.dmg, e.kx, e.kz);
      else if (e.type === 'shoot') {
        G.projectiles.push(UN.makeProjectile(e.proj, e.x, e.y, e.z, e.dx, e.dy, e.dz, e.dmg, e.faction));
        SFX.magic();
      } else if (e.type === 'die') {
        if (e.unit.faction === 'enemy') {
          if (!e.unit.boss) {
            if (G.zoneIdx < 3) G.zoneKills++;
          }
          onEnemyKilled(e.unit);
        }
      }
    }
    G.units = G.units.filter(u => !u.dead);

    // 區域通關：開門
    if (G.zoneIdx < 3 && G.zoneKills >= ZONES[G.zoneIdx].need && !G['gateOpen' + G.zoneIdx]) {
      G['gateOpen' + G.zoneIdx] = true;
      openGate(G.zoneIdx);
    }
    // 穿過閘門 → 下一區域
    if (G.zoneIdx < 3 && G['gateOpen' + G.zoneIdx] && p.x > BATTLE.gates[G.zoneIdx] + 1) {
      G.zoneIdx++;
      G.zoneKills = 0;
      if (G.zoneIdx < 3) showHint(`ZONE ${G.zoneIdx + 1}/3`, 2500);
      else showHint('☠ 前方就是魔王競技場！', 3500);
    }

    // 投射物
    if (G.projectiles.length) {
      const pev = [];
      for (const pr of G.projectiles) UN.stepProjectile(pr, G.world, dt, ctx, pev);
      for (const e of pev) {
        if (e.type === 'projhitplayer') damagePlayer(e.dmg, e);
        else if (e.type === 'projhitunit') UN.hurtUnit(e.unit, e.dmg, e.kx, e.kz);
      }
      G.projectiles = G.projectiles.filter(pr => !pr.dead);
    }

    // 靈魂掉落
    for (const s of G.soulDrops) {
      if (UN.stepSoul(s, G.world, dt, p) === 'pickup') {
        G.save.souls += s.amount;
        G.save.stats.soulsEarned = (G.save.stats.soulsEarned || 0) + s.amount;
        G.dropCount++;
        SFX.pickup();
        addFloater(s.x, s.y + 0.8, s.z, '+' + fmt(s.amount), '#c890ff');
      }
    }
    G.soulDrops = G.soulDrops.filter(s => !s.dead);
  }

  // ---------- 第三人稱鏡頭 ----------
  function cameraPos() {
    const p = G.player;
    const eye = [p.x, p.y + 1.55, p.z];
    const dir = PH.lookDir(p.yaw, p.pitch);
    // 從眼睛向後退 camDist，撞牆就縮
    let d = G.camDist;
    const back = [-dir[0], -dir[1], -dir[2]];
    const hit = PH.raycast(G.world, eye[0], eye[1], eye[2], back[0], back[1], back[2], d + 0.4);
    if (hit.hit) d = Math.max(0.6, hit.dist - 0.4);
    return {
      x: eye[0] + back[0] * d,
      y: Math.min(WORLD_H - 1, eye[1] + back[1] * d + 0.15),
      z: eye[2] + back[2] * d,
      yaw: p.yaw, pitch: p.pitch,
    };
  }

  // ---------- 渲染 ----------
  let camNow = null;
  function renderFrame() {
    if (!G.world || !G.player) return;
    chunkWork(G.meshed.size < 20 ? 50 : 7);

    const p = G.player;
    const theme = G.scene === 'sanctum' ? SKIES.dusk : SKIES[WORLDS[G.worldNum].sky];
    const wthr = G.weather || { precip: 0, cloud: 0.3, gloom: 0, type: 'clear' };
    const gloom = wthr.gloom * 0.7;
    const darken = (c, k) => c.map(v => v * (1 - gloom * k));
    const skyTop = darken(theme.top, 0.5);
    const skyHor = darken(theme.hor, 0.5);
    const fogFar = 95 - wthr.precip * 25, fogNear = 60 - wthr.precip * 15;
    const cam = camNow = cameraPos();

    // 最近 16 盞燈
    const near = [];
    for (const v of G.lights) {
      const d = (v[0] - p.x) * (v[0] - p.x) + (v[2] - p.z) * (v[2] - p.z);
      if (d < 3600) near.push([d, v]);
    }
    near.sort((a, b) => a[0] - b[0]);
    const lc = Math.min(16, near.length);
    const lights = new Float32Array(48);
    for (let i = 0; i < lc; i++) {
      lights[i * 3] = near[i][1][0]; lights[i * 3 + 1] = near[i][1][1]; lights[i * 3 + 2] = near[i][1][2];
    }

    // 場景實體
    const mobs = [];
    // 玩家
    mobs.push({
      type: 'player', x: p.x, y: p.y, z: p.z, yaw: p.yaw,
      anim: Math.hypot(p.vx, p.vz) > 0.4 ? G.playedT * Math.hypot(p.vx, p.vz) * 0.55 : 0,
      attack: Math.max(0, G.attackAnim),
      hurtT: p.hurtCool > 0.3 ? 1 : 0, deathT: 0, scale: 1, light: 1,
    });
    // 戰鬥單位
    for (const u of G.units) {
      mobs.push({
        type: u.skin + u.world, x: u.x, y: u.y, z: u.z, yaw: u.yaw, anim: u.anim,
        attack: Math.max(0, u.attack || 0),
        hurtT: u.hurtT, deathT: u.deathT, scale: u.scale, light: 1,
      });
    }
    // 聖所平台展示單位
    if (G.scene === 'sanctum') {
      const show = GD.platformUnits(G.save, SANCTUM.platforms.length);
      for (let i = 0; i < show.length; i++) {
        const u = UNITS[show[i]];
        const [px, pz] = SANCTUM.platforms[i];
        mobs.push({
          type: u.skin + u.world, x: px + 0.5, y: GY + 1.3, z: pz + 0.5,
          yaw: px < 0 ? Math.PI / 2 : -Math.PI / 2, // 面向中央走道
          anim: Math.sin(G.playedT * 0.8 + i) * 0.14,
          attack: 0, hurtT: 0, deathT: 0, scale: u.scale || 1, light: 1,
        });
      }
    }

    // 掉落層：靈魂紫焰＋投射物＋碎屑
    const drops = [];
    for (const s of G.soulDrops) {
      drops.push({ x: s.x, y: s.y, z: s.z, spin: s.age * 2, tile: 48, light: 1, scale: 0.34 });
    }
    const PROJ_TILE = { orbA: 49, orbB: 50, orbBoss: 51 };
    for (const pr of G.projectiles) {
      drops.push({ x: pr.x, y: pr.y - 0.2, z: pr.z, spin: pr.spin, tile: PROJ_TILE[pr.type] || 49, light: 1, scale: 0.4, flash: 0.25 });
    }
    for (const b of G.burst) {
      drops.push({ x: b.x, y: b.y, z: b.z, spin: 0, tile: b.tile, light: 1, scale: b.size });
    }

    renderer.render({
      cam,
      fovY: 1.15,
      day: Math.min(1, theme.day * (1 - gloom * 0.4)),
      skyTop, skyHorizon: skyHor,
      fogColor: skyHor.slice(), fogNear, fogFar,
      starAlpha: theme.stars,
      underwater: false,
      glow: 0.8,
      cloudOffset: G.playedT * 1.2,
      weather: { precip: wthr.precip, snow: G.scene === 'battle' && G.worldNum === 2, cloud: wthr.cloud, time: G.playedT, flash: 0 },
      billboards: [
        { dir: norm3([0.4, 0.55, -0.5]), size: 26, color: [theme.moon[0], theme.moon[1], theme.moon[2], 0.95] },
      ],
      sel: null, crack: null,
      lights, lightCount: lc,
      drops, mobs,
    });

    updateLabels(cam);
    $('overlay-hurt').style.opacity = G.hurtFlash > 0 ? 1 : 0;
  }

  function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  // ---------- 世界座標 → 螢幕投影（HTML 名牌/血條/浮字） ----------
  function project(cam, x, y, z, W, H) {
    const fovY = 1.15;
    let dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    // rotY(-yaw)
    let c = Math.cos(-cam.yaw), s = Math.sin(-cam.yaw);
    let ax = c * dx + s * dz, az = -s * dx + c * dz, ay = dy;
    // rotX(-pitch)
    c = Math.cos(-cam.pitch); s = Math.sin(-cam.pitch);
    const by = c * ay - s * az, bz = s * ay + c * az;
    if (bz > -0.2) return null; // 在鏡頭後方
    const f = 1 / Math.tan(fovY / 2);
    const aspect = W / H;
    const sx = (f / aspect * ax) / -bz, sy = (f * by) / -bz;
    return { x: (sx * 0.5 + 0.5) * W, y: (0.5 - sy * 0.5) * H, dist: Math.hypot(dx, dy, dz) };
  }

  // 名牌池
  const LABEL_MAX = 26;
  const labelPool = [];
  function initLabels() {
    const wrap = $('labels');
    for (let i = 0; i < LABEL_MAX; i++) {
      const div = document.createElement('div');
      div.className = 'wlabel';
      div.style.display = 'none';
      div.innerHTML = '<div class="wl-name"></div><div class="wl-bar"><div class="wl-fill"></div></div><div class="wl-sub"></div>';
      wrap.appendChild(div);
      labelPool.push(div);
    }
  }

  function updateLabels(cam) {
    const W = window.innerWidth, H = window.innerHeight;
    let li = 0;
    const use = (x, y, z, name, nameColor, hpFrac, barColor, sub) => {
      if (li >= LABEL_MAX) return;
      const pt = project(cam, x, y, z, W, H);
      if (!pt || pt.dist > 42) return;
      const div = labelPool[li++];
      div.style.display = 'block';
      div.style.left = pt.x + 'px';
      div.style.top = pt.y + 'px';
      const nameEl = div.children[0], barEl = div.children[1], subEl = div.children[2];
      nameEl.textContent = name;
      nameEl.style.color = nameColor || '#fff';
      if (hpFrac !== null) {
        barEl.style.display = 'block';
        barEl.children[0].style.width = Math.max(0, Math.min(100, hpFrac * 100)) + '%';
        barEl.children[0].style.background = barColor || '#e04040';
      } else barEl.style.display = 'none';
      subEl.textContent = sub || '';
      subEl.style.display = sub ? 'block' : 'none';
    };

    if (G.state === 'playing' || G.state === 'panel') {
      // 戰鬥單位名牌
      for (const u of G.units) {
        if (u.hp <= 0) continue;
        const unit = UNITS[u.unitId];
        const rar = RARITY[unit.rarity];
        if (u.faction === 'enemy') {
          use(u.x, u.y + u.hh + 0.55, u.z, `${rar.name}・${u.name}`, rar.color, u.hp / u.maxHp,
            unit.rarity === 'common' ? '#e04040' : '#3a7dff', null);
        } else {
          use(u.x, u.y + u.hh + 0.4, u.z, u.name, '#a8e8a8', u.hp / u.maxHp, '#58c858', null);
        }
      }
      // 聖所平台名牌（名稱＋數量＋產出）
      if (G.scene === 'sanctum') {
        const show = GD.platformUnits(G.save, SANCTUM.platforms.length);
        for (let i = 0; i < show.length; i++) {
          const u = UNITS[show[i]];
          const cnt = G.save.collection[show[i]];
          const [px, pz] = SANCTUM.platforms[i];
          use(px + 0.5, GY + 3.6, pz + 0.5, `${cnt} 隻 ${u.name}`, RARITY[u.rarity].color, null, null,
            `${fmt(u.prod * cnt * 100) / 100 || (u.prod * cnt).toFixed(1)}/s`);
        }
      }
      // 浮字
      for (const f of floaters) {
        if (li >= LABEL_MAX) break;
        const pt = project(cam, f.x, f.y + f.t * 1.2, f.z, W, H);
        if (!pt || pt.dist > 42) continue;
        const div = labelPool[li++];
        div.style.display = 'block';
        div.style.left = pt.x + 'px';
        div.style.top = pt.y + 'px';
        div.children[0].textContent = f.text;
        div.children[0].style.color = f.color;
        div.children[1].style.display = 'none';
        div.children[2].style.display = 'none';
        div.style.opacity = Math.max(0, 1 - f.t);
      }
    }
    for (; li < LABEL_MAX; li++) { labelPool[li].style.display = 'none'; labelPool[li].style.opacity = 1; }
  }

  // ---------- HUD ----------
  let hudT = 0;
  function updateHud() {
    hudT++;
    if (hudT % 6 !== 0) return;
    const p = G.player, st = playerStats();
    $('souls-count').textContent = fmt(G.save.souls);
    const prod = GD.productionPerSec(G.save) * st.soulMul;
    $('prod-rate').textContent = G.scene === 'sanctum' && prod > 0 ? `+${prod.toFixed(1)}/s` : '';
    // HP
    $('hp-fill').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    $('hp-text').textContent = `${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`;
    // 稱號
    const t = GD.TITLES.find(x => x.id === G.save.title);
    $('title-pill').textContent = `🏅 ${t ? t.name : ''}・重生 ${G.save.rebirths || 0}`;
    if (G.scene === 'battle') {
      $('drop-label').textContent = `掉落數（${G.dropCount}）`;
      // 召喚鈕冷卻
      const sb = $('btn-summon');
      if (G.summonCool > 0) {
        sb.disabled = true;
        sb.children[1].textContent = Math.ceil(G.summonCool) + 's';
      } else {
        sb.disabled = false;
        sb.children[1].textContent = '召喚';
      }
      // 區域節點
      for (let i = 0; i < 4; i++) {
        const node = $('zn' + i);
        node.className = 'zone-node' + (i < G.zoneIdx ? ' done' : i === G.zoneIdx ? ' cur' : '');
      }
      $('zone-progress').textContent = G.zoneIdx < 3
        ? `${WORLDS[G.worldNum].name}　擊殺 ${G.zoneKills}/${ZONES[G.zoneIdx].need}`
        : (G.bossSpawned && G.bossRef && G.bossRef.hp > 0 ? '☠ 魔王戰！' : `${WORLDS[G.worldNum].name}　前往魔王競技場 →`);
      // 魔王血條
      if (G.bossSpawned && G.bossRef && G.bossRef.hp > 0) {
        $('bossbar').style.display = 'block';
        $('bossbar-name').textContent = G.bossRef.name;
        $('bossbar-fill').style.width = Math.max(0, G.bossRef.hp / G.bossRef.maxHp * 100) + '%';
      } else $('bossbar').style.display = 'none';
    } else {
      // 天氣倒數
      const wt = G.weather ? Math.max(0, G.weather.timer) : 0;
      const mm = String(Math.floor(wt / 60)).padStart(2, '0'), ss = String(Math.floor(wt % 60)).padStart(2, '0');
      $('weather-time').textContent = `${mm}:${ss}`;
      $('weather-fx').textContent = MWWeather.weatherLabel(G.weather) || '☀ 晴';
    }
  }

  function updateSceneHud() {
    const battle = G.scene === 'battle';
    $('zonebar').style.display = battle ? 'flex' : 'none';
    $('zone-progress').style.display = battle ? 'block' : 'none';
    $('battle-controls').style.display = battle ? 'flex' : 'none';
    $('btn-summon').style.display = battle ? 'flex' : 'none';
    $('weather-pill').style.display = battle ? 'none' : 'flex';
    $('btn-gate').style.display = battle ? 'none' : 'block';
    $('bossbar').style.display = 'none';
    $('btn-auto').textContent = G.save.settings.auto ? '自動開啟' : '自動關閉';
    $('btn-auto').classList.toggle('on', !!G.save.settings.auto);
  }

  let hintTimer = 0;
  function showHint(msg, dur) {
    $('hint').textContent = msg;
    $('hint').classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => $('hint').classList.remove('show'), dur || 4000);
  }

  // ---------- 2D 圖示（單位臉） ----------
  function faceTileOf(unit) {
    const b = skinBase(unit.world);
    return { skel: b + 1, zomb: b + 3, guardA: b + 6, guardB: b + 8, boss: b + 10 }[unit.arch];
  }
  function drawFace(cv, unit) {
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const t = faceTileOf(unit);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(atlasCv, (t % 16) * 16, Math.floor(t / 16) * 16, 16, 16, 0, 0, cv.width, cv.height);
  }

  // ---------- 面板 ----------
  function openPanel(name) {
    if (G.state !== 'playing') return;
    G.state = 'panel';
    G.panel = name;
    MWInput.releaseLock();
    $(name).style.display = 'flex';
    if (name === 'shop') refreshShop();
    if (name === 'army') refreshArmy();
    if (name === 'index') refreshIndex();
    if (name === 'titles') refreshTitles();
    if (name === 'worldsel') refreshWorldsel();
  }
  function closePanel() {
    if (G.panel) $(G.panel).style.display = 'none';
    G.panel = null;
    G.state = 'playing';
    doSave();
    if (!MWInput.isTouch) MWInput.requestLock();
  }

  function refreshShop() {
    const list = $('shop-list');
    list.innerHTML = '';
    for (const key in GD.UPGRADES) {
      const u = GD.UPGRADES[key];
      const lvl = G.save.upgrades[key] || 0;
      const cost = GD.upgradeCost(key, lvl);
      const maxed = lvl >= u.max;
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `<span class="s-ico">${u.icon}</span>
        <span class="s-info"><b>${u.name}</b> <em>Lv.${lvl}${maxed ? '（滿級）' : ''}</em><br><small>${u.desc}</small></span>`;
      const btn = document.createElement('button');
      btn.textContent = maxed ? '已滿級' : `🔥 ${fmt(cost)}`;
      btn.disabled = maxed || G.save.souls < cost;
      btn.addEventListener('click', () => {
        if (G.save.souls < cost || maxed) return;
        G.save.souls -= cost;
        G.save.upgrades[key] = lvl + 1;
        // 加血立即生效
        const st = playerStats();
        G.player.maxHp = st.hp;
        G.player.hp = Math.min(G.player.hp + Math.round(st.hp * 0.2), st.hp);
        SFX.craft();
        doSave();
        refreshShop();
        updateHud();
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
    // 重生
    const rb = $('rebirth-row');
    const can = GD.canRebirth(G.save);
    $('rebirth-desc').textContent = can
      ? `重生會重置靈魂與商店升級（保留軍團與圖鑑），永久獲得：靈魂 +100%、攻擊 +25%。目前重生次數：${G.save.rebirths || 0}`
      : `打敗 ${WORLDS[5].name} 的魔王後解鎖重生。目前重生次數：${G.save.rebirths || 0}`;
    $('btn-rebirth').disabled = !can;
  }

  function unitCard(id, owned, cnt) {
    const u = UNITS[id];
    const rar = RARITY[u.rarity];
    const card = document.createElement('div');
    card.className = 'ucard' + (owned ? '' : ' locked');
    card.style.borderColor = owned ? rar.color : '#333a4a';
    const cv = document.createElement('canvas');
    cv.width = 40; cv.height = 40;
    if (owned) drawFace(cv, u);
    card.appendChild(cv);
    const info = document.createElement('div');
    info.className = 'u-info';
    info.innerHTML = owned
      ? `<b style="color:${rar.color}">${u.name}</b><small>${rar.name}・W${u.world}${cnt !== undefined ? '・×' + cnt : ''}</small><small>${u.prod}/s・攻 ${fmt(u.dmg)}</small>`
      : `<b>？？？</b><small>${rar.name}・W${u.world}</small><small>尚未奪取</small>`;
    card.appendChild(info);
    return card;
  }

  function refreshArmy() {
    const st = playerStats();
    $('army-sub').textContent = `收藏 ${GD.collectionSize(G.save)} 隻・出戰上限 ${st.armyMax}・全軍產出 ${(GD.productionPerSec(G.save) * st.soulMul).toFixed(1)} 靈魂/s`;
    const grid = $('army-grid');
    grid.innerHTML = '';
    const party = GD.battleParty(G.save);
    const partyCount = {};
    for (const id of party) partyCount[id] = (partyCount[id] || 0) + 1;
    const owned = Object.keys(G.save.collection).filter(k => G.save.collection[k] > 0 && UNITS[k]);
    owned.sort((a, b) => GD.UNIT_ORDER.indexOf(a) - GD.UNIT_ORDER.indexOf(b));
    if (!owned.length) {
      grid.innerHTML = '<p class="tip">還沒有奪取任何影子——進入閘口打倒敵人，有機率把他們的影子收為己用！</p>';
      return;
    }
    for (const id of owned) {
      const card = unitCard(id, true, G.save.collection[id]);
      if (partyCount[id]) {
        const tag = document.createElement('span');
        tag.className = 'party-tag';
        tag.textContent = `出戰×${partyCount[id]}`;
        card.appendChild(tag);
      }
      grid.appendChild(card);
    }
  }

  function refreshIndex() {
    const grid = $('index-grid');
    grid.innerHTML = '';
    let found = 0;
    for (const id of GD.UNIT_ORDER) {
      const owned = (G.save.collection[id] || 0) > 0 ||
        (UNITS[id].boss && G.save.bossKilled[UNITS[id].world]); // 打過魔王也算圖鑑登錄
      if (owned) found++;
      grid.appendChild(unitCard(id, owned, G.save.collection[id]));
    }
    $('index-sub').textContent = `已發現 ${found}/${GD.UNIT_ORDER.length}`;
  }

  function refreshTitles() {
    const list = $('titles-list');
    list.innerHTML = '';
    const unlocked = new Set(GD.unlockedTitles(G.save).map(t => t.id));
    for (const t of GD.TITLES) {
      const row = document.createElement('div');
      const has = unlocked.has(t.id);
      row.className = 'title-row' + (has ? '' : ' locked') + (G.save.title === t.id ? ' equipped' : '');
      row.innerHTML = `<b>${has ? t.name : '？？？'}</b><small>${t.desc}</small>`;
      if (has) {
        row.addEventListener('click', () => {
          G.save.title = t.id;
          SFX.click();
          doSave();
          refreshTitles();
          updateHud();
        });
      }
      list.appendChild(row);
    }
  }

  function refreshWorldsel() {
    const list = $('worldsel-list');
    list.innerHTML = '';
    for (let w = 1; w <= GD.WORLD_COUNT; w++) {
      const unlocked = w <= (G.save.maxWorld || 1);
      const btn = document.createElement('button');
      btn.className = 'world-btn';
      btn.disabled = !unlocked;
      const boss = UNITS['w' + w + '_boss'];
      btn.innerHTML = unlocked
        ? `<b>W${w}　${WORLDS[w].name}</b><small>${G.save.bossKilled[w] ? '✅ 已制霸' : '魔王：' + boss.name}</small>`
        : `<b>🔒 W${w}　？？？</b><small>先打敗 W${w - 1} 的魔王</small>`;
      btn.addEventListener('click', () => {
        if (!unlocked) return;
        closePanel();
        SFX.craft();
        startScene('battle', w);
      });
      list.appendChild(btn);
    }
  }

  // ---------- 選單流程 ----------
  function showTitle() {
    G.state = 'title';
    MWInput.releaseLock();
    for (const id of ['death', 'victory', 'loading', 'help', 'offline']) $(id).style.display = 'none';
    $('title').style.display = 'flex';
    const has = !!SV.loadFrom(localStorage);
    $('btn-start').textContent = has ? '▶ 繼續遊戲' : '▶ 開始遊戲';
    $('btn-reset').style.display = has ? 'block' : 'none';
  }

  async function startGame() {
    $('title').style.display = 'none';
    $('loading').style.display = 'flex';
    G.save = SV.loadFrom(localStorage) || SV.newSave();
    // 離線收益
    const gain = GD.offlineGain(G.save, Date.now());
    startScene('sanctum');
    // 初始區塊分幀生成
    const pcx = Math.floor(G.player.x / CHUNK), pcz = Math.floor(G.player.z / CHUNK);
    const jobs = [];
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) jobs.push([pcx + dx, pcz + dz]);
    for (let i = 0; i < jobs.length; i++) {
      G.world.getChunk(jobs[i][0], jobs[i][1]);
      $('loadbar-fill').style.width = ((i + 1) / jobs.length * 100) + '%';
      if (i % 4 === 3 && !document.hidden) await new Promise(r => setTimeout(r, 0));
    }
    $('loading').style.display = 'none';
    G.state = 'playing';
    if (gain > 0) {
      G.save.souls += gain;
      G.save.stats.soulsEarned = (G.save.stats.soulsEarned || 0) + gain;
      $('offline-text').textContent = `你不在的時候，陰影軍團幫你收集了 ${fmt(gain)} 個靈魂！`;
      $('offline').style.display = 'flex';
      G.state = 'panel'; G.panel = 'offline';
    }
    doSave();
    MWAudio.startMusic();
    showHint(MWInput.isTouch
      ? '左搖桿移動、右半屏滑動視角；走近紫色傳送門進入戰場！'
      : '點擊畫面鎖定滑鼠．WASD 移動．走近紫色傳送門進入戰場！', 6000);
    if (!MWInput.isTouch) MWInput.requestLock();
  }

  // ---------- 事件接線 ----------
  $('btn-start').addEventListener('click', () => { MWAudio.ensure(); startGame(); });
  $('btn-help').addEventListener('click', () => {
    $('title').style.display = 'none';
    $('help').style.display = 'flex';
  });
  $('btn-help-back').addEventListener('click', () => {
    $('help').style.display = 'none';
    $('title').style.display = 'flex';
  });
  $('btn-reset').addEventListener('click', () => {
    if (confirm('確定要刪除全部進度重新開始嗎？此動作無法復原！')) {
      SV.clearSave(localStorage);
      showTitle();
    }
  });
  $('btn-respawn').addEventListener('click', () => {
    $('death').style.display = 'none';
    G.state = 'playing';
    startScene('sanctum');
    if (!MWInput.isTouch) MWInput.requestLock();
  });
  $('btn-victory-sanctum').addEventListener('click', () => {
    $('victory').style.display = 'none';
    G.state = 'playing';
    startScene('sanctum');
    if (!MWInput.isTouch) MWInput.requestLock();
  });
  $('btn-victory-again').addEventListener('click', () => {
    $('victory').style.display = 'none';
    G.state = 'playing';
    startScene('battle', G.worldNum);
    if (!MWInput.isTouch) MWInput.requestLock();
  });
  $('btn-offline-ok').addEventListener('click', () => {
    $('offline').style.display = 'none';
    G.panel = null;
    G.state = 'playing';
    if (!MWInput.isTouch) MWInput.requestLock();
  });
  // HUD 按鈕
  $('btn-army').addEventListener('click', () => openPanel('army'));
  $('btn-shop').addEventListener('click', () => openPanel('shop'));
  $('btn-index').addEventListener('click', () => openPanel('index'));
  $('btn-titles').addEventListener('click', () => openPanel('titles'));
  $('btn-gate').addEventListener('click', () => openPanel('worldsel'));
  $('btn-back').addEventListener('click', () => {
    if (G.scene === 'battle' && G.state === 'playing') { SFX.click(); startScene('sanctum'); }
  });
  $('btn-summon').addEventListener('click', () => summonParty());
  $('btn-auto').addEventListener('click', () => {
    G.save.settings.auto = !G.save.settings.auto;
    $('btn-auto').textContent = G.save.settings.auto ? '自動開啟' : '自動關閉';
    $('btn-auto').classList.toggle('on', !!G.save.settings.auto);
    SFX.click();
    doSave();
  });
  $('btn-rebirth').addEventListener('click', () => {
    if (!GD.canRebirth(G.save)) return;
    if (!confirm('確定要重生嗎？靈魂與商店升級會歸零（軍團與圖鑑保留），並永久獲得 靈魂+100%、攻擊+25%！')) return;
    GD.doRebirth(G.save);
    SFX.victory();
    doSave();
    closePanel();
    startScene('sanctum');
    showHint(`✨ 重生完成！這是你的第 ${G.save.rebirths} 次重生，獲得永久加成！`, 6000);
  });
  // 面板關閉
  document.querySelectorAll('.btn-panel-close').forEach(btn => {
    btn.addEventListener('click', closePanel);
  });
  document.querySelectorAll('.overlay.closable').forEach(ov => {
    ov.addEventListener('click', (e) => { if (e.target === ov) closePanel(); });
  });

  canvas.addEventListener('click', () => {
    if (G.state === 'playing' && !MWInput.state.locked) MWInput.requestLock();
  });

  MWInput.onKey((code, down) => {
    if (!down) return;
    if (code === 'Escape') {
      if (G.state === 'panel') closePanel();
      return;
    }
    if (G.state !== 'playing') return;
    if (code === 'KeyF') summonParty();
    if (code === 'KeyB') openPanel('army');
    if (code === 'KeyP') openPanel('shop');
    if (code === 'KeyI') openPanel('index');
    if (code === 'KeyT') openPanel('titles');
    if (code === 'KeyQ' && G.scene === 'battle') { startScene('sanctum'); }
    if (code === 'KeyR') $('btn-auto').click();
  });

  window.addEventListener('beforeunload', () => { if (G.save) doSave(); });

  // ---------- 迴圈：固定時步 + 隱藏分頁備援 ----------
  const TICK_MS = 1000 / 60;
  let acc = 0, last = performance.now(), hiddenTimer = 0;
  function step(now) {
    acc += Math.min(now - last, 250);
    last = now;
    let n = 0;
    while (acc >= TICK_MS && n < 8) { tick(1 / 60); acc -= TICK_MS; n++; }
    if (n === 8) acc = 0;
  }
  function frame(now) {
    step(now);
    renderFrame();
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      doSave();
      hiddenTimer = setInterval(() => step(performance.now()), 50);
    } else {
      clearInterval(hiddenTimer);
      last = performance.now();
    }
  });

  // 測試掛鉤（自動驗證用）
  window.__sw = { G, tick, step, renderFrame, doSave, startScene, startGame, chunkWork, playerAttack, summonParty, openPanel, closePanel };

  // 啟動
  initLabels();
  showTitle();
  requestAnimationFrame(frame);
})();
