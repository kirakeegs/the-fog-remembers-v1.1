# Sprite 图集系统与美术资产升级方案

## 已完成工作

### 1. Sprite 动画系统 (`game/sprite.ts`)
- **SpriteAnimator**: 支持帧切割、动画播放、翻转、速度控制
- **createGridSpriteSheet**: 等宽等高帧切割（逐帧动画）
- **createSingleFrameSheet**: 单帧静态图（道具/物品）
- **SpriteManager**: 全局资源管理器

### 2. 资产定义 (`game/spriteAssets.ts`)
按 ASSET_PIPELINE.md 规范组织：
- **玩家**: 4 方向 × 4 帧行走动画 (64×64)
- **幸存者**: 4 帧待救 idle + 1 帧已救 (48×64)
- **5 种怪物**: 各 2 行（wander/chase），4 帧/行
  - 游荡者: 56×64
  - 追猎者: 64×72
  - 聆听者: 72×64
  - 残暴者: 80×88
  - 匍匐者: 64×48
- **道具**: battery/potion/crucifix/clue 单帧图
- **仪式点**: 4 帧 inactive + 4 帧 active (96×96)
- **新道具**: ash/radio/ripple-tracker（为道具系统重做预留）

### 3. 渲染层重构 (`game/engine.ts`)
- 引入 `spriteManager` 和 `SpriteAnimator`
- 新增动画器缓存：`playerAnimator`、`monsterAnimators`、`survivorAnimators`
- 改造渲染方法：
  - `renderMonster`: 优先使用 Sprite，失败 fallback 到圆圈
  - `renderPlayer`: 优先使用 Sprite，失败 fallback 到圆圈
  - `renderSurvivor`: 优先使用 Sprite，失败 fallback 到圆圈
  - `renderBattery/Potion/Crucifix/Clue/Sigil`: 优先使用 Sprite，失败 fallback
- 新增 `updateAnimators(dt)`: 统一更新所有动画器
- **零破坏性改动**: 如果图集未加载，自动回退到原有圆圈绘制

## 资产路径规范

```
public/assets/
├── characters/
│   ├── player-walk.png         # 4×4 grid, 64×64 per frame
│   └── survivor-idle.png       # 4×1 grid, 48×64 per frame
├── monsters/
│   ├── wanderer-anim.png       # 4×2 grid, 56×64 per frame
│   ├── stalker-anim.png        # 4×2 grid, 64×72 per frame
│   ├── listener-anim.png       # 4×2 grid, 72×64 per frame
│   ├── brute-anim.png          # 4×2 grid, 80×88 per frame
│   └── crawler-anim.png        # 4×2 grid, 64×48 per frame
└── items/
    ├── battery.png             # 单帧
    ├── potion.png              # 单帧
    ├── crucifix.png            # 单帧
    ├── clue.png                # 单帧
    ├── sigil-anim.png          # 4×2 grid, 96×96 per frame
    ├── ash.png                 # 新道具（预留）
    ├── radio.png               # 新道具（预留）
    └── ripple-tracker.png      # 新道具（预留）
```

## 美术生成指南

### 玩家 (player-walk.png)
```
提示词模板：
- 类型: 2D top-down sprite sheet, 4 方向行走动画
- 主体: 一个披雨衣持手电的人，从背后/侧面/正面看
- 风格: 低饱和港镇心理恐怖，简约剪影风格
- 布局: 256×256 图集，4 列 × 4 行
  - 第 1 行: 向下走 (4 帧循环)
  - 第 2 行: 向上走 (4 帧循环)
  - 第 3 行: 向左走 (4 帧循环)
  - 第 4 行: 向右走 (4 帧循环)
- 颜色: 暖黄手电光、灰色雨衣、低饱和背景
- 禁用: 不要外部 IP 角色、不要版权符号
```

### 怪物图集示例 (wanderer-anim.png)
```
提示词模板：
- 类型: 2D top-down sprite sheet, 怪物动画
- 主体: 游荡者 - 标准威胁，象征被忽视的目击者
- 风格: 扭曲剪影、低饱和灰色调、模糊边缘
- 布局: 224×128 图集 (4 列 × 2 行, 每帧 56×64)
  - 第 1 行: 游荡状态 (4 帧循环，缓慢飘浮)
  - 第 2 行: 追逐状态 (4 帧循环，加速扑击)
- 颜色: 灰色主体、红色光晕（追逐时）、半透明
- 禁用: 不要外部 IP 怪物、不要版权符号
```

其他怪物参照 IP_BIBLE.md 中的象征含义调整：
- **追猎者**: 细长、快速、红眼
- **聆听者**: 无眼、大耳、触须感知
- **残暴者**: 巨大、厚重、单眼
- **匍匐者**: 贴地、节段身体、多眼

### 道具图标
```
提示词模板：
- 类型: 2D UI icon, 单张静态图
- 主体: [电池/药瓶/十字架/纸片]
- 风格: 低饱和港镇、简洁可辨识、48×48 或 64×64
- 颜色: 符合 IP Bible 的暖黄/锈红/冷蓝色调
- 背景: 透明 PNG
```

## 接入流程

1. **生成图集**: 按上述规范用 AI 生图或手绘
2. **放置文件**: 按路径规范放入 `public/assets/` 对应目录
3. **启动验证**: `npm run dev`
4. **观察行为**:
   - 图集未加载前: 显示圆圈（原有 fallback）
   - 图集加载后: 自动切换为 Sprite 动画
5. **无需改代码**: 渲染层已自动适配

## 渐进式升级策略

**当前状态**: 所有渲染都有 fallback，游戏可正常运行

**升级路径**:
1. 先做 1 个怪物图集验证流程
2. 逐步补全 5 种怪物
3. 补全玩家/幸存者
4. 最后做道具图标美化

**验证标准**:
- 动画流畅 (8-10 FPS 行走，4-6 FPS 闲置)
- 色调符合 IP Bible (低饱和港镇、暖黄手电、锈红事故痕迹)
- 轮廓清晰可辨识
- 文件体积合理 (单图集 < 100KB)

## 技术说明

- **帧率控制**: `SpriteAnimator.setSpeed()` 可动态调整
- **翻转支持**: `SpriteAnimator.setFlip(flipX, flipY)` 适配方向
- **性能优化**: 单次 `drawImage` 比多次 `arc/fillRect` 更高效
- **内存管理**: 动画器按实体缓存，避免重复创建
- **热更新**: 图集文件更新后刷新页面即可生效
