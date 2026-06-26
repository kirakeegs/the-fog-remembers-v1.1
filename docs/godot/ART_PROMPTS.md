# 生图 Prompt 清单与资产管线 — The Fog Remembers (Godot 重制)

> 关联：`GODOT_REMAKE_DESIGN.md`、`LEVEL_DESIGN.md`
> 生图模型：`gpt-image-2`（你提供的 OpenAI 兼容端点）
> 风格基准：原作 `ASSET_PIPELINE.md` 已定义的主视觉风格 —— 低饱和港镇、灰绿雾、锈红事故痕迹、暖黄手电锥、偏冷晨光。**所有新图必须延续这套配色与"绘画质感、非写实"基调**。

---

## ⚠️ 0. 安全第一（必读）

你在对话里**直接贴出了真实 API key**，而你自己的 IP Bible 明确写着"不要把 API key 写进源码、文档、截图、命令历史、提交信息"。

**请立刻做两件事：**
1. **去 gpt-image-2 平台后台吊销/重置那个 key**（它已经泄露在聊天记录里）。
2. 之后只把新 key 放进 **`.env.local`**（已被 `.gitignore` 忽略），绝不写进任何文件。

本文档与后续脚本**只引用环境变量名**，绝不写入 key 本身：

```bash
# .env.local（本机，不提交）
FOG_IMAGE_PROVIDER=openai-compatible
FOG_IMAGE_BASE_URL=https://你的端点
FOG_IMAGE_MODEL=gpt-image-2
FOG_IMAGE_API_KEY=只在本机填写
```

---

## 1. 资产盘点：已有 vs 需补

### 已有（直接复用，无需生成）
- 标题：`title/fog-remembers-key-art.png`、`grain.png`
- UI：`ui/recall-sigil.png`、`favicon-source.png`
- 场景档案图 9 张：`scenes/scene-*.png`（街口/公寓/医院/地下道/教堂/学校/海岸/病房/无尽）
- 怪物概念图 5 张、道具图 4 张、角色概念图 3 张
- 地面：`generated/foggy-asphalt-floor.png`

### 需补（俯视角游戏的关键缺口）
原作的角色/怪物图是**立绘/概念图（正面视角）**，但俯视角 2D 游戏里实体是**从上往下看的小 sprite**。这是最大缺口。

| 优先级 | 类别 | 资产 | 数量 |
|--------|------|------|------|
| P0 | 玩家 sprite | 俯视角玩家（含 8 向或单图+旋转） | 1–2 |
| P0 | 怪物 sprite | 5 种怪物俯视小图 | 5 |
| P0 | Tileset | 墙体/地面/出口 tile（含锈蚀/水渍变体） | 1 套 |
| P1 | 道具 sprite | 电池/药水/十字架/线索俯视图标 | 4 |
| P1 | 同伴 sprite | 俯视幸存者 | 1 |
| P2 | 机制道具 | 收音机/电闸/保险丝/名字残页/反光镜/床头柜 | 6 |
| P2 | 关卡载入图 | 补齐缺失章节档案图 | 按需 |

---

## 2. 通用 Prompt 模板（贴风格用）

每条生图 prompt 都建议拼上这段**风格锚**（延续原作 ASSET_PIPELINE 规范）：

```text
Style/medium: painterly raster game art, hand-painted, not photorealistic, soft edges
Color palette: charcoal black, fog gray, oxidized green, muted amber flashlight, restrained rust red, cold dawn light
Mood: oppressive, quiet, psychological horror, remembered fog
Constraints: original IP, no recognizable external horror franchise references, no logos, no watermark, no text
Avoid: copyrighted horror characters, nurses, pyramid helmets, exact franchise locations, readable text, bright saturated colors
```

> 透明背景资产追加：`Background: transparent PNG, isolated subject, centered`
> 俯视角资产追加：`Camera: strict top-down orthographic view, seen directly from above`

---

## 3. P0 资产 Prompt

### 3.1 玩家 sprite（俯视）
```text
Use case: game-sprite
Asset type: top-down character sprite for 2D horror game
Subject: a lone exhausted adult survivor seen strictly from directly above, holding a small flashlight pointing forward, dark worn coat
Camera: strict top-down orthographic, head and shoulders visible from above, flashlight cone hint forward
[+ 通用风格锚] [+ 透明背景]
Size: 128x128, single centered figure facing up
```
> 文件名：`characters/sprite-player-topdown.png` → Godot 中按角度 `rotation` 旋转。

### 3.2 五种怪物 sprite（俯视）
逐个生成，主体描述替换，其余用风格锚 + 透明背景 + 俯视：

- **wanderer 游荡者**：`a faceless drifting humanoid silhouette seen from above, pale gray, a single vertical seam down the body`
- **stalker 追猎者**：`a tall thin gaunt figure from above, elongated limbs, faint red glowing eyes, predatory posture`
- **listener 聆听者**：`a bloated eyeless creature from above, huge swollen ears on the sides, no eyes, ash-colored`
- **brute 残暴者**：`a massive heavy slow brute from above, thick shoulders, one murky orange eye, rust-red`
- **crawler 匍匐者**：`a low segmented crawling creature from above, many small pale-green eyes, long thin body, hugging the ground`

> 文件名：`monsters/sprite-{kind}-topdown.png`。参考已有 `monster-{kind}.png` 的外观保持一致性。

### 3.3 Tileset
```text
Use case: game-tileset
Asset type: seamless top-down tileset for a foggy abandoned harbor town
Tiles needed: stone/asphalt floor, mossy variant, water-stained variant, rusted metal wall, brick wall, glowing exit doorway
Camera: strict top-down, seamless tileable, 64x64 per tile, grid sheet
[+ 通用风格锚]
```
> 复用 `generated/foggy-asphalt-floor.png` 作地面基底，新增墙体/水渍/出口 tile。

---

## 4. P1 / P2 资产 Prompt

### 道具图标（俯视小图，透明背景，64x64）
- 电池：`a small worn battery cell glowing faint blue, top-down icon` （或复用 `item-battery.png`）
- 药水：`a small vial of dark red liquid with cork, ominous, top-down icon`
- 十字架：`a worn bone-white crucifix relic with rust, top-down icon`
- 线索：`a folded yellowed note / torn paper, top-down icon`

### 机制专属道具（呼应 LEVEL_DESIGN 各章机制）
- 收音机（第1章续）：`an old broken radio emitting faint static waves, top-down`
- 急救电闸（第2章）：`a rusted hospital breaker lever switch, top-down`
- 心脏保险丝（第2章续）：`a pulsing organic fuse shaped like a small heart, top-down, unsettling`
- 名字残页（第3章）：`a torn page with faded handwritten name, ash falling, top-down`
- 反光镜（第4章）：`a cracked angled mirror reflecting cold dawn light, top-down`
- 床头柜（第8章）：`a small bedside table with a few relics, soft dawn light, top-down`

### 关卡载入图（补缺，16:9 档案风，复用现有风格）
仅生成 `scenes/` 里尚缺的章节；现有 9 张优先复用。Prompt 用原作 ASSET_PIPELINE 的主视觉模板，替换 `Scene/backdrop` 为对应地点（铁锈医院手术灯、灰烬教堂落灰、沉没学校漂浮课桌等）。

---

## 5. Godot 生图脚本接入方案（待你确认是否本期做）

由于 Godot 端不方便直接调外部图像 API，建议**沿用原作的 Node 脚本管线**生成图片，再导入 Godot：

```
scripts/gen-art.mjs           # Node 脚本：读 .env.local → 调 gpt-image-2 → 存 PNG
  ├─ 读取 prompts.json（本文档的 prompt 结构化）
  ├─ 调用 OpenAI 兼容 images API
  ├─ 输出到 assets/<category>/<art_prompt_id>.png
  └─ 生成 contact-sheet 供人工审图（移植原作 qa 思路）
```

- **绝不**把 key 写进脚本；`process.env.FOG_IMAGE_API_KEY` 读取。
- 生成后人工挑选 → 放进 Godot `assets/` → 设置导入为 2D sprite（关闭 mipmap、按需开 filter）。

> 流程：`prompts.json` → 跑脚本 → 审图 → 入 Godot。可复用原作 `scripts/check-image-review-config.mjs` 的校验。

---

## 6. 资产命名规范（沿用原作）
- 全小写、短横线分隔。
- 俯视 sprite：`sprite-<name>-topdown.png`
- 关卡图文件名必须等于 `LevelDesign.art_prompt_id`（Godot `Level.gd` 据此加载）。
- 透明背景一律 PNG。

---

## 7. 本期生图待确认
1. 先吊销泄露的 key（**必做**）。
2. P0（玩家+5怪物+tileset）是否本期就生成？还是先用占位色块/复用立绘缩图，等玩法跑通再补美术？
3. 生图脚本（`gen-art.mjs`）要不要我本期一起写？
