# Asset Pipeline

## 当前落地资产

- `public/assets/title/fog-remembers-key-art.png`
- `public/assets/title/fog-remembers-grain.png`
- `public/assets/ui/recall-sigil.png`
- `public/assets/scenes/scene-tidal-street.png`：归潮街口关卡载入档案图
- `public/assets/qa/generated-asset-contact-sheet.png`：本轮生成资产总览图，仅用于人工检查
- `public/assets/scenes/`：关卡载入档案图，文件名必须匹配 `artPromptId`
- `public/assets/monsters/`：怪物档案图或未来 sprite 参考
- `public/assets/items/`：道具图标或未来 pickup 参考
- `public/assets/characters/`：主角、幸存者、幻觉参考图
- `public/assets/story/`：电影漫画模式逐场插画，文件名使用 `game/storyScenes.ts` 中的 `assetSlug`

这些资产已接入标题页 CSS，可以直接随 Next.js 静态托管。
游戏内部的关卡档案面板会自动尝试加载 `/assets/scenes/{artPromptId}.png`。如果图片尚未生成，会显示代码内置的低成本占位视觉。

电影漫画模式会优先加载 `public/assets/story/{assetSlug}.png`。如果逐场插画尚未生成，会自动回退到 `game/storyScenes.ts` 中的章节场景图。完整设计见 `docs/CINEMATIC_STORY_MODE.md`。

## AI 生图安全规则

不要把 API key 写进仓库。需要调用外部生图或审图服务时，把 `.env.example` 复制为 `.env.local`，再只在本机填写真实密钥。

审图供应商配置：

```powershell
FOG_IMAGE_REVIEW_PROVIDER=openai-compatible
FOG_IMAGE_REVIEW_BASE_URL=https://jiuuij.de5.net
FOG_IMAGE_REVIEW_MODEL=gpt-image-2
FOG_IMAGE_REVIEW_API_KEY=...
```

底层代码通过 `lib/server/imageReviewProvider.ts` 读取这些变量。这个模块只能在服务端或 Node 脚本中使用，不要从客户端组件导入，避免把密钥打进浏览器包。

本地检查：

```bash
npm run check:image-review
```

电影漫画关键图生成：

```bash
npm run generate:story-images
```

生成指定场景：

```bash
npm run generate:story-images -- --ids scene-01-title-prologue,ending-redemption
```

如果使用另一个兼容服务，改成对应的 `BASE_URL` 和 `MODEL`。密钥只应存在于 `.env.local`、当前 shell 环境或系统安全凭据中。

## 主视觉提示词

```text
Use case: stylized-concept
Asset type: game title screen key art
Primary request: original psychological horror game key art for "The Fog Remembers / 雾会记得"
Scene/backdrop: a deserted folded harbor town street at night, old clinic silhouettes, leaning street lamps, dense remembered fog
Subject: one exhausted adult survivor seen from behind, holding a weak flashlight cone into the fog
Style/medium: painterly raster key art, cinematic 2D game title background, not photorealistic
Composition/framing: wide 16:9, central figure low-middle, enough negative space above for title text
Lighting/mood: weak warm flashlight, cold green-gray fog, small rust-red traces, oppressive but quiet
Color palette: charcoal black, fog gray, oxidized green, muted amber, restrained rust red
Text: no text in image
Constraints: original IP, no recognizable external franchise references, no logos, no watermark
Avoid: copyrighted horror characters, nurses, pyramid helmets, exact franchise locations, readable text
```

## Logo / 印记提示词

```text
Use case: logo-brand
Asset type: transparent UI sigil for horror game
Primary request: a simple occult recall mark for "The Fog Remembers"
Style/medium: vector-friendly painted emblem, circular sigil, worn ink and rust
Composition/framing: centered square icon, strong silhouette, readable at 64px
Color palette: aged bone, tarnished amber, dried rust
Text: no text
Constraints: original mark, no religious trademark symbols, no watermark
```

## 接入规范

- 标题主视觉放在 `public/assets/title`。
- 关卡载入档案图放在 `public/assets/scenes`，文件名使用 `提示词.md` 中的提示词 ID。
- 电影漫画逐场插画放在 `public/assets/story`，文件名使用 `StoryScene.assetSlug`。
- UI 小图标放在 `public/assets/ui`。
- 怪物概念图放在 `public/assets/monsters`。
- 文件名使用小写短横线。
- 新资产接入后必须运行 `npm run build`，并用浏览器检查桌面和移动端布局。

## 电影漫画场景提示词

每个场景的 `artPrompt` 已在 `game/storyScenes.ts` 内维护，统一使用 16:9 电影漫画式 2D 插画方向。生成前先确认：

- 场景是否已有可复用图，避免重复生成。
- 输出是否没有文字、水印和外部 IP 特征。
- 角色、怪物和道具是否符合 `docs/IP_BIBLE.md`。
- 新图是否落到 `public/assets/story/`，而不是只留在临时目录。

第一批建议只生成关键节奏图：标题序幕、公寓、医院、肉墙地下道、灰烬教堂、沉没学校、破晓海岸、事故夜、赎罪结局。
