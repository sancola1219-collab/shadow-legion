// 存檔編解碼 — 純邏輯，node 可測（storage 由呼叫端注入，瀏覽器用 localStorage）。
// encodeSave 是欄位白名單：新增存檔欄位要加進來，否則會默默丟失。
'use strict';
(function () { // IIFE：避免傳統 script 頂層 const 撞名

const SAVE_VERSION = 1;
const KNOWN_VERSIONS = [1];
const SAVE_KEY = 'shadowlegion.save.v1';

// 新玩家的初始存檔
function newSave() {
  return {
    souls: 0,
    upgrades: {},          // {atk, hp, capture, army, soul} -> level
    collection: {},        // unitId -> 數量
    maxWorld: 1,           // 已解鎖的最高世界
    bossKilled: {},        // world -> true（首殺記錄，決定必得奪取與解鎖）
    rebirths: 0,
    title: 'novice',       // 目前配戴稱號
    stats: { kills: 0, captures: 0, soulsEarned: 0 }, // 累計統計（稱號用）
    lastSeen: 0,           // 離線收益時間戳（ms）
    settings: { music: true, auto: false },
  };
}

function encodeSave(s) {
  return JSON.stringify({
    v: SAVE_VERSION,
    souls: s.souls,
    upgrades: s.upgrades || {},
    collection: s.collection || {},
    maxWorld: s.maxWorld || 1,
    bossKilled: s.bossKilled || {},
    rebirths: s.rebirths || 0,
    title: s.title || 'novice',
    stats: s.stats || { kills: 0, captures: 0, soulsEarned: 0 },
    lastSeen: s.lastSeen || 0,
    settings: s.settings || {},
  });
}

function decodeSave(json) {
  try {
    const o = JSON.parse(json);
    if (!o || !KNOWN_VERSIONS.includes(o.v) || typeof o.souls !== 'number') return null;
    // 補齊缺欄位（舊檔升級）
    const base = newSave();
    for (const k in base) if (o[k] === undefined) o[k] = base[k];
    if (!o.stats) o.stats = { kills: 0, captures: 0, soulsEarned: 0 };
    return o;
  } catch (e) {
    return null;
  }
}

function saveTo(storage, s) {
  try { storage.setItem(SAVE_KEY, encodeSave(s)); return true; }
  catch (e) { return false; }
}

function loadFrom(storage) {
  try {
    const json = storage.getItem(SAVE_KEY);
    return json ? decodeSave(json) : null;
  } catch (e) { return null; }
}

function clearSave(storage) {
  try { storage.removeItem(SAVE_KEY); } catch (e) { /* 忽略 */ }
}

const SLSave = { SAVE_VERSION, SAVE_KEY, newSave, encodeSave, decodeSave, saveTo, loadFrom, clearSave };
if (typeof module !== 'undefined') module.exports = SLSave;
if (typeof window !== 'undefined') window.SLSave = SLSave;
})();
