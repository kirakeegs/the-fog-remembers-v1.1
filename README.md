# 雾会记得 / The Fog Remembers

原创心理恐怖 roguelite。玩家在灰洄镇不断下沉，靠手电、声呐、收音机杂讯、灰烬、水纹和微弱晨光寻找证物，完成仪式，救下雾中的同行者，并决定自己还能走到多深。

项目使用 Next.js + React + TypeScript + HTML5 Canvas。视觉资产放在 `public/assets`，音频放在 `public/audio`，核心玩法逻辑位于 `game/`。

## 当前内容

- 原创 IP 名称：`雾会记得 / The Fog Remembers`
- 地点：灰洄镇、归潮街口、废弃公寓、铁锈医院、灰烬教堂、沉没学校、破晓海岸
- 玩法：程序化迷宫、手电视野、雾、理智、电量、体力、声呐、可携带补给、可救同行者
- 威胁：游荡者、追猎者、聆听者、残暴者、匍匐者
- 首屏：项目内 PNG key art、噪声贴图、召回印记标志
- 进度：已有无尽下沉循环、存档、标题页、移动端触控、HUD 与 BGM 控制

## 操作

- `WASD` / 方向键：移动
- 鼠标：控制手电方向
- `Shift`：奔跑，会消耗体力并制造噪音
- `Q`：声呐扫描，会暴露地图，也会惊动怪物
- `E`：拾取、互动、解救、完成仪式
- `1`：使用药水护盾
- `2`：使用十字架定身附近怪物
- `P` / `Esc`：暂停
- `R`：重开

## 本地运行

```bash
npm install
npm run dev
```

打开 http://localhost:3000 进入标题页。

## 构建

```bash
npm run build
npm start
```

## 资产

- `public/assets/title/fog-remembers-key-art.png`：标题页主视觉
- `public/assets/title/fog-remembers-grain.png`：噪声纹理
- `public/assets/ui/recall-sigil.png`：原创 IP 标志
- `docs/IP_BIBLE.md`：世界观、怪物、章节和禁用元素
- `docs/ASSET_PIPELINE.md`：AI 生图与本地资产接入规范
