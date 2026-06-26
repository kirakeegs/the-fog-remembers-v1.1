# 雾会记得 / The Fog Remembers — Godot 4 重制设计文档（主文档）

> 版本：v1.0 设计稿（待你确认后再写代码）
> 目标引擎：**Godot 4.x（GDScript）**
> 重制视角：**俯视角 2D（top-down）**，与原作一致，最大化复用现有原创资产。
> 关联文档：`LEVEL_DESIGN.md`（关卡与玩法深度）、`ART_PROMPTS.md`（生图清单与资产管线）

---

## 0. 这次重制要解决什么

原作（Next.js + Canvas）已经是一个**完成度很高、氛围出色**的 roguelite，但你自己点出了核心问题：

> **"内部玩法比较平庸单一"** —— 每一层本质都是同一套循环：捡线索 → 做仪式 → 找出口。

代码也印证了这一点：`engine.ts` 里 8 个关卡的 `mechanic` 字段（"声源定位""名字归还""重力与水位"）**只是文本标签，并没有真正实现**。所有层共用同一套 `update()` 逻辑，差异仅在：怪物数量、配色、引导特效、旁白文本。

### 本次重制的三个设计支柱

| 支柱 | 原作现状 | 重制目标 |
|------|----------|----------|
| **机制差异化** | 8 层玩法相同 | 每章有 1 个**真正改变玩法**的核心机制 |
| **叙事与玩法绑定** | 旁白与玩法割裂 | 机制本身就是叙事（声音=被听见的代价、名字=归还的仪式） |
| **决策深度** | 只有"逃跑/打退" | 加入**道德选择 + 资源取舍 + 多结局**，让"还能走多深"成为真问题 |

> 美术与音频复用原作原创资产（你是原作者），缺口用 gpt-image-2 补齐（见 `ART_PROMPTS.md`）。

---

## 1. 视角与技术决策

- **视角**：俯视角 2D，相机跟随玩家。理由：原作资产（角色/怪物/道具/场景立绘）全部是 2D，直接复用；3D 化需要重做全部模型，成本与本次"先做出深度玩法"的目标不符。
- **渲染**：Godot 2D 节点 + `PointLight2D` / `Light2D` 做手电锥与雾，比原作 Canvas 手写光照更可控、性能更好。
- **雾/黑暗**：`CanvasModulate`（全局压暗）+ 手电 `PointLight2D`（锥形遮罩）+ `LightOccluder2D`（墙体挡光）。这是 Godot 原生的 2D 光照遮挡方案，天然实现"手电照到才看见"。
- **地图**：`TileMapLayer`（Godot 4.3+）或 `TileMap`，程序化生成沿用原作 `map.ts` 的算法思路（迷宫 + carve 主路径）。
- **脚本**：纯 GDScript（你环境里若是 4.x，语法以 4.x 为准）。不引入 C#，降低门槛。

> ⚠️ **待你确认**：你机器上的 Godot 是 4.x 哪个小版本？（4.2 / 4.3 / 4.4）这决定 `TileMapLayer` vs `TileMap` 的写法。

---

## 2. Godot 工程结构

```
fog-remembers-godot/
├── project.godot
├── assets/                      # 复用原作 public/assets + public/audio
│   ├── characters/              # character-survivor-player.png 等（已有）
│   ├── monsters/                # monster-wanderer/stalker/listener/brute/crawler.png（已有）
│   ├── items/                   # item-battery/potion/crucifix/clue-note.png（已有）
│   ├── scenes/                  # 关卡载入档案图（已有 + 待补）
│   ├── ui/                      # recall-sigil.png（已有）
│   ├── title/                   # key-art, grain（已有）
│   └── audio/                   # dark-ambience.ogg 等（已有）
├── scenes/                      # Godot 场景文件 (.tscn)
│   ├── Main.tscn                # 根：标题/游戏/暂停状态机
│   ├── Title.tscn               # 标题页
│   ├── Game.tscn                # 一局游戏的容器
│   ├── Level.tscn               # 单层（地图 + 实体）
│   ├── Player.tscn
│   ├── Monster.tscn             # 一个场景，按 kind 切换贴图/参数
│   ├── pickups/Battery.tscn / Potion.tscn / Crucifix.tscn
│   ├── Clue.tscn
│   ├── Sigil.tscn
│   ├── Survivor.tscn
│   └── ui/HUD.tscn / MiniMap.tscn / DialogueBox.tscn / EndScreen.tscn
├── scripts/
│   ├── autoload/                # 全局单例（见 §4）
│   │   ├── GameState.gd         # 跨场景状态、存档
│   │   ├── LevelDB.gd           # 关卡数据表（移植 LEVELS[]）
│   │   ├── AudioDirector.gd     # 动态配乐（移植 audio.ts）
│   │   └── Events.gd            # 全局信号总线
│   ├── player/Player.gd
│   ├── monsters/Monster.gd + 各 kind 行为
│   ├── world/MapGenerator.gd    # 移植 map.ts
│   ├── world/FogController.gd   # 视野/光照
│   ├── mechanics/               # ★ 每章差异化机制（本次重点，见 LEVEL_DESIGN.md）
│   │   ├── SoundLocator.gd      # 第2章 声源定位
│   │   ├── NameReturn.gd        # 第5章 名字归还
│   │   ├── WaterLevel.gd        # 第6章 重力与水位
│   │   └── MirrorReconstruct.gd # 第7章 光影重构
│   └── ui/HUD.gd ...
├── resources/                   # Godot Resource (.tres) 数据
│   ├── levels/*.tres            # 关卡配置（LevelDesign）
│   └── monsters/*.tres          # 怪物调参（KindTuning）
└── docs/                        # 复用现有 IP_BIBLE 等
```

---

## 3. 核心数据模型（移植 `types.ts` → Godot Resource / Class）

把原作 TS 接口映射成 Godot 的 `class_name` + `Resource`：

### 3.1 LevelDesign（关卡配置，存为 .tres Resource）

```gdscript
class_name LevelDesign extends Resource
@export var chapter: String
@export var title: String
@export var emotion: String          # 压抑 / 恐怖 / 悲伤 / 释怀
@export var mechanic: MechanicType   # ★ 枚举，决定加载哪个机制脚本
@export var dossier: String
@export var art_prompt_id: String
@export var clue_label: String
@export var sigil_label: String
@export var exit_label: String
@export var guide: GuideKind
@export var clue_count: int
@export var sigil_count: int
@export var intro: String
@export var clue_texts: PackedStringArray
@export var sigil_prompt: String
@export var exit_prompt: String
@export var complete_text: String
@export var monster_pressure: float
@export var theme: ThemeData
```

> **关键升级**：原作 `mechanic` 只是字符串。这里改成 `MechanicType` 枚举，`Level.gd` 据此 `add_child()` 对应的机制节点 —— 这是"玩法不再单一"的技术落点。

### 3.2 怪物调参（移植 `TUNING`，存为 .tres）

```gdscript
class_name MonsterTuning extends Resource
@export var speed: float
@export var chase_mul: float
@export var sight_range: float
@export var sight_arc: float        # 弧度
@export var detect_range: float
@export var hearing_range: float
@export var hearing_sensitivity: float
@export var lose_range: float
@export var alert_hold: float
@export var radius: float
```

5 种怪物（wanderer/stalker/listener/brute/crawler）各一个 .tres，数值直接抄原作 `monster.ts` 的 `TUNING`（已验证手感）。

### 3.3 运行时状态

- `Player.gd`：pos/angle/speed/stamina/battery/sanity/potions/shields/crucifix...（移植 `Player` 接口）
- 怪物状态机：`wander / investigate / chase`（移植 `MonsterState`）
- 整局状态放 `GameState`（autoload），含 depth/totalElapsed/道具/同伴携带（移植 `createInitialState` 的 carry 逻辑）

---

## 4. 全局单例（Autoload）

| 单例 | 职责 | 移植自 |
|------|------|--------|
| `GameState` | 当前层、道具、同伴、`best`、存档读写（`fog-save-v1` → Godot `user://save.cfg`） | `engine.ts` 的 save/carry 逻辑 |
| `LevelDB` | 8 个固定关卡 + 无尽层程序生成（`levelForDepth`） | `LEVELS[]` / `levelForDepth()` |
| `AudioDirector` | 按 danger/sanity/battery 动态混音、BGM 切换 | `audio.ts` |
| `Events` | 信号总线：`clue_collected`、`sigil_done`、`monster_alerted`、`player_caught`、`descended`... | 替代原作回调 `EngineCallbacks` |

> 用 Godot **信号**替代原作的手写回调，HUD/音频/成就各自订阅，解耦更干净。

---

## 5. 核心系统设计

### 5.1 玩家控制（移植 `player.ts` + `input.ts`）
- WASD/方向键移动；鼠标控制手电朝向（角度=玩家到鼠标）；Shift 奔跑（耗体力、放大噪声）。
- 体力 stamina：奔跑消耗、静止恢复、耗尽 exhausted 降速。
- 电量 battery：随时间流失（`drainRate = 0.014 + depth*0.0016`），决定手电锥范围与亮度；<0.25 触发闪烁（移植 `computeFlicker`）。
- 理智 sanity：靠近怪物/黑暗中下降，安全时缓慢恢复；低理智触发幻觉（屏幕抖动 + 假人影，移植 `updateHallucinations`）。
- 移动端：虚拟摇杆 + 触控按钮（Godot 用 `TouchScreenButton` / 自绘）。

### 5.2 雾与视野（Godot 光照重写，替代 `fog.ts`/`flashlight.ts`）
- `CanvasModulate` 把整个世界压成近黑。
- 玩家挂 `PointLight2D`：一个**锥形手电纹理**（带柔边）+ 一圈微弱环境光。
- 墙体 `TileMap` 配 `LightOccluder2D`，光被墙挡住 → 天然实现"看不到墙后"。
- 雾层：`ColorRect` + 噪声 shader（复用 `fog-remembers-grain.png` 做 grain），danger 越高雾越红越翻涌（移植 `renderFog`）。
- 低电量暗角、受击红闪、转场黑幕：用 `CanvasLayer` 上的全屏 shader/`ColorRect`。

> 这是相对原作的**画质升级**：原生光照遮挡比 Canvas 手画多边形更平滑，且免费获得动态阴影。

### 5.3 怪物 AI（移植 `monster.ts`，几乎 1:1）
状态机 `wander → investigate → chase`：
- **视觉**：在 `sight_range` 内 + 视野锥 `sight_arc` 内 + 有视线（射线检测墙）→ 发现。
- **听觉**：玩家 `noiseLevel`（走 0.28 / 跑 0.92 / 声呐 0.82 / 仪式 0.72）超过阈值 → 听见。listener 几乎全靠听觉。
- **chaseLock / stunTimer**：十字架定身、同伴牺牲后的冷却（移植已有手感）。
- Godot 实现：射线用 `RayCast2D` 或 `PhysicsDirectSpaceState2D.intersect_ray`；移动用 `move_and_slide` 或手动贴墙（沿用原作分轴滑墙逻辑，避免拐角卡死）。

### 5.4 声呐 / 小地图 / 引导（移植 `engine.ts` 对应段）
- Q 声呐：消耗电量，扩散 ping 圈、点亮局部地图、但放大噪声惊动怪物。
- 小地图：`visited` 网格 + 线索/仪式/同伴/出口点位（移植 `renderMiniMap`）。
- 心理引导特效（PsychGuide）：朝最近目标的方向画"灰烬/背影/杂音/晨光"动态指引（移植 `renderPsychGuide`，作为新手友好度，可在难度里开关）。

### 5.5 仪式 / 线索 / 同伴（移植对应逻辑 + 升级）
- 线索：靠近自动拾取，显示文本；集齐后仪式点激活。
- 仪式 Sigil：长按 E 充能，制造噪声、耗理智；全部完成后出口显影。
- 同伴 Survivor：救下后跟随；被抓时"以命换命"挡一次（移植 follower 逻辑）。
  - **★ 升级（道德系统）**：见 §6 与 `LEVEL_DESIGN.md` —— 同伴不再只是"挡刀盾",而是结局变量。

### 5.6 道具
- 电池 +100% 电量、拾取后异地刷新。
- 药水：10 秒护盾免死一次（移植 SHIELD_DURATION）。
- 十字架：定身周围怪物 4.2 秒（移植 FREEZE）。

---

## 6. 让玩法"不再单一"的四个新增系统（本次重制的灵魂）

> 详细落地见 `LEVEL_DESIGN.md`，这里给系统级概览。

1. **章节专属机制（Mechanic 插件化）**
   每章 `Level.gd` 根据 `LevelDesign.mechanic` 实例化一个机制节点。例如第 2 章加载 `SoundLocator`（必须靠听声辨位、关闭噪声源才能推进），第 6 章加载 `WaterLevel`（水位上涨改变可通行区域）。**这是把原作的"文本标签"变成真机制。**

2. **道德 / 罪责系统（Guilt）**
   主角沈迴回到灰洄镇是为确认"自己是否把人留在了雾里"。新增隐藏变量 `guilt`，受玩家选择影响（救同伴 / 牺牲同伴 / 归还名字 / 抛弃证物）→ 决定**多结局**（宽恕 / 沉沦 / 遗忘 / 直面）。

3. **资源取舍与"还能走多深"**
   把无尽下沉做成真正的风险决策：每层结束可选择"带着证物上岸（结算当前结局）"或"继续下沉（更多补给但更凶险，且 guilt 阈值变化）"。让标题里的"决定自己还能走到多深"成为机制。

4. **降噪潜行循环**
   原作噪声只是被听见的副作用。重制把它做成核心张力：listener 类怪物在多个章节成为主威胁，玩家要在"快速推进（吵）"和"安全慢行（耗电耗时）"间权衡。

---

## 7. 资产复用映射（现有 → Godot）

| 现有资产 | Godot 用途 |
|----------|-----------|
| `characters/character-survivor-player.png` | 玩家 sprite（俯视可用立绘缩小或作 UI 头像） |
| `characters/character-rescued-survivor.png` | 同伴 sprite |
| `characters/hallucination-shadow.png` | 幻觉影 |
| `monsters/monster-*.png`（5 张） | 5 种怪物 sprite |
| `items/item-*.png`（电池/药水/十字架/线索） | 道具 sprite |
| `scenes/scene-*.png`（9 张） | 关卡载入档案图（载入页 + 暂停档案） |
| `title/fog-remembers-key-art.png` + `grain.png` | 标题页 + 雾 grain shader |
| `ui/recall-sigil.png` | 仪式/Logo |
| `audio/*.ogg/.mp3` | BGM + 氛围（注意 `slient.mp3` 疑似拼写错，沿用即可） |
| `generated/foggy-asphalt-floor.png` | 地面 tile 纹理 |

> **缺口**（需 gpt-image-2 生成）：俯视角的玩家/怪物/道具 **sprite sheet**（现有是立绘/概念图，俯视角游戏更需要俯视小图标）、地面/墙体 tileset、各章专属机制道具图标。清单见 `ART_PROMPTS.md`。

---

## 8. 里程碑（确认本文档后的实施顺序）

| 阶段 | 交付 | 说明 |
|------|------|------|
| **M0** | Godot 空工程 + 资产导入 + autoload 骨架 | 能跑起黑屏 |
| **M1** | 玩家移动 + 手电光照 + 程序化地图 + 相机 | 能在雾里走 |
| **M2** | 怪物 AI + 线索 + 仪式 + 出口 + 下沉 | **最小可玩循环**（对齐原作） |
| **M3** | HUD + 小地图 + 声呐 + 道具 + 同伴 + 音频 | 功能对齐原作 |
| **M4** | ★ 章节差异化机制（4 个）+ 道德系统 + 多结局 | **超越原作的深度** |
| **M5** | gpt-image-2 美术替换 + 打磨 + 导出 | 成品 |

---

## 9. 待你拍板的问题

1. **Godot 版本**：4.2 / 4.3 / 4.4？（影响 TileMap API）
2. **机制差异化做几个**：我建议先做 4 个最有代表性的（第2章声源定位、第3章追逐压迫、第5章名字归还、第6章水位）。要全做 8 个吗？
3. **道德系统 / 多结局**：要做吗？（这是把"平庸"变"有深度"的最大杠杆，但工作量也最大）
4. **平台**：只 PC？还是也要移动端触控（原作有）？
5. **生图**：先吊销你泄露的 key；本轮要不要我连带把 Godot 端的"生图脚本 + .env 接入"也设计进 `ART_PROMPTS.md`？

> 确认这 5 点后，我开始按 M0→M2 搭可跑原型。
