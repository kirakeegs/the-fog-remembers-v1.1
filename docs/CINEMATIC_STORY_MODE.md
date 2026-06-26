# 电影漫画叙事模式设计

## 目标

把完整剧本转成可游玩的互动电影漫画层：玩家可以在每个场景中阅读扩写描述、查看分镜格、理解互动目标、做关键选择，并为每场保留独立插画生成提示词。

当前实现入口在标题页：

- `坠入迷雾`：进入现有 Canvas roguelite 生存玩法。
- `电影漫画模式`：进入场景化叙事阅读与分镜玩法。
- `/story-archive`：独立场景档案页，集中查看场景说明、玩法目标、分镜和生图提示词。

## 数据入口

叙事数据位于 `game/storyScenes.ts`。

每个 `StoryScene` 包含：

- `id`：稳定场景 ID。
- `act` / `order`：分幕和排序。
- `title` / `subtitle` / `location`：界面显示。
- `image`：当前使用的插画槽位。
- `assetSlug`：未来逐场插画文件名。
- `mood` / `mechanic` / `gameplay`：情绪、玩法和交互设计。
- `description`：扩写后的场景说明。
- `panels`：电影漫画分镜格。
- `objectives`：玩家在此场景的互动目标。
- `choices`：关键选择、后果和道德状态标签。
- `artPrompt`：用于 `gpt-image-2` 的场景插画提示词。

覆盖范围：

- 主线 38 场。
- 结局分支 5 场。
- 总计 43 个可消费叙事节点。

## UI 入口

组件位于 `components/CinematicStoryMode.tsx`。

当前支持：

- 沉浸式单屏游玩界面，背景直接使用当前场景插画。
- 顶部只保留进度、场景档案跳转、重新开始和返回封面。
- 主画面显示场景标题、地点、扩写和当前漫画格。
- 漫画格上一格 / 下一格推进。
- 在主流程里阅读漫画格、做关键选择、累计道德状态并判定结局。
- 游玩界面显示本轮关键状态、当前结局倾向和最近选择。
- 场景档案、生图提示词、完整玩法目标和所有分镜移到 `/story-archive`。
- 桌面布局偏向画面沉浸，移动端自动堆叠。

## 玩法定位

电影漫画模式不是单纯剧情档案，而是第二套叙事玩法。

当前实现已经记录关键选择状态，例如 `ashesReturned`、`survivorsSaved`、`truthFaced`，并用这些状态判定五种结局：

- `ending-redemption`：救下同行者、归还名字、接受自我宽恕并说出真相。
- `ending-truth`：看清真相、接受自我宽恕，但最终选择沉默守护。
- `ending-sacrifice`：救下同行者并归还多个名字，但把出口让给仍在雾里的人。
- `ending-denial`：选择遗忘、连续放弃同行者，或让雾压过高。
- `ending-endless`：未彻底堕落，也未完成承诺，进入下一轮下沉。

后续可以继续演进为：根据选择状态解锁或隐藏后续场景；允许从漫画模式某些场景切入 Canvas 关卡，再回到漫画过场。

## 场景插画规范

逐场插画建议保存到：

```text
public/assets/story/
```

命名使用 `assetSlug`：

```text
public/assets/story/comic-scene-01-title-prologue.png
public/assets/story/comic-scene-02-tidal-street-search.png
...
public/assets/story/comic-ending-redemption.png
```

替换方式：

1. 生成图片。
2. 放入 `public/assets/story/`。
3. 文件名使用 `{assetSlug}.png`。
4. 组件会优先加载 `/assets/story/{assetSlug}.png`；缺图时自动回退到 `StoryScene.image`。
5. 运行 `npm run build` 和 `npm run qa:smoke`。

## gpt-image-2 调用配置

不要把 API key 写入代码、文档或提交信息。

本机 `.env.local` 使用：

```powershell
FOG_IMAGE_REVIEW_PROVIDER=openai-compatible
FOG_IMAGE_REVIEW_BASE_URL=https://jiuuij.de5.net
FOG_IMAGE_REVIEW_MODEL=gpt-image-2
FOG_IMAGE_REVIEW_API_KEY=...

# 可选：主接口超时、429/5xx 或密钥失效时给生图脚本使用
IMAGE_GEN_FALLBACK_BASE_URL=...
IMAGE_GEN_FALLBACK_MODEL=gpt-image-2
IMAGE_GEN_FALLBACK_API_KEY=...
```

检查配置：

```bash
npm run check:image-review
```

生成第一批关键场景图：

```bash
npm run generate:story-images
```

如果本地 `.env.local` 配置了 `IMAGE_GEN_FALLBACK_*`，`generate:story-images` 会在主接口超时、限流、5xx 或认证失败时自动切到备用接口。

生成指定场景：

```bash
npm run generate:story-images -- --ids scene-01-title-prologue,ending-redemption
```

如果使用 Codex 内置 `$imagegen`，优先用内置图像生成工具；项目落地资产必须移动到 `public/assets/story/`，不能只停留在默认生成目录。

## 统一美术方向

所有场景提示词已内置以下共同约束：

- 原创心理恐怖 IP。
- 电影漫画式 2D 游戏插画。
- 宽幅 16:9。
- 无文字、无水印。
- 不引用外部恐怖 IP 的角色、怪物、场景或标志。
- 色彩保持灰绿雾、锈红痕迹、暖色手电或晨曦。

## 生产批次建议

第一批优先生成 9 张章节关键图：

1. `comic-scene-01-title-prologue`
2. `comic-scene-04-abandoned-apartment-radio`
3. `comic-scene-07-rust-hospital-entry`
4. `comic-scene-11-flesh-tunnel-tracker`
5. `comic-scene-15-ash-church-ritual`
6. `comic-scene-20-sunken-school-entry`
7. `comic-scene-24-dawn-coast`
8. `comic-scene-31-emergency-room-night`
9. `comic-ending-redemption`

第二批再补所有选择分支和结局图。这样可以先形成完整视觉节奏，再进入逐场精修。
