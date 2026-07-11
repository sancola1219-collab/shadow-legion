# 接手指南（HANDOVER）— 陰影軍團

> 最後更新：2026-07-11。之後每次大改請更新本檔。

## 這是什麼

《我的方塊世界2：陰影軍團》：方塊風 3D 動作收集遊戲。玩法致敬 Roblox
《Raise Your Shadow Army》（Studio Cochi）——打怪 → 收靈魂 → 奪取敵人影子 →
軍團跟你出戰＋回聖所掛機產靈魂 → 升級 → 推五個世界的魔王 → 重生。
**程式、美術、命名全原創**；引擎沿用姊妹作《我的方塊世界》（../我的方塊世界）。

- 線上版：https://sancola1219-collab.github.io/shadow-legion/
- Repo：https://github.com/sancola1219-collab/shadow-legion （main 根目錄 = Pages）
- 部署：`git push` 即自動更新（無 CI；Pages 直接吃靜態檔）。
- 改了 js/css 記得把 `index.html` 的 `?v=N` 快取參數 +1（Pages CDN 快取很兇）。

## 架構速覽（詳見 CLAUDE.md）

引擎（原封沿用）：noise / world / mesher / physics / weather / input / audio。
render.js 小改：MODELS 全部重寫（`skel1..boss5`＋`player`、attack 揮臂）、drops 開 cutout。
本作新寫：blocks（方塊表）、worldgen（場景地圖）、gamedata（資料/經濟）、units（陣營 AI）、
save、textures（圖集）、main（遊戲流程）、index.html、css。

### 資料流

```
gamedata.UNITS（25 種單位，數值隨世界指數成長）
   ↓ makeUnit(unitId, x,y,z, faction)
units.stepUnit（enemy 追玩家/友軍；ally 追敵人否則跟隨玩家）→ events
   ↓ main tick 處理 events（傷害/投射物/死亡）
死亡 → onEnemyKilled：靈魂紫焰掉落（磁吸）＋ captureChance 擲骰 → save.collection
聖所 → productionPerSec(collection) 掛機加靈魂；platformUnits 選最強 8 種站平台
```

### 場景

- `startScene('sanctum')`／`startScene('battle', w)`：換 World（seed 2000 / 1000+w）、
  清單位、重生玩家、重建燈光。地圖佈局常數在 `worldgen.js` 的 `SANCTUM`/`BATTLE`。
- 戰鬥：三區域（殺滿 ZONES[i].need 開 GATEBAR 閘門）→ 踏進競技場觸發魔王 →
  魔王死 → bossKilled/maxWorld 更新 → victory 面板。
- 玩家死亡無懲罰，回聖所復活。掉出地圖會拉回出生點。

## 驗證方法

1. `node --test tests/logic.test.js`（21 項，全綠才 commit）。
2. 瀏覽器：`npx http-server -p 8128 .` 開 localhost:8128，Console 用 `window.__sw`：
   ```js
   // 自動戰鬥 90 秒，看擊殺/奪取/靈魂有沒有動
   __sw.startGame?.() // 或點開始
   __sw.startScene('battle', 1); __sw.G.save.settings.auto = true;
   for (let i = 0; i < 5400; i++) __sw.tick(1/60);
   ({k: __sw.G.zoneKills, s: __sw.G.save.souls, c: __sw.G.save.collection})
   ```
3. 畫面驗證（Browser pane 截 WebGL 會逾時！）用 readPixels：
   ```js
   const gl = document.getElementById('game').getContext('webgl2');
   __sw.renderFrame();
   const px = new Uint8Array(4);
   gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); px
   ```

## 踩過的坑

- **聖所初始視角**：yaw=0 面向 −z（北）。曾誤設 π 背對傳送門，HTML 投影名牌全被
  「鏡頭後方」剔除看起來像沒渲染。改視角記得投影 `project()` 與 render 的 fovY(1.15) 要同步。
- **初期難度**：玩家 100 HP 沒軍團會死在第二區 → 加了脫戰回血（4 秒沒受傷每秒回 4%，聖所 12%）。
- **敵人生成**：`kills + alive >= need` 停止生成，不然殺過頭卡進度條。
- **掉落物透明貼圖**：實體 shader 預設不裁切 alpha，靈魂紫焰會變黑方塊 → drops 迴圈開 `uCutout=1`。
- **git identity**：本機 repo 要 `git config user.name/email`（沿用 sancola1219-collab / sancola1220@gmail.com）。
- Windows 下 `node --test tests/` 讀不到目錄，要指名 `tests/logic.test.js`。

## 擴充速查

- **加單位**：gamedata `ARCHETYPES`/`UNIT_NAMES` → textures 皮膚（skinBase 每世界還剩 1 空格）→
  render `buildModels()` 加模型鍵 → main `faceTileOf` 圖示對照。
- **加世界**：gamedata `WORLDS`＋`WORLD_COUNT`、worldgen `THEMES`、main `SKIES`、textures `PAL`。
- **加升級**：gamedata `UPGRADES`（playerStats 讀取）→ 商店 UI 自動長出來。
- **加稱號**：gamedata `TITLES` 加一條 check 函式即可。
- **加存檔欄位**：save.js `newSave` ＋ `encodeSave` 白名單兩處都要加。

## 路線圖（還沒做，可以做）

- 手動編隊（目前 battleParty 自動選最強）
- 出戰影子的等級/合成強化
- 更多魔王攻擊模式（現在魔王＝大守衛＋召小怪）
- PVP 截圖裡有但本作是單機，未做
- 音樂做主題化（現在沿用前作五聲音階環境樂）
