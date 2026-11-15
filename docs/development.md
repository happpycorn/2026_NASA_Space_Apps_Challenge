# 開發與試玩指南

本機安裝與啟動指令見 [README](../README.md#快速啟動)。

## 單人試玩

每一局有一個種子，決定哪些風險項目帶著缺陷。「重玩這份委託」保留委託、重抽種子，「換一份委託」回到委託選擇。入軌和登月用「要不要再玩一次？」重抽種子。開發試玩時，可在網址後面加 `?seed=數字` 並從任務簡報開始，以重現指定情境，例如 `http://localhost:5173/?seed=6`。

新局從大廳查看「第一道曙光」。先閱讀事故回顧與委託簡報，再選洪災通行圖或海灣排水調查。太空站搭載第 7 週交件，太陽同步共乘是第 6 週。兩種搭載的費用、質量與通聯容量直接顯示在配置卡。第一章的步驟、觀測需求和術語見[玩家指南](story/story-explainer.zh-TW.md)。

以下是可重現的首局驗收，完整三章和操作紀錄見[改版驗收規格](gameplay-revision-plan.md#固定種子驗收)。

| 路線 | 種子 | 操作與預期結果 |
| --- | ---: | --- |
| 海灣基本交付 | 1 | 保留主儀器與太空站搭載，做完評估、定版、製造和整合。第 4 週放行，首圈交 3 段溫度帶並解鎖入軌。 |
| 海灣超重 | 1 | 用太空站搭載和副感測器確認初步配置，再選副感測器加轉向餘裕。4.1／4 kg 會阻擋早測與定版，換回副感測器後可繼續。 |
| 洪災早測修正 | 6 | 加副感測器，先做介面早測，測出問題後改圖再定版。首圈達標後可追加目標，取得入軌實驗室紀錄。 |
| 洪災觀測遮擋 | 4 | 基本儀器在 4 格下傳容量內只交 1 批，低於 2 批門檻。副感測器可補上受遮擋的觀測。 |
| 洪災到期未發射 | 6 | 選共乘與副感測器加轉向餘裕並略過早測。整合測出介面異常時，剩餘工期不足以重測，以未放行結算。 |

三章都可在飛行準備審查先查看證據，再送審及開始發射。登月種子 1 會在升空後的停泊軌道遇到雷擊應對。種子 3 和 5 分別在倒數前處理發射取消及天氣。舊倒數存檔保留已選的應對。三章基本目標全數達成後，可從大廳主畫面開啟任務履歷。立方衛星舊模式和多人審查的原始設計見[立方衛星舊版規則](story/cubesat.md)。

## 多人本機試玩

準備 JDK 21 以上，先在一個終端機啟動 Auth 和 Firestore 模擬器，再在另一個終端機啟動開發伺服器。首次執行會下載 Firestore 模擬器。

```sh
npm run emulators
```

```sh
VITE_FIREBASE_EMULATORS=true npm run dev
```

1. 用兩個獨立瀏覽器設定檔開啟同一個 Vite 網址。一般視窗和一個無痕視窗也可以。
2. 第一個視窗選「多人審查」並以 PM 身分建房。按「複製房間碼」取用八碼邀請碼，也可直接選取房間碼文字。第二個視窗輸入房間碼，選科學、電力或通訊組。
3. 隊友送出一項提案後，可換方案再送一次。PM 畫面會同步提案。未送提案的部門會有遊戲代提，至少一位隊友送出提案後才可確認。
4. PM 選一個提案並確認重測。各視窗都會收到相同判定，可各自切換語言。直接刷新會用原匿名身分回到房間。角色依瀏覽器設定檔保存，回大廳後可用原房間碼返回。

這個原型每房一場整合審查。房間碼是邀請憑證。Firestore 禁止列舉房間，允許持碼匿名玩家讀取該房間。角色認領、提案和 PM 確認由 [Firestore 規則](../firestore.rules)約束。確認交易使用回合 ID，寫入一次已選部門與方案 ID，之後各裝置用共用規則計算相同的整合證據與資源支出。

## 驗證與部署

```sh
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:browser -- --grep-invert team.spec.ts
npm run test:team
```

`test:team` 會自動啟停模擬器。執行前先關閉手動啟動的模擬器，釋出 8080 和 9099。測試使用獨立 Chromium 瀏覽器身分，涵蓋 2 人與 4 人房、提案同步及修訂、Firestore 寫入權限、並發確認和刷新恢復。

部署單人版時，把 `npm run build` 產生的 `dist/` 放到靜態主機。部署多人版時，使用團隊自己的 Firebase Spark 專案。新增 Web App，啟用 Authentication 的 Anonymous 登入，建立 Cloud Firestore 資料庫，將 [`.env.example`](../.env.example) 複製為 `.env.local`，填入 Web App 的公開設定並保留 `VITE_FIREBASE_EMULATORS=false`。使用 Firebase Hosting 可執行下列指令。

```sh
npm run build
npm exec -- firebase login
npm exec -- firebase deploy --only firestore:rules,hosting --project YOUR_PROJECT_ID
```

部署後用兩台裝置各選一個角色，重跑建房到結算。雲端驗收需要專案存取權、啟用的匿名登入和 Firestore，及可連線的站點。 [Firebase 匿名登入](https://firebase.google.com/docs/auth/web/anonymous-auth) · [Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart)

## 故事與文案交接

- 劇情接點和角色設定見[主線](story/main-story.md)。玩家指南與各章原型規則放在 [`docs/story/`](story/)。
- 在 [繁中](../src/i18n/zh-TW.ts)與[英文](../src/i18n/en.ts)字典更新 `story*`、任務簡報、事件和結算文案。保留 `{count}` 等變數供遊戲填入數值。
- 新局委託規則在 [`cubesat-commission.ts`](../src/missions/cubesat-commission.ts)。舊局與多人部門提案在 [`cubesat.ts`](../src/missions/cubesat.ts)。變更多人提案 ID 或代提方案時，也需更新 [`firestore.rules`](../firestore.rules) 並重跑 `npm run test:team`。

[官方挑戰資源](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources)列出《CubeSat 101》。大廳使用立方衛星的像素插畫。

## 新增任務

遊戲規則在 [`src/game/mission.ts`](../src/game/mission.ts)，各任務共用。新增一個任務的步驟：

1. 在 `src/missions/` 新增規則檔，匯出符合 [`MissionRules`](../src/game/types.ts) 的物件。內容包括選項組 `groups`、各項工作的成本 `costs`、整合測試判定 `test`、補救方式 `remedies`、任務模擬 `fly`、結局文案 `outcomes`、聲望 `reputation`，以及可選的固定觸發事件 `events` 和風險項目 `risks`。立方衛星可參考 [`cubesat.ts`](../src/missions/cubesat.ts)。多週工作、審查和分段飛行見[任務引擎](mission-engine.md)。
2. 在 [`src/missions/rules.ts`](../src/missions/rules.ts) 的 `missionRules` 登記，`missionCatalog` 的順序就是解鎖順序。
3. 新增對應的畫面元件（參考 [`cubesat-ui.tsx`](../src/missions/cubesat-ui.tsx)），在 [`src/missions/index.ts`](../src/missions/index.ts) 的 `missions` 登記。
4. 文案加進兩份 i18n 字典。

達成前一個任務的最低要求後，下一個任務才會解鎖。進度和聲望存在瀏覽器（`space-mission.progress.v1`）。事件觸發時，玩家要先做選擇才能繼續。選擇結果記在 `game.events`，規則可以用 `eventChoice` 讀取。`game.seed` 是本局種子，`game.risks` 記玩家對每個風險項目驗到第幾級、有沒有測出缺陷、修了沒，`game.accepted` 是送審時簽字的項目，`game.outcomes` 是飛行時每個項目的實際結果。任務 `records` 回傳的成果會帶進之後的任務（`game.records`），可以用來觸發邀約。

## 開賽時的雙機協作規劃

兩台機器以同一個 GitHub repo 的 `main` 為基準。賽前先確認兩邊能登入 GitHub、讀取 repo，並裝好同一個 Node.js LTS 主版本與 npm。全球籌辦團隊說明，正式製作從所屬場次開賽後開始。 [2026 Space Apps 籌辦團隊答覆](https://github.com/nasa/spaceapps/discussions/1827)

開賽後由一台先建 React + TypeScript + Vite 骨架，提交 lockfile，驗證 `npm run dev` 和 `npm run build`，再推到 `main`。兩台拉到同一版後用 `npm ci` 安裝。

| 分工 | 分支與主要目錄 | 第一個可交付成果 |
| --- | --- | --- |
| 機器 A／畫面 | `codex/game-ui` · `src/ui/` | 做大廳、工作台和結算，先用假資料把畫面串起來。 |
| 機器 B／遊戲規則與內容 | `codex/game-rules` · `src/game/`、`src/missions/` | 先做立方衛星，能開局、執行工作扣資源、送審並結算。 |

開分支前，兩人先約定畫面要讀的欄位與可送出的動作。畫面讀取目前階段、剩餘週數、經費、需求狀態和可用行動。遊戲規則接收開始任務、執行工作、送審等動作，回傳更新後的狀態。新增欄位時在 PR 附一筆範例，方便另一台更新假資料或接線。

各自從最新 `main` 開分支，完成一段能跑的改動就推分支開 PR。先合併立方衛星的畫面與規則，跑一遍大廳到結算。入軌火箭、登月計畫與存檔再各自接到這條流程。
