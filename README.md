# FINAL ORBIT／最後的軌道

NASA Space Apps Challenge 的回合制太空任務管理遊戲。玩家帶領 Astra Dynamics 從發射事故後重建信譽，在工期、預算和工程限制下設計、驗證、放行並交付。單人主線從立方衛星、入軌火箭走到登月，累積聲望、合作資格和任務履歷。

## 快速啟動

使用 Node.js 24 LTS（或 22.12 以上的 22.x）和 npm。

```sh
npm ci
npm run dev
```

在瀏覽器開啟 Vite 顯示的網址，預設為 `http://localhost:5173`。單人模式可直接玩。選 EN 或繁中可切換文案。同一瀏覽器、同一網址會保留一個單人自動存檔，刷新後在大廳選「繼續任務」。開始新局會覆蓋該存檔。加入種子之前的舊存檔會在更新後顯示為開新局。

## 專案文件

- [開發與試玩指南](docs/development.md)｜試玩路線、測試、部署與文案交接。
- [遊戲設計草案](docs/game-design.md)｜架構、回合流程、審查階段與難度規劃。
- [遊戲改版計畫與驗收規格](docs/gameplay-revision-plan.md)｜首局引導、決策回饋與三章驗收路線。
- [NASA 資源與玩法調整提案](docs/nasa-mission-design-notes.md)｜官方資源如何對應遊戲設計。
- [挑戰要求與提交規則整理](docs/challenge-requirements.md)｜題目、提交規則與評分標準的繁中筆記。

## 故事與跨局成長

- [整體主線與跨局成長](docs/story/main-story.md)
- [繁中玩家指南](docs/story/story-explainer.zh-TW.md) · [English player guide](docs/story/story-explainer.en.md)
- [簡單／立方衛星分支](docs/story/cubesat.md)
- [中等／入軌火箭分支](docs/story/orbital-launch.md)
- [困難／登月計畫分支](docs/story/lunar-mission.md)

## 來源與開發紀錄

立方衛星的委託、儀器、通聯與驗收依 NASA 的任務區段與需求流程設計。發訊時計由《CubeSat 101》的任務日測試驗證。遊戲把工期、載重與通聯容量簡化成可比較的情境數值。 [NASA《Design and Develop Science Missions》](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf) · [NASA《CubeSat 101》](https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf)

AI 協助本輪規則實作、中英文案、文件與測試。各章選項旁列原始來源與遊戲設定。 [NASA 資源與玩法對照](docs/nasa-mission-design-notes.md)
