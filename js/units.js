// 戰鬥單位、投射物、靈魂掉落 — 純邏輯，node 可測。
// 單位有陣營：'enemy'（打玩家與友軍）/'ally'（玩家的影子，打敵人、跟隨玩家）。
// 所有隨機經由呼叫端傳入的 rand()（mulberry32），保持決定性可測。
'use strict';
(function () { // IIFE：避免傳統 script 頂層 const 撞名

const PH = (typeof module !== 'undefined') ? require('./physics.js') : window.MWPhysics;
const GD = (typeof module !== 'undefined') ? require('./gamedata.js') : window.SLData;
const { moveBox } = PH;
const { UNITS } = GD;

// ---- 單位 ----
function makeUnit(unitId, x, y, z, faction) {
  const u = UNITS[unitId];
  const scale = u.scale || 1;
  return {
    kind: 'unit', unitId, faction,
    skin: u.skin, world: u.world, scale,
    name: u.name, boss: !!u.boss,
    x, y, z, hw: 0.3 * scale, hh: 1.85 * scale,
    vx: 0, vy: 0, vz: 0,
    yaw: 0, hp: u.hp, maxHp: u.hp, dmg: u.dmg, speed: u.speed,
    wanderT: 0, wx: 0, wz: 0,
    attackCool: 0, shootCool: 1.2, hurtT: 0, attack: 0,
    onGround: false, anim: 0,
    dead: false, deathT: 0,
    age: 0, homeX: x, homeZ: z,
  };
}

// 找最近的敵對目標。回傳 {x,z,dist,obj,isPlayer} 或 null。
// ctx = { player, units }（player 可為 null＝玩家已倒）
function nearestTarget(m, ctx, range) {
  let best = null, bestD = range;
  if (m.faction === 'enemy' && ctx.player && ctx.player.hp > 0) {
    const d = Math.hypot(ctx.player.x - m.x, ctx.player.z - m.z);
    if (d < bestD) { bestD = d; best = { obj: ctx.player, isPlayer: true, dist: d }; }
  }
  for (const o of ctx.units) {
    if (o === m || o.hp <= 0 || o.faction === m.faction) continue;
    const d = Math.hypot(o.x - m.x, o.z - m.z);
    if (d < bestD) { bestD = d; best = { obj: o, isPlayer: false, dist: d }; }
  }
  return best;
}

// events 推入：
// {type:'hitplayer', dmg}、{type:'hitunit', unit, dmg, kx, kz}
// {type:'shoot', proj, x, y, z, dx, dy, dz, dmg, faction}
// {type:'die', unit}
function stepUnit(m, world, dt, ctx, rand, events) {
  m.age += dt;
  if (m.hurtT > 0) m.hurtT -= dt;
  if (m.attackCool > 0) m.attackCool -= dt;
  if (m.shootCool > 0) m.shootCool -= dt;
  if (m.attack > 0) m.attack -= dt * 2.4; // 揮臂動畫 1→0

  if (m.hp <= 0) {
    m.deathT += dt;
    if (m.deathT === dt) events.push({ type: 'die', unit: m });
    if (m.deathT > 0.7) m.dead = true;
    m.vx *= 0.9; m.vz *= 0.9;
    m.vy -= 20 * dt;
    moveBox(world, m, m.vx * dt, m.vy * dt, m.vz * dt);
    return;
  }

  const u = UNITS[m.unitId];
  const aggro = m.faction === 'ally' ? 16 : (m.boss ? 60 : 22);
  const tgt = nearestTarget(m, ctx, aggro);
  let mvx = 0, mvz = 0;

  if (tgt) {
    const dx = tgt.obj.x - m.x, dz = tgt.obj.z - m.z;
    const dist = tgt.dist || 1;
    m.yaw = Math.atan2(-(dx / dist), -(dz / dist));
    const reach = 1.15 + (m.scale - 1) * 0.7;

    // 遠程：距離 5..18 且冷卻到 → 發射
    if (u.proj && dist > 4.5 && dist < 18 && m.shootCool <= 0) {
      m.shootCool = m.boss ? 1.6 : 2.4;
      const ty = (tgt.isPlayer ? tgt.obj.y + 0.9 : tgt.obj.y + tgt.obj.hh / 2);
      const dy = ty - (m.y + m.hh * 0.7);
      const dl = Math.hypot(dx, dy, dz) || 1;
      events.push({
        type: 'shoot', proj: u.proj,
        x: m.x, y: m.y + m.hh * 0.7, z: m.z,
        dx: dx / dl, dy: dy / dl, dz: dz / dl,
        dmg: m.dmg, faction: m.faction,
      });
    }

    if (dist > reach) { mvx = dx / dist; mvz = dz / dist; }
    else if (m.attackCool <= 0 && Math.abs(tgt.obj.y - m.y) < 2.5) {
      m.attackCool = m.boss ? 1.3 : 1.1;
      m.attack = 1;
      if (tgt.isPlayer) events.push({ type: 'hitplayer', dmg: m.dmg, x: m.x, z: m.z });
      else events.push({ type: 'hitunit', unit: tgt.obj, dmg: m.dmg, kx: dx, kz: dz });
    }
  } else if (m.faction === 'ally' && ctx.player) {
    // 無敵人：跟隨玩家（保持 2.5~3.5 格）
    const dx = ctx.player.x - m.x, dz = ctx.player.z - m.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 3.5) { mvx = dx / dist; mvz = dz / dist; m.yaw = Math.atan2(-mvx, -mvz); }
  } else {
    // 敵人漫遊（在出生點附近）
    m.wanderT -= dt;
    if (m.wanderT <= 0) {
      m.wanderT = 2 + rand() * 4;
      if (rand() < 0.5) { m.wx = 0; m.wz = 0; }
      else {
        const a = rand() * Math.PI * 2;
        m.wx = Math.sin(a); m.wz = Math.cos(a);
        // 拉回出生點
        const hx = m.homeX - m.x, hz = m.homeZ - m.z;
        if (Math.hypot(hx, hz) > 8) { const l = Math.hypot(hx, hz); m.wx = hx / l; m.wz = hz / l; }
      }
    }
    mvx = m.wx; mvz = m.wz;
    if (mvx || mvz) m.yaw = Math.atan2(-mvx, -mvz);
  }

  const spd = m.speed * (m.faction === 'ally' && !tgt ? 1.6 : 1); // 跟隊時跑快點
  m.vx += (mvx * spd - m.vx) * Math.min(1, 8 * dt);
  m.vz += (mvz * spd - m.vz) * Math.min(1, 8 * dt);
  m.vy -= 24 * dt;
  const r = moveBox(world, m, m.vx * dt, m.vy * dt, m.vz * dt);
  m.onGround = r.hitY && r.onGround;
  if (r.hitY) m.vy = 0;
  if ((r.hitX || r.hitZ) && m.onGround && (mvx || mvz)) m.vy = 8; // 撞牆跳

  m.anim += dt * Math.hypot(m.vx, m.vz) * 3;
}

function hurtUnit(m, dmg, kx, kz) {
  if (m.hp <= 0) return;
  m.hp -= dmg;
  m.hurtT = 0.4;
  const kl = Math.hypot(kx, kz) || 1;
  const kb = m.boss ? 1.2 : 5;
  m.vx += kx / kl * kb; m.vz += kz / kl * kb;
  if (!m.boss) m.vy = 4.5;
}

// ---- 投射物（守衛/魔王的能量彈；faction 決定打誰） ----
const PROJ_DEFS = {
  orbA:    { speed: 13, life: 2.2 },  // 稀有守衛
  orbB:    { speed: 15, life: 2.2 },  // 史詩守衛
  orbBoss: { speed: 14, life: 3.0 },  // 魔王
};

function makeProjectile(type, x, y, z, dx, dy, dz, dmg, faction) {
  const pd = PROJ_DEFS[type];
  return {
    kind: 'proj', type, dmg, faction,
    x, y, z,
    vx: dx * pd.speed, vy: dy * pd.speed, vz: dz * pd.speed,
    life: pd.life, spin: 0, dead: false,
  };
}

// events 推入 {type:'projhitplayer', dmg, x, z} 或 {type:'projhitunit', unit, dmg, kx, kz}
function stepProjectile(pr, world, dt, ctx, events) {
  const BKp = (typeof module !== 'undefined') ? require('./blocks.js') : window.MWBlocks;
  pr.spin += dt * 12;
  pr.life -= dt;
  if (pr.life <= 0) { pr.dead = true; return; }
  pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;

  // 打玩家（敵方彈）
  if (pr.faction === 'enemy' && ctx.player && ctx.player.hp > 0) {
    const dy = pr.y - (ctx.player.y + 0.9);
    if (Math.hypot(pr.x - ctx.player.x, dy, pr.z - ctx.player.z) < 1.0) {
      events.push({ type: 'projhitplayer', dmg: pr.dmg, x: pr.x, z: pr.z });
      pr.dead = true;
      return;
    }
  }
  // 打對方單位
  for (const m of ctx.units) {
    if (m.hp <= 0 || m.faction === pr.faction) continue;
    const hitR = Math.max(0.9, m.hw * 2.2);
    const dy = pr.y - (m.y + m.hh / 2);
    if (Math.hypot(pr.x - m.x, dy, pr.z - m.z) < hitR) {
      events.push({ type: 'projhitunit', unit: m, dmg: pr.dmg, kx: m.x - pr.x + pr.vx * 0.01, kz: m.z - pr.z + pr.vz * 0.01 });
      pr.dead = true;
      return;
    }
  }
  // 撞方塊
  if (BKp.isSolid(world.getBlock(Math.floor(pr.x), Math.floor(pr.y), Math.floor(pr.z)))) pr.dead = true;
}

// ---- 靈魂掉落（紫焰，飛向玩家） ----
function makeSoul(x, y, z, amount, rand) {
  return {
    kind: 'soul', amount,
    x, y, z, hw: 0.1, hh: 0.2,
    vx: (rand() - 0.5) * 3, vy: 4 + rand() * 2, vz: (rand() - 0.5) * 3,
    age: 0, dead: false,
  };
}

// 回傳 'pickup' | null
function stepSoul(s, world, dt, player) {
  s.age += dt;
  if (s.age > 60) { s.dead = true; return null; }
  const px = player.x - s.x, py = (player.y + 0.9) - s.y, pz = player.z - s.z;
  const dist = Math.hypot(px, py, pz);
  if (s.age > 0.35) {
    if (dist < 1.1) { s.dead = true; return 'pickup'; }
    // 磁吸（範圍大，靈魂會主動飛過來）
    if (dist < 14) {
      const s2 = (16 - dist) / Math.max(dist, 0.3);
      s.vx += px * s2 * dt * 3; s.vy += py * s2 * dt * 3; s.vz += pz * s2 * dt * 3;
      const sp = Math.hypot(s.vx, s.vy, s.vz);
      if (sp > 18) { s.vx *= 18 / sp; s.vy *= 18 / sp; s.vz *= 18 / sp; }
    }
  }
  s.vy -= 10 * dt;
  s.vx *= 1 - Math.min(1, 1.2 * dt);
  s.vz *= 1 - Math.min(1, 1.2 * dt);
  const r = moveBox(world, s, s.vx * dt, s.vy * dt, s.vz * dt);
  if (r.hitY) s.vy = Math.max(0, s.vy);
  return null;
}

const SLUnits = { makeUnit, stepUnit, hurtUnit, nearestTarget, PROJ_DEFS, makeProjectile, stepProjectile, makeSoul, stepSoul };
if (typeof module !== 'undefined') module.exports = SLUnits;
if (typeof window !== 'undefined') window.SLUnits = SLUnits;
})();
