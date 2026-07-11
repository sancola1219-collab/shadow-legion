# 我的方塊世界2：陰影軍團 — 開發與審核規範

> 本檔與 `AGENTS.md` 內容同步（本檔給 Claude Code、後者給 Codex 等其他代理）。修改任一檔請同步另一檔。
> **接手必讀：`docs/HANDOVER.md`**（架構導覽、驗證方法、踩過的坑、擴充速查都在那）。
>
> 方塊風格 3D 動作收集遊戲（致敬 Roblox《Raise Your Shadow Army》玩法類型，內容全原創）。
> 純前端、零建置、零外部依賴（手寫 WebGL2，引擎沿用《我的方塊世界》）。
> 雙擊 `index.html` 離線即玩；開發用 `npx http-server -p 8128 .` 或 `.claude/launch.json` 的 preview。
> 線上版：https://sancola1219-collab.github.io/shadow-legion/ （main 分支根目錄＝GitHub Pages）
> 設計文件：`docs/DESIGN.md`

## 架構

- **邏輯層（node 可測，不碰瀏覽器）**：`js/noise.js`（雜湊/噪聲）→ `js/blocks.js`（方塊表）→
  `js/worldgen.js`（場景式地圖：seed 2000=聖所、1001..1005=戰鬥世界）→ `js/world.js`（區塊儲存）→
  `js/mesher.js`（網格+AO）；`js/physics.js`（AABB/DDA）、`js/gamedata.js`（單位/經濟/升級/稱號資料）、
  `js/units.js`（陣營 AI/投射物/靈魂掉落）、`js/save.js`（存檔編解碼）、`js/weather.js`（天氣狀態機）。
- **瀏覽器層**：`js/textures.js`（Canvas 程序材質圖集 256×256）、`js/render.js`（WebGL2、單位模型）、
  `js/audio.js`（WebAudio 合成）、`js/input.js`（鍵鼠+觸控）、`js/main.js`（狀態機/60Hz/第三人稱/HUD/面板）。

## 鐵律（沿用前作）

1. 遊戲狀態只在 60Hz 固定時步 `tick()` 內改變；rAF 只渲染。
2. 邏輯層檔案不碰 DOM/window（`typeof module` 雙載入模式，node 直接 require）。
3. **每支邏輯檔都包在 IIFE 裡**——傳統 script 頂層 `const` 共用全域詞法環境，不包會跨檔撞名整支掛掉。
4. 隨機一律 `mulberry32` / 座標雜湊；同 seed 同地圖。地圖細節必須由世界座標決定性生成。
5. 座標：x 東、z 南、y 上；yaw=0 面向 −z；`世界高 48、地面 GY=8、區塊 16×16`。
6. 觸控＝合成輸入（搖桿走 `touchMove`、按鈕合成 keydown/mouse），不另寫邏輯分支。
7. 引擎模組沿用 `MW*` 全域名（blocks/worldgen 雖是新內容仍掛 `MWBlocks`/`MWWorldgen`），本作新模組用 `SL*`。

## 常數速查

- 圖集 512×512、**tile 32px**（`TILE=T=32`；textures.js 內 rect/px 用 16 單位設計空間自動 ×2）。
- 方塊 tile 1..43（blocks.js/textures.js 對應）；44..52 玩家與特效；`skinBase(w)=64+(w-1)*12` 各世界皮膚 12 格。
- **召喚**：戰鬥不自動帶兵；`summonParty()`（按鈕/F 鍵，冷卻 6s）召出 battleParty 缺額；自動模式每 tick 安靜補召。
- 單位 id：`w{1..5}_{skel|zomb|guardA|guardB|boss}`；render 模型鍵 = `skin+world`（如 `skel1`）＋ `player`。
- 稀有度：common 常見(奪取30%)/rare 稀有(15%)/epic 史詩(6%)/legendary 傳說(魔王首殺必得，之後10%)；上限 0.9。
- 數值成長：每世界 敵人×6、靈魂×6、產出/秒×4（`gamedata.js` STAT_MUL/SOUL_MUL/PROD_MUL）。
- 戰鬥地圖佈局在 `WG.BATTLE`（zones x 範圍、gates=[72,132,192]、arena 圓心 218,0 半徑 20）；聖所在 `WG.SANCTUM`。
- 區域閘門＝GATEBAR 方塊，清完由 main `openGate()` setBlock 拆除（world.dirty 會自動重建網格）。
- 存檔 key `shadowlegion.save.v1`：souls/upgrades/collection/maxWorld/bossKilled/rebirths/title/stats/lastSeen/settings。
  **encodeSave 是欄位白名單**，加欄位要一起加否則默默丟失。離線收益靠 lastSeen（50% 效率、上限 8h）。
- 名牌/血條/浮字＝HTML 投影（main `project()` 與 render 同一組矩陣參數 fovY 1.15；改 fovY 兩邊要同步）。
- 燈光不掃 world.edits：`buildLights()` 依佈局公式靜態產生，取最近 16 盞進 shader。

## 已知陷阱

- 隱藏分頁 rAF 停擺：載入流程在 `document.hidden` 時同步跑；別拆。
- 第三人稱鏡頭用 `raycast` 向後探撞牆；玩家掉出地圖（y<-12）會拉回出生點。
- 敵人生成上限邏輯：`kills+alive >= need` 就停止生成，避免殺過頭；魔王戰另走 BOSS_ADDS。
- 平台 h=0.3、墓碑 h=0.9：走路會撞邊（引擎無自動跨步），佈局時別擋在必經之路。
- 掉落物渲染開了 cutout（靈魂紫焰是鏤空貼圖）；單位模型不能用帶透明的 tile（會破面）。
- Browser pane 對 WebGL 頁面 screenshot 會逾時：驗證畫面用 `gl.readPixels` 取樣（見 HANDOVER）。
- **別用 PowerShell 改中文檔案**（`Get-Content|-replace|Set-Content` 會把 UTF-8 讀成 ANSI 毀掉全檔）；一律用 Edit 工具。

## 測試與驗證

- `node --test tests/logic.test.js`：21 項（單位表/升級/奪取/軍團/重生/離線/地圖/AI/投射物/靈魂/存檔/天氣）。
- 瀏覽器自動驗證用 `window.__sw`：`{G, tick, step, renderFrame, doSave, startScene, startGame, chunkWork, playerAttack, openPanel, closePanel}`。
  例：`__sw.startScene('battle',1); __sw.G.save.settings.auto=true; for(i=0;i<5400;i++)__sw.tick(1/60);` 再檢查 `G.zoneKills`。

## 工作流程

- 改邏輯 → `node --test` 全綠才 commit；改視覺 → readPixels 取樣驗證。
- commit：每完成一個任務就 commit，繁中訊息。
