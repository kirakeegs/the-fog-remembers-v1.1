# AI + MCP 游戏生产方案

本方案针对当前项目状态编写：`Next.js 15 + React 19 + TypeScript + HTML5 Canvas + Web Audio/音频资源`。项目已经有一套可玩的自研 2D 恐怖 roguelite 原型，短期目标不是重写为 Phaser，而是先把原创 IP、玩法闭环、测试和资源管线稳定下来。

## 1. 推荐 MCP 配置

### 必接 MCP

| MCP | 权限范围 | 用途 | 安全边界 |
| --- | --- | --- | --- |
| Filesystem MCP | 只开放项目目录 `the-fog-remembers` | 读写代码、文档、资源清单、关卡配置 | 禁止全盘访问；资源生成只写入 `public/assets`、`docs`、`game/data` |
| Playwright MCP | 本地浏览器 + `localhost` | 自动打开游戏、截图、检查标题页/HUD/移动端布局 | 只跑本地地址；不要让测试脚本访问登录站点 |
| Fetch MCP | 官方文档域名 | 读取 Next/React/Canvas/Web Audio/Phaser/Howler 文档 | 只读；不执行网页下载脚本 |
| Memory MCP | 项目级世界观记忆 | 保存原创 IP 设定、人物、怪物、章节、禁用梗 | 不存 API key、私人账号、真实个人信息 |

### 推荐接入 MCP

| MCP | 使用时机 | 说明 |
| --- | --- | --- |
| GitHub MCP | 项目迁入 Git 仓库后 | 管理 issue、里程碑、PR、版本记录。当前目录未检测到 `.git`，先按可选项处理 |
| Brave Search / Tavily MCP | 查资料或找参考实现时 | 搜 Phaser/Tiled/音频/UI 资料；生成代码前优先读官方文档 |
| Sequential Thinking MCP | 拆大任务时 | 用于章节设计、结局路线、怪物系统、资源生产计划 |
| Figma MCP | 有 UI 设计稿后 | 标题页、HUD、菜单、背包、设置页转前端 |

### 本地 MCP 配置模板

下面是通用模板，字段名需要按你的 MCP 客户端调整。关键点是权限边界，不是复制即用。

```json
{
  "mcpServers": {
    "filesystem-the-fog-remembers": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:/Users/gj/the-fog-remembers"
      ]
    },
    "playwright-local": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    },
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"]
    },
    "memory-project": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

### MCP 工作流

1. 用 Memory MCP 固定 IP 圣经：项目名、原创世界观、主角、核心创伤、怪物象征、章节路线、禁用直接照搬的外部 IP 元素。
2. 用 Filesystem MCP 改代码和维护 `docs/`、`game/data/`、`public/assets/`。
3. 用 Playwright MCP 每次改 UI 后跑标题页、游戏页、移动端截图。
4. 用 Fetch/Search MCP 查库和文档，只把结论沉淀到 issue 或文档，不直接复制未知项目代码。
5. 接入 GitHub 后，把阶段任务拆成 issue：玩法、剧情、UI、音频、QA、资源。

## 2. 技术栈与目录结构

### 当前技术栈判断

当前原型已经覆盖：

- `game/engine.ts`：主循环、关卡推进、HUD 数据、存档、怪物生成、渲染调度。
- `game/maze.ts` / `game/map.ts`：程序化迷宫和地图。
- `game/monster.ts`：多类型怪物 AI。
- `game/audio.ts`：音频系统。
- `components/GameCanvas.tsx`：Canvas 挂载、HUD、触控、叠层 UI。
- `app/page.tsx`：标题页、剧情轮播、开始/继续流程。
- `public/audio`：标题和背景音频资源。

所以第一阶段建议保留自研 Canvas 引擎。Phaser、Howler、GSAP、Tiled 放到第二阶段验证，不急着迁移。

### 推荐目录结构

```text
app/
  layout.tsx
  page.tsx
components/
  GameCanvas.tsx
  hud/
  menu/
game/
  audio.ts
  engine.ts
  flashlight.ts
  fog.ts
  input.ts
  map.ts
  maze.ts
  monster.ts
  player.ts
  types.ts
  data/
    chapters.ts
    clues.ts
    monsters.ts
    items.ts
    balance.ts
public/
  audio/
  assets/
    characters/
    monsters/
    tiles/
    ui/
    title/
docs/
  AI_MCP_PRODUCTION_PLAN.md
  IP_BIBLE.md
  FIRST_VERTICAL_SLICE.md
  QA_CHECKLIST.md
  ASSET_PIPELINE.md
tests/
  e2e/
    title.spec.ts
    gameplay-smoke.spec.ts
```

### 演进路线

| 阶段 | 技术选择 | 判断标准 |
| --- | --- | --- |
| 第一阶段 | 保留 Canvas + Next | 做出 10-15 分钟原创垂直切片，稳定可玩 |
| 第二阶段 | 引入 Howler.js | 当前音频系统如果开始难以管理 BGM、环境音、距离衰减、音量总线，就迁 |
| 第二阶段 | 引入 GSAP | 标题页、章节过场、菜单转场需要更稳定的动画编排时再上 |
| 第三阶段 | 评估 Phaser + Tiled | 如果关卡从程序化迷宫转向大量手工地图、碰撞层、对象层，再迁 |
| 第三阶段 | 评估 XState/Zustand | 如果状态分支扩展到多结局、背包、任务、NPC 对话，再拆状态机 |

## 3. 原创 IP 落地原则

当前标题和表达强烈接近既有恐怖 IP。要做可落地原创作品，建议立刻建立替代表达：

- 项目工作名：`The Fog Remembers` / `雾会记得`。
- 避免使用受保护 IP 名称作为正式标题、商店标题、宣传关键词。
- 保留“雾、罪责、声音线索、下沉、心理恐怖”的氛围方向，但重写世界观来源、地名、怪物命名和核心符号。
- 怪物不以“像某某作品”为设计目标，而以“罪责机制 + 玩家行为约束”为设计目标。
- 每个章节必须有唯一玩法关键词，避免只是换皮迷宫。

已新增 `docs/IP_BIBLE.md` 固定以下内容：

```text
1. 游戏正式名与一句话卖点
2. 世界观起因
3. 主角背景与不可直接明说的秘密
4. 四章主线与每章核心情绪
5. 怪物图鉴：名字、行为、象征、声音、弱点
6. 道具图鉴：玩法效果、叙事含义
7. 结局条件
8. 禁用元素清单
```

## 4. 第一阶段开发 TODO

目标：完成一个 10-15 分钟的原创垂直切片，包含标题页、前 4 层、一次明确的小结局、稳定的移动端/桌面端体验。

### A. 项目基础

- [ ] 初始化 Git 仓库，提交当前可运行原型。
- [ ] 修复 `README.md` 的编码损坏内容，改成原创项目介绍。
- [x] 新增 `docs/IP_BIBLE.md`，将外部 IP 风格描述替换为原创描述。
- [ ] 新增 `docs/QA_CHECKLIST.md`，列出每次发版的手测路径。
- [ ] 将大段关卡文本从 `game/engine.ts` 拆到 `game/data/chapters.ts`。

### B. 玩法闭环

- [ ] 明确第一章 4 层：街口、公寓、医院、教堂，每层一个独特互动机制。
- [ ] 做一个可触发的小结局：完成第 4 层后进入结算页，而不是只无限下沉。
- [ ] 增加难度曲线表：怪物数量、补给数量、手电耗电、理智损耗。
- [ ] 为“聆听者”加入更清楚的声音反馈，让玩家理解站定策略。
- [ ] 为药水、十字架、声呐加冷却/反馈提示，减少 HUD 读数依赖。

### C. 叙事与 IP

- [ ] 给主角、镇名、医院名、核心事故重新命名。
- [ ] 把外部 IP 影子强的标题、README、页面文案替换为原创表达。
- [ ] 每层新增 3-5 条可收集文本，形成可拼出的真相。
- [ ] 设计 3 个怪物正式名：行为名、象征名、玩家叫法各一套。
- [ ] 写结局条件：逃离、沉没、替身、宽恕。

### D. 视觉与资源

- [x] 建立 `public/assets/title`，存标题页背景、噪声贴图。
- [ ] 建立 `public/assets/monsters`，存怪物剪影或像素/手绘资源。
- [ ] 先用 4 套关卡调色和地面/墙体纹理，不急着做完整 tileset。
- [x] 标题页首屏改成原创品牌名，不再使用外部 IP 名称。
- [ ] 增加设置页：音量、亮度、移动端摇杆开关、画面噪点强度。

### E. 音频

- [ ] 整理 `public/audio/CREDITS.md`，确认每个音频文件授权。
- [ ] 定义音频总线：BGM、环境、怪物、UI、玩家。
- [ ] 增加怪物靠近的方向性/距离感音效。
- [ ] 增加关键交互音：拾取、仪式推进、出口开启、护盾倒计时。
- [ ] 评估是否引入 Howler.js；如果只是播放少量循环音，暂不迁。

### F. 自动化 QA

- [ ] 增加 Playwright 依赖和 `tests/e2e/title.spec.ts`。
- [ ] 自动检查标题页：主标题可见、开始按钮可点、继续按钮按存档显示。
- [ ] 自动检查游戏页：Canvas 非空、HUD 可见、返回标题可用。
- [ ] 截图桌面 `1440x900`、移动端 `390x844`，检查 UI 不遮挡。
- [ ] 在 `package.json` 增加 `test:e2e` 脚本。

## 5. 第一阶段验收标准

- 桌面和移动端都能从标题页开始游戏，并完成前 4 层。
- 没有直接使用外部 IP 名称作为正式游戏标题。
- 玩家能通过声音/视觉线索找到目标，不依赖纯随机试错。
- 死亡、暂停、返回标题、继续存档、结算流程稳定。
- Playwright smoke test 能覆盖标题页和 Canvas 游戏页。
- 文档中能清楚说明世界观、怪物、道具、章节和下一阶段计划。
