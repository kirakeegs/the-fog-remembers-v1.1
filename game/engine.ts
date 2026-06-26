import { AudioEngine } from "./audio";
import { castFlashlight, castVisibility, inAmbient, inFlashlight, CONE_RANGE, AMBIENT_RANGE } from "./flashlight";
import { renderDarkness, renderFog, renderDamageFlash, renderGrain, renderLowBattery } from "./fog";
import { createInput } from "./input";
import { buildMap, findOpenCells, GameMap, isWall, TILE } from "./map";
import {
  attackMonsters,
  ATTACK_RANGE,
  caughtPlayer,
  createMonster,
  dangerLevel,
  nearestMonsterDist,
  STATIC_RANGE,
  updateMonster,
} from "./monster";
import { createPlayer, updatePlayer } from "./player";
import { AshPickup, Clue, GameState, Monster, MonsterKind, Pickup, Player, Sigil, Survivor, Vec2 } from "./types";
import { coneAngleFor, coneRangeFor } from "./flashlight";

const CLUE_TEXTS = [
  "纸条：雾散之前，别回头看。",
  "日记残页：它们看不见光，只听得见声音。",
  "备忘：钥匙在最深的走廊——如果那还是走廊的话。",
  "照片背面：我们曾都住在这里。",
  "涂鸦：当收音机尖叫时，停下脚步。",
  "墙上的刻痕：越往下沉，雾越饿。",
  "病历：聆听者没有眼睛，安静就好。",
  "残缺广播：……第七层以下，时间不再笔直……",
  "孩子的画：许多人排成一列走进雾里，没有人回头。",
  "撕碎的告示：不要相信那些伸手求救的影子——除非你看得清它的脸。",
  "教授的字条：十字架能定住它们几秒，但信仰在这里会折价。",
  "药剂师配方：这瓶红色的东西能让死亡延后一次，只一次。",
];

// 每层的开场旁白，让"越往下沉"有连贯的剧情
const DEPTH_INTRO: Record<number, string> = {
  1: "第一层 · 归潮街区。你醒来时，雾已经吞掉了整条街。",
  2: "第二层 · 废弃医院。消毒水的味道还没散，走廊里有人在等。",
  3: "第三层 · 地下水道。回声会被偷走，轻声。",
  4: "第四层 · 锈狱回廊。这里的影子比人还重。",
  5: "第五层 · 灰烬教堂。圣物还认得祈祷，但只够用一次。",
  6: "第六层 · 镜渊。所有倒影都在替你数心跳。",
  7: "第七层 · 无声市集。这里的摊位只收你忘记的东西。",
};

const SHIELD_DURATION = 10;
const BASE_CLUES = 2;
const BASE_SIGILS = 2;
const BEST_KEY = "fog-best-depth";
const SAVE_KEY = "fog-save-v1";
const FREEZE_RADIUS = TILE * 5.5;
const FREEZE_TIME = 4.2;
const SACRIFICE_CHASELOCK = 5.0;
const SHIELD_CHASELOCK = 2.2;
const SCAN_COOLDOWN = 7;
const SCAN_COST = 0.07;
const SCAN_RANGE = TILE * 7.5;
const VISIT_RANGE = TILE * 2.35;
const SIGIL_RANGE = TILE * 0.78;
const SIGIL_CLEANSE_TIME = 2.2;
const SURVIVOR_RANGE = TILE * 0.78;

export type GuideKind = "ash" | "ghost" | "radio" | "light" | "heartbeat" | "bell" | "water" | "silence";

interface LevelDesign {
  chapter: string;
  title: string;
  emotion: string;
  mechanic: string;
  dossier: string;
  artPromptId: string;
  clueLabel: string;
  sigilLabel: string;
  exitLabel: string;
  guide: GuideKind;
  clueCount: number;
  sigilCount: number;
  intro: string;
  clueTexts: string[];
  sigilPrompt: string;
  exitPrompt: string;
  completeText: string;
  monsterPressure: number;
  theme: { floorA: string; floorB: string; wall: string; wallLine: string; bgm: number };
}

const LEVELS: LevelDesign[] = [
  {
    chapter: "迷雾与原罪",
    title: "归潮街口",
    emotion: "压抑",
    mechanic: "雾中潜行",
    dossier: "住宅街被雾折叠成同一个路口。邮箱、车铃和迟到的承诺会把你带回第一处罪证。",
    artPromptId: "scene-tidal-street",
    clueLabel: "物证",
    sigilLabel: "信箱",
    exitLabel: "家门",
    guide: "bell",
    clueCount: 3,
    sigilCount: 1,
    intro: "第一章 · 归潮街口。路灯在雾里像病斑，铃声从没有孩子的街口传来。",
    clueTexts: ["钥匙冰冷，像从很深的水里捞出。", "小票上的时间被雨泡开，只剩“未归”。", "婚戒内侧刻着一句话：别再迟到。"],
    sigilPrompt: "把三件日常物放回信箱。你想证明那晚只是一次晚归。",
    exitPrompt: "听自行车铃声。家门会在雾最厚的地方等你。",
    completeText: "信箱里没有信，只有你自己的声音：我马上回来。",
    monsterPressure: 0.72,
    theme: { floorA: "#403d37", floorB: "#363330", wall: "#5d5953", wallLine: "#403b36", bgm: 0 },
  },
  {
    chapter: "迷雾与原罪",
    title: "废弃公寓",
    emotion: "压抑",
    mechanic: "声源定位",
    dossier: "每扇门后都是同一间客厅。收音机保留了争吵，走廊会在你关闭噪声后重新排列。",
    artPromptId: "scene-abandoned-apartment",
    clueLabel: "收音机",
    sigilLabel: "静音点",
    exitLabel: "电梯",
    guide: "radio",
    clueCount: 4,
    sigilCount: 1,
    intro: "第一章 · 废弃公寓。每扇门后都是同一间客厅，争吵声从墙纸下面渗出。",
    clueTexts: ["第一台收音机熄灭，楼道短了一截。", "第二段争吵断开，墙内有人吸气。", "第三台收音机说：你又要走了吗？", "最后一台只剩孩子很轻的哭声。"],
    sigilPrompt: "关闭噪声核心。沉默不是原谅，只是又一次掩埋。",
    exitPrompt: "听电梯钢缆摩擦声，门缝的冷光会偏向出口。",
    completeText: "电梯打开，里面不是轿厢，而是一条铺满白布的医院走廊。",
    monsterPressure: 0.8,
    theme: { floorA: "#3d3a35", floorB: "#33302d", wall: "#5b554e", wallLine: "#3f3934", bgm: 0 },
  },
  {
    chapter: "铁锈与心魔",
    title: "铁锈医院",
    emotion: "恐怖",
    mechanic: "狂暴追逐",
    dossier: "病床倒挂，手术灯像审讯灯。你要让急救电闸重新亮起，直到雨衣下面的空洞无法再被忽略。",
    artPromptId: "scene-rust-hospital",
    clueLabel: "急救电闸",
    sigilLabel: "手术灯",
    exitLabel: "手术室",
    guide: "heartbeat",
    clueCount: 3,
    sigilCount: 2,
    intro: "第二章 · 铁锈医院。病床倒挂在天花板上，输液管垂下来寻找你的脉搏。",
    clueTexts: ["第一台电闸咬住手掌，走廊醒了。", "第二盏灯照出一件儿童雨衣。", "第三次拉闸后，身后的门全开了。"],
    sigilPrompt: "让手术灯照向病床。你必须看见雨衣下面的空洞。",
    exitPrompt: "跟着心电仪尖叫的方向走，越急促越接近手术室。",
    completeText: "手术灯照亮雨衣。雨衣下没有身体，只有刹车声。",
    monsterPressure: 1.35,
    theme: { floorA: "#45372f", floorB: "#392c25", wall: "#6c4f43", wallLine: "#43342b", bgm: 1 },
  },
  {
    chapter: "铁锈与心魔",
    title: "肉墙地下道",
    emotion: "恐怖",
    mechanic: "噪音搬运",
    dossier: "地下道像活物一样收缩。心脏保险丝越接近配电箱越吵，聆听者也会越快醒来。",
    artPromptId: "scene-flesh-tunnel",
    clueLabel: "心脏保险丝",
    sigilLabel: "配电箱",
    exitLabel: "肉墙裂缝",
    guide: "water",
    clueCount: 3,
    sigilCount: 2,
    intro: "第二章 · 肉墙地下道。墙壁像喉管一样收缩，血水把“不是我的错”冲到脚边。",
    clueTexts: ["保险丝在手里跳动，像一颗不肯停下的心。", "第二颗心脏开始尖叫，听觉怪物抬起头。", "第三颗心脏让整条地下道跟着你呼吸。"],
    sigilPrompt: "把心脏保险丝插回配电箱。罪证越靠近目标越吵。",
    exitPrompt: "看血水流向。墙体脉动会把裂缝的位置泄露出来。",
    completeText: "肉墙裂开，缝里是一辆翻倒的车和一只空的安全椅。",
    monsterPressure: 1.45,
    theme: { floorA: "#3d2f2c", floorB: "#302522", wall: "#6a3d36", wallLine: "#3d201d", bgm: 1 },
  },
  {
    chapter: "灰烬与挽歌",
    title: "灰烬教堂",
    emotion: "悲伤",
    mechanic: "名字归还",
    dossier: "灰烬落地时像翻页。无脸幻影跪在破碎长椅之间，等待你把名字还给他们。",
    artPromptId: "scene-ash-church",
    clueLabel: "名字",
    sigilLabel: "幻影",
    exitLabel: "灰门",
    guide: "ash",
    clueCount: 4,
    sigilCount: 4,
    intro: "第三章 · 灰烬教堂。灰像雪一样落下，落地时却发出翻页声。",
    clueTexts: ["一个名字从悼词边缘剥落。", "录音里有人把生日歌唱错了。", "儿童画背面写着：我等你。", "墓���背面没有日期，只有“回家”。"],
    sigilPrompt: "把名字还给哭泣的幻影。别再把他们叫作事故。",
    exitPrompt: "顺着灰烬飘落的方向走，合唱会在正确方向变清晰。",
    completeText: "幻影抬头，脸仍模糊，但哭声变成了合唱。",
    monsterPressure: 0.55,
    theme: { floorA: "#3a3833", floorB: "#322f2b", wall: "#5a5346", wallLine: "#3a352c", bgm: 1 },
  },
  {
    chapter: "灰烬与挽歌",
    title: "沉没学校",
    emotion: "悲伤",
    mechanic: "重力与水位",
    dossier: "课桌漂在灰白水面上，钢琴反复弹错同一个音。作业本仍在等一个不会来的批改。",
    artPromptId: "scene-sunken-school",
    clueLabel: "作业本",
    sigilLabel: "座位",
    exitLabel: "海岸门",
    guide: "water",
    clueCount: 3,
    sigilCount: 3,
    intro: "第三章 · 沉没学校。课桌漂在灰白的水面，钢琴错一个音就重来。",
    clueTexts: ["作业本泡胀了，字迹仍在等批改。", "第二本写着：爸爸今天会来。", "最后一本没有题目，只有一整页空白。"],
    sigilPrompt: "让作业本回到座位。错位的未来不能再被推开。",
    exitPrompt: "听钢琴声，音准越稳定，海岸门越近。",
    completeText: "黑板浮现一行字：我等到天黑。",
    monsterPressure: 0.45,
    theme: { floorA: "#333a40", floorB: "#283036", wall: "#4a5560", wallLine: "#343d46", bgm: 0 },
  },
  {
    chapter: "晨曦与宽恕",
    title: "破晓海岸",
    emotion: "释怀",
    mechanic: "光影重构",
    dossier: "退潮后的沙滩露出病历夹、车灯碎片和街牌。反光镜会让阴影承认真相。",
    artPromptId: "scene-dawn-coast",
    clueLabel: "影像碎片",
    sigilLabel: "反光镜",
    exitLabel: "病房门",
    guide: "light",
    clueCount: 3,
    sigilCount: 3,
    intro: "第四章 · 破晓海岸。海水退去，沙里露出街牌、病历夹和车灯碎片。",
    clueTexts: ["影子拼出争吵，声音却很平静。", "第二段影像里，方向盘没有松开。", "第三段影像照见你在雨里反复说：不是我的错。"],
    sigilPrompt: "转动反光镜，让影子承认真相。",
    exitPrompt: "追随晨光折射，不要追随阴影。",
    completeText: "黑影转身离开，没有原谅，也没有诅咒。",
    monsterPressure: 0.35,
    theme: { floorA: "#3f443f", floorB: "#343a36", wall: "#5c635a", wallLine: "#404840", bgm: 2 },
  },
  {
    chapter: "晨曦与宽恕",
    title: "晨曦病房",
    emotion: "释怀",
    mechanic: "放下与等待",
    dossier: "窗帘后有风，铁锈从床架上剥落。最后一层不再要求你战斗，只要求你放下。",
    artPromptId: "scene-dawn-ward",
    clueLabel: "遗物",
    sigilLabel: "床头柜",
    exitLabel: "晨光",
    guide: "silence",
    clueCount: 4,
    sigilCount: 1,
    intro: "第四章 · 晨曦病房。铁锈从床架上剥落，窗帘后有风，HUD 也开始沉默。",
    clueTexts: ["你放下药水。死亡不再需要被欺骗。", "你放下十字架。信仰不是用来定住怪物的。", "你放下手电。黑暗没有再扑上来。", "你放下婚戒。爱存在过，伤害也存在过。"],
    sigilPrompt: "把遗物放回床头柜。最后走向窗边，什么都不要按。",
    exitPrompt: "晨光会自己变宽。静止，呼吸，等它经过你。",
    completeText: "孩子问：你还会忘记我吗？你说：我会想起你。",
    monsterPressure: 0,
    theme: { floorA: "#4b504a", floorB: "#444a45", wall: "#687064", wallLine: "#4f584e", bgm: 3 },
  },
];

const ENDLESS_NAMES = ["反复病房", "倒置街区", "锈蚀回声层", "无窗公寓", "灰水礼拜堂", "黑潮学校"];
const ENDLESS_GUIDES: GuideKind[] = ["radio", "heartbeat", "ash", "water", "light", "ghost", "bell", "silence"];
const ENDLESS_CLUE_LABELS = ["残页", "录音带", "照片碎片", "病历夹", "锈钥匙", "陌生名字"];
const ENDLESS_SIGIL_LABELS = ["忏悔点", "裂缝", "供桌", "镜面", "无声门", "回声井"];
const ENDLESS_EXIT_LABELS = ["更深的楼梯", "下行电梯", "黑水门", "锈井", "坠落口", "雾底裂缝"];
const ENDLESS_MECHANICS = ["无尽搜证", "深层回声", "压迫追逐", "雾中救援", "资源远征", "仪式下沉"];
const ENDLESS_THEMES = [
  { floorA: "#343230", floorB: "#292726", wall: "#55504a", wallLine: "#332f2b", bgm: 2 },
  { floorA: "#3c2f2b", floorB: "#2f2421", wall: "#684338", wallLine: "#3a221d", bgm: 3 },
  { floorA: "#30393a", floorB: "#273031", wall: "#50605d", wallLine: "#31403c", bgm: 4 },
  { floorA: "#3d3a33", floorB: "#302e29", wall: "#5f5748", wallLine: "#3d372d", bgm: 1 },
  { floorA: "#343740", floorB: "#282c34", wall: "#505765", wallLine: "#323946", bgm: 0 },
];

export interface EngineCallbacks {
  onPhaseChange?: (phase: GameState["phase"]) => void;
  onHud?: (hud: HudData) => void;
}

export interface HudData {
  collected: number;
  total: number;
  elapsed: number;
  stamina: number;
  danger: number;
  noise: number;
  battery: number;
  sanity: number;
  depth: number;
  best: number;
  sigils: number;
  sigilTotal: number;
  scan: number;
  rescued: number;
  survivorTotal: number;
  shields: number;
  shieldTimer: number;
  potions: number;
  crucifix: number;
  invuln: number;
  chapter: string;
  levelTitle: string;
  emotion: string;
  mechanic: string;
  intro: string;
  dossier: string;
  artPromptId: string;
  clueLabel: string;
  sigilLabel: string;
  exitLabel: string;
  sigilPrompt: string;
  exitPrompt: string;
  guide: GuideKind;
}

export class GameEngine {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private map: GameMap;
  private state: GameState;
  private audio: AudioEngine;
  private input: ReturnType<typeof createInput>;
  private camera: Vec2 = { x: 0, y: 0 };
  private raf = 0;
  private lastTime = 0;
  private flashTimer = 0;
  private cb: EngineCallbacks;
  private running = false;
  private best = 0;
  private hallucTimer = 0;
  private scanCooldown = 0;
  private survivorsSaved = 0;
  private theme: Theme = themeForDepth(1);
  private floorTexture: HTMLImageElement | null = null;
  private floorPattern: CanvasPattern | null = null;

  // 水纹追踪器采样计时器
  private rippleSampleTimer = 0;

  constructor(canvas: HTMLCanvasElement, audio: AudioEngine, cb: EngineCallbacks = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot acquire 2D context");
    this.ctx = ctx;
    this.audio = audio;
    this.cb = cb;
    this.best = this.loadBest();
    this.map = buildMap(1);
    this.input = createInput(canvas, () => this.camera);
    this.state = this.createInitialState(1);
    this.loadFloorTexture();
  }

  private loadFloorTexture() {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      this.floorTexture = image;
      this.floorPattern = null;
    };
    image.onerror = () => {
      this.floorTexture = null;
      this.floorPattern = null;
    };
    image.src = "/assets/generated/foggy-asphalt-floor.png";
  }

  private loadBest(): number {
    try {
      return parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
    } catch {
      return 0;
    }
  }

  private saveBest(depth: number) {
    if (depth <= this.best) return;
    this.best = depth;
    try {
      localStorage.setItem(BEST_KEY, String(depth));
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }

  private createInitialState(
    depth: number,
    carry?: {
      battery: number;
      sanity: number;
      totalElapsed: number;
      potions?: number;
      shields?: number;
      shieldTimer?: number;
      crucifix?: number;
      hadFollower?: boolean;
    },
  ): GameState {
    const design = levelForDepth(depth);
    this.map = buildMap(depth);
    const player = createPlayer(this.map.spawn);
    const visited = createVisitedGrid(this.map.rows, this.map.cols);
    markVisitedArea(visited, this.map, player.pos, VISIT_RANGE);
    if (carry) {
      const depthBonus = endlessBonus(depth);
      // 电量可累积，不设 100% 上限；越往下沉，过关补给越慷慨。
      player.battery = carry.battery + 0.35 + depthBonus.battery;
      player.sanity = Math.min(1, carry.sanity + 0.25 + depthBonus.sanity);
      // 道具跨层保留；限时护盾只保留剩余倒计时，避免永久免死。
      player.potions = (carry.potions ?? 0) + depthBonus.potions;
      player.shieldTimer = Math.max(0, carry.shieldTimer ?? 0);
      player.shields = player.shieldTimer > 0 ? Math.max(1, carry.shields ?? 1) : 0;
      player.crucifix = (carry.crucifix ?? 0) + depthBonus.crucifix;
    }

    const cells = findOpenCells(this.map).filter(
      (c) => Math.hypot(c.x - player.pos.x, c.y - player.pos.y) > TILE * 4,
    );
    shuffle(cells);

    const clueCells = selectScatteredCells(cells, design.clueCount, [player.pos], TILE * 4.2);
    const clues: Clue[] = clueCells.map((pos, i) => ({
      pos,
      collected: false,
      text: design.clueTexts[i] ?? CLUE_TEXTS[(i + depth) % CLUE_TEXTS.length],
    }));

    // 幸存者：最多一名。若上一关带下来一名已解救的同伴，则直接让它跟随。
    const survivors: Survivor[] = [];
    const survivorCells: Vec2[] = [];
    if (carry?.hadFollower) {
      survivors.push({
        pos: { x: player.pos.x - TILE * 0.6, y: player.pos.y },
        rescued: true,
        followOffset: 0,
        sacrificed: false,
      });
    } else {
      const sc = selectScatteredCells(cells, 1, [player.pos, ...clueCells], TILE * 4);
      for (let i = 0; i < sc.length; i++) {
        survivorCells.push(sc[i]);
        survivors.push({ pos: sc[i], rescued: false, followOffset: i, sacrificed: false });
      }
    }

    // 电池：每块 +100%，拾取后在别处刷新
    const batteryCount = 2 + Math.floor(depth / 3) + Math.max(0, Math.floor((depth - LEVELS.length) / 4));
    const batteryCells = selectScatteredCells(cells, batteryCount, [player.pos, ...clueCells, ...survivorCells], TILE * 3);
    const pickups: Pickup[] = batteryCells.map((pos) => ({ pos, taken: false, kind: "battery" }));

    // 道具：生命药水（饮用获得一次免疫护盾）、十字架（定身附近怪物数秒）
    const itemAnchors = [player.pos, ...clueCells, ...survivorCells, ...batteryCells];
    const potionCells = selectScatteredCells(cells, 1 + Math.floor(depth / 4) + Math.max(0, Math.floor((depth - LEVELS.length) / 6)), itemAnchors, TILE * 3);
    for (const pos of potionCells) pickups.push({ pos, taken: false, kind: "potion" });
    const crucifixCells = selectScatteredCells(cells, 1 + Math.floor(depth / 5) + Math.max(0, Math.floor((depth - LEVELS.length) / 7)), [...itemAnchors, ...potionCells], TILE * 3);
    for (const pos of crucifixCells) pickups.push({ pos, taken: false, kind: "crucifix" });

    // 收音机：第 2 层起可拾取（被动探测怪物）
    if (depth >= 2 && !player.radio) {
      const radioCells = selectScatteredCells(cells, 1, [...itemAnchors, ...potionCells, ...crucifixCells], TILE * 3);
      for (const pos of radioCells) pickups.push({ pos, taken: false, kind: "radio" });
    }
    // 水纹追踪器：第 3 层起可拾取（显示怪物路径）
    if (depth >= 3 && !player.rippleTracker) {
      const trackerCells = selectScatteredCells(cells, 1, [...itemAnchors, ...potionCells, ...crucifixCells], TILE * 3);
      for (const pos of trackerCells) pickups.push({ pos, taken: false, kind: "ripple-tracker" });
    }

    // 灰烬：失去者的名字，需要归还到仪式点（道德选择）
    const ashNames = ["林小满", "周屿", "陈停舟", "未署名的孩子", "船工老何", "晚归的护士"];
    const ashCount = Math.min(2 + Math.floor(depth / 2), 4);
    const ashCells = selectScatteredCells(cells, ashCount, [...itemAnchors, ...potionCells, ...crucifixCells], TILE * 3.5);
    const ashPickups: AshPickup[] = ashCells.map((pos, i) => ({
      pos,
      taken: false,
      name: ashNames[(i + depth) % ashNames.length],
      returned: false,
    }));

    const sigilCandidates = cells.filter(
      (c) =>
        Math.hypot(c.x - player.pos.x, c.y - player.pos.y) > TILE * 5 &&
        clues.every((clue) => Math.hypot(c.x - clue.pos.x, c.y - clue.pos.y) > TILE * 2),
    );
    const sigilCells = selectScatteredCells(
      sigilCandidates,
      design.sigilCount,
      [player.pos, ...clueCells, ...survivorCells],
      TILE * 3.6,
    );
    const sigils: Sigil[] = sigilCells.map((pos) => ({
      pos,
      active: false,
      progress: 0,
      pulse: 0,
    }));

    const kinds = monsterPlanForDepth(depth);
    const monsterCandidates = cells.filter(
      (c) =>
        Math.hypot(c.x - player.pos.x, c.y - player.pos.y) > TILE * 6 &&
        clues.every((clue) => Math.hypot(c.x - clue.pos.x, c.y - clue.pos.y) > TILE * 2),
    );
    const monsterCells = selectScatteredCells(
      monsterCandidates,
      kinds.length,
      [player.pos, ...clueCells, ...survivorCells],
      TILE * 3,
    );
    const monsters = monsterCells.map((c, i) => createMonster(c, kinds[i % kinds.length]));
    const monsterSpeedScale = 1 + Math.min(0.65, Math.max(0, depth - LEVELS.length) * 0.035);
    for (const monster of monsters) {
      monster.speed *= monsterSpeedScale;
    }


    this.theme = themeForDepth(depth);

    const intro = design.intro;
    return {
      player,
      monsters,
      clues,
      sigils,
      pickups,
      ashPickups,
      survivors,
      phase: "playing",
      staticLevel: 0,
      messageText: intro ?? `第 ${depth} 层 · ${this.theme.name}`,
      messageTimer: 4.2,
      elapsed: 0,
      totalElapsed: carry?.totalElapsed ?? 0,
      dangerLevel: 0,
      noiseLevel: 0,
      depth,
      hallucinations: [],
      visited,
      pings: [],
      mapPulse: 0,
      flicker: 1,
      transition: depth > 1 ? 1 : 0,
      moral: {
        ashesReturned: 0,
        ashesAbandoned: 0,
        survivorsSaved: 0,
        survivorsSacrificed: 0,
        cluesIgnored: 0,
        truthFaced: 0,
        silenceChosen: 0,
      },
      ripplePaths: [],
    };
  }

  start() {
    this.running = true;
    this.lastTime = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.dispose();
  }

  restart() {
    this.state = this.createInitialState(1);
    this.flashTimer = 0;
    this.scanCooldown = 0;
    this.survivorsSaved = 0;
    this.lastTime = 0;
    this.cb.onPhaseChange?.("playing");
    this.emitHud();
  }

  /** 从存档继续：若存在存档则从上次到达的层数开始，并继承道具与同伴 */
  static hasSave(): boolean {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  continueFromSave(): boolean {
    let carry: {
      battery: number;
      sanity: number;
      totalElapsed: number;
      potions?: number;
      shields?: number;
      shieldTimer?: number;
      crucifix?: number;
      hadFollower?: boolean;
    } | null = null;
    let depth = 1;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        depth = Math.max(2, Math.floor(Number(data.depth) || 1));
        carry = {
          battery: Math.max(0, Number(data.battery) || 1),
          sanity: Math.max(0, Math.min(1, Number(data.sanity) || 1)),
          totalElapsed: Number(data.totalElapsed) || 0,
          potions: Math.max(0, Math.floor(Number(data.potions) || 0)),
          shields: Math.max(0, Math.floor(Number(data.shields) || 0)),
          shieldTimer: Math.max(0, Math.min(SHIELD_DURATION, Number(data.shieldTimer) || 0)),
          crucifix: Math.max(0, Math.floor(Number(data.crucifix) || 0)),
          hadFollower: !!data.hadFollower,
        };
      }
    } catch {
      return false;
    }
    if (!carry) return false;
    this.survivorsSaved = 0;
    this.state = this.createInitialState(depth, carry);
    this.flashTimer = 0;
    this.scanCooldown = 0;
    this.lastTime = 0;
    this.state.messageText = `继续游戏 · ${DEPTH_INTRO[depth] ?? `第 ${depth} 层 · ${this.theme.name}`}`;
    this.state.messageTimer = 3.5;
    this.cb.onPhaseChange?.("playing");
    this.emitHud();
    return true;
  }

  private clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* 忽略 */
    }
  }

  private writeSave() {
    const s = this.state;
    const hadFollower = s.survivors.some((sv) => sv.rescued && !sv.sacrificed);
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          depth: s.depth,
          battery: s.player.battery,
          sanity: s.player.sanity,
          totalElapsed: s.totalElapsed + s.elapsed,
          potions: s.player.potions,
          shields: s.player.shields,
          shieldTimer: s.player.shieldTimer,
          crucifix: s.player.crucifix,
          hadFollower,
        }),
      );
    } catch {
      /* 忽略 */
    }
  }

  togglePause() {
    if (this.state.phase === "playing") {
      this.state.phase = "paused";
      this.cb.onPhaseChange?.("paused");
      this.audio.update(this.idleAudioFrame(0.016));
    } else if (this.state.phase === "paused") {
      this.state.phase = "playing";
      this.lastTime = 0;
      this.cb.onPhaseChange?.("playing");
    }
  }

  setVirtualMove(x: number, y: number, sprint: boolean) {
    const len = Math.hypot(x, y);
    const nx = len > 1 ? x / len : x;
    const ny = len > 1 ? y / len : y;
    this.input.state.virtualMove = { x: nx, y: ny };
    this.input.state.virtualSprint = sprint;
    if (!this.input.state.aim && len > 0.08) {
      this.state.player.angle = Math.atan2(ny, nx);
    }
  }

  setVirtualAimFromClient(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.input.state.aim = {
      x: clientX - rect.left + this.camera.x,
      y: clientY - rect.top + this.camera.y,
    };
  }

  triggerAttack() {
    this.input.state.attackPressed = true;
  }

  triggerScan() {
    this.input.state.scanPressed = true;
  }

  setVirtualInteract(active: boolean) {
    this.input.state.interact = active;
  }

  triggerPotion() {
    this.input.state.usePotion = true;
  }

  triggerCrucifix() {
    this.input.state.useCrucifix = true;
  }

  private idleAudioFrame(dt: number) {
    const s = this.state;
    return {
      staticLevel: 0,
      isMoving: false,
      dt,
      sprinting: false,
      danger: 0,
      sanity: s.player.sanity,
      battery: s.player.battery,
    };
  }

  private handleShortcuts() {
    const input = this.input.state;
    if (input.restartPressed) {
      input.restartPressed = false;
      this.restart();
      return;
    }
    if (input.pausePressed) {
      input.pausePressed = false;
      this.togglePause();
    }
  }

  private emitHud() {
    const s = this.state;
    const design = levelForDepth(s.depth);
    this.cb.onHud?.({
      collected: s.clues.filter((c) => c.collected).length,
      total: design.clueCount,
      elapsed: s.elapsed,
      stamina: s.player.stamina,
      danger: s.dangerLevel,
      noise: s.noiseLevel,
      battery: s.player.battery,
      sanity: s.player.sanity,
      depth: s.depth,
      best: this.best,
      sigils: s.sigils.filter((sigil) => sigil.progress >= 1).length,
      sigilTotal: design.sigilCount,
      scan: 1 - this.scanCooldown / SCAN_COOLDOWN,
      rescued: this.survivorsSaved,
      survivorTotal: s.survivors.filter((sv) => sv.rescued && !sv.sacrificed).length,
      shields: s.player.shields,
      shieldTimer: s.player.shieldTimer,
      potions: s.player.potions,
      crucifix: s.player.crucifix,
      invuln: s.player.invulnTimer,
      chapter: design.chapter,
      levelTitle: design.title,
      emotion: design.emotion,
      mechanic: design.mechanic,
      intro: design.intro,
      dossier: design.dossier,
      artPromptId: design.artPromptId,
      clueLabel: design.clueLabel,
      sigilLabel: design.sigilLabel,
      exitLabel: design.exitLabel,
      sigilPrompt: design.sigilPrompt,
      exitPrompt: design.exitPrompt,
      guide: design.guide,
    });
  }

  getMessage(): { text: string; timer: number } {
    return { text: this.state.messageText, timer: this.state.messageTimer };
  }


  getRunSummary(): { depth: number; best: number; time: number } {
    return {
      depth: this.state.depth,
      best: this.best,
      time: this.state.totalElapsed + this.state.elapsed,
    };
  }

  private get exitOpen(): boolean {
    return (
      this.state.clues.every((c) => c.collected) &&
      this.state.sigils.every((sigil) => sigil.progress >= 1)
    );
  }

  private get drainRate(): number {
    return 0.014 + this.state.depth * 0.0016;
  }

  private loop = (t: number) => {
    if (!this.running) return;
    if (this.lastTime === 0) this.lastTime = t;
    let dt = (t - this.lastTime) / 1000;
    this.lastTime = t;
    if (dt > 0.05) dt = 0.05;

    this.handleShortcuts();

    if (this.state.phase === "playing") {
      this.update(dt);
    } else if (this.state.phase === "paused") {
      this.audio.update(this.idleAudioFrame(dt));
    } else if (this.state.phase === "caught") {
      // 死亡后：空格 / 左键 / R 快速重开
      if (this.input.state.attackPressed || this.input.state.restartPressed) {
        this.input.state.attackPressed = false;
        this.input.state.restartPressed = false;
        this.restart();
      }
      this.audio.update(this.idleAudioFrame(dt));
    }
    this.render(t / 1000);

    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    const s = this.state;
    const design = levelForDepth(s.depth);
    s.elapsed += dt;
    if (s.transition > 0) s.transition = Math.max(0, s.transition - dt * 1.2);
    if (this.scanCooldown > 0) this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    if (s.mapPulse > 0) s.mapPulse = Math.max(0, s.mapPulse - dt);

    const movingInput =
      this.input.state.up ||
      this.input.state.down ||
      this.input.state.left ||
      this.input.state.right ||
      Math.hypot(this.input.state.virtualMove.x, this.input.state.virtualMove.y) > 0.08;

    const shieldBefore = s.player.shieldTimer;
    updatePlayer(s.player, this.input.state, this.map, this.exitOpen, dt, this.drainRate);
    if (shieldBefore > 0 && s.player.shieldTimer <= 0) {
      s.player.shields = 0;
      s.messageText = "护盾碎了。雾重新记起你的名字。";
      s.messageTimer = Math.max(s.messageTimer, 2.4);
      this.audio.playScare();
    }
    s.noiseLevel = movingInput ? (s.player.sprinting ? 0.92 : 0.28) : 0;
    markVisitedArea(s.visited, this.map, s.player.pos, VISIT_RANGE);
    this.updatePings(s, dt);

    if (this.input.state.scanPressed) {
      this.input.state.scanPressed = false;
      if (this.scanCooldown <= 0 && s.player.battery > SCAN_COST) {
        this.scanCooldown = SCAN_COOLDOWN;
        s.player.battery = Math.max(0, s.player.battery - SCAN_COST);
        s.mapPulse = 1;
        s.noiseLevel = Math.max(s.noiseLevel, 0.82);
        markVisitedArea(s.visited, this.map, s.player.pos, SCAN_RANGE);
        s.pings.push({
          pos: { ...s.player.pos },
          age: 0,
          life: 1.15,
          radius: 0,
          maxRadius: SCAN_RANGE,
        });
        this.audio.playLunge();
        s.messageText = "声呐脉冲扩散。地图更亮了，但雾也听见了。";
        s.messageTimer = 2.6;
      } else if (s.player.battery <= SCAN_COST) {
        s.messageText = "电量不足以使用声呐。";
        s.messageTimer = 1.6;
      }
    }

    if (this.input.state.attackPressed) {
      this.input.state.attackPressed = false;
      if (s.player.attackCooldown <= 0) {
        s.player.attackCooldown = 0.55;
        s.player.attackFlash = 0.22;
        const hits = attackMonsters(s.player, s.monsters, this.map, this.exitOpen);
        s.noiseLevel = Math.max(s.noiseLevel, 0.6);
        if (hits > 0) {
          this.audio.playHit();
          s.messageText = "你狠狠一挥，它被击退了。";
          s.messageTimer = 1.6;
        } else {
          this.audio.playSwing();
        }
      }
    }

    this.useItems(s);
    this.updateSigils(s, dt);
    this.updateSurvivors(s, dt);

    for (const m of s.monsters) {
      const wasChase = m.state === "chase";
      updateMonster(m, s.player, this.map, this.exitOpen, dt, s.noiseLevel);
      if (!wasChase && m.state === "chase") {
        this.audio.playLunge();
      }
    }

    const nd = nearestMonsterDist(s.player, s.monsters);
    s.dangerLevel = dangerLevel(s.player, s.monsters);
    s.staticLevel = Math.max(nd >= STATIC_RANGE ? 0 : 1 - nd / STATIC_RANGE, s.dangerLevel * 0.45);

    this.updateSanity(s.player, s.dangerLevel, dt);
    this.updateHallucinations(s, dt);

    this.audio.update({
      staticLevel: s.staticLevel,
      isMoving: movingInput,
      dt,
      sprinting: s.player.sprinting,
      danger: Math.max(s.dangerLevel, s.player.shieldTimer > 0 ? 1 - s.player.shieldTimer / SHIELD_DURATION : 0),
      sanity: s.player.sanity,
      battery: s.player.battery,
    });


    for (const clue of s.clues) {
      if (clue.collected) continue;
      const d = Math.hypot(clue.pos.x - s.player.pos.x, clue.pos.y - s.player.pos.y);
      if (d < TILE * 0.6) {
        clue.collected = true;
        s.messageText = clue.text;
        s.messageTimer = 4;
        this.audio.playPickup();
        if (design.emotion === "恐怖") this.forceChase(s, 2.4);
        if (design.emotion === "悲伤") s.player.speed = Math.max(135, s.player.speed - 2);
        if (s.clues.every((c) => c.collected)) {
          for (const sigil of s.sigils) {
            if (sigil.progress < 1) sigil.active = true;
          }
          s.messageText = design.sigilPrompt;
          s.messageTimer = 6;
        }
      }
    }


    for (const p of s.pickups) {
      if (p.taken) continue;
      const d = Math.hypot(p.pos.x - s.player.pos.x, p.pos.y - s.player.pos.y);
      if (d >= TILE * 0.55) continue;
      if (p.kind === "battery") {
        // 电量可累积，不设上限；每块电池 +100%
        s.player.battery += 1.0;
        // 拾取后立刻在地图其他位置刷新一块电池；若找不到合适位置则收走，
        // 避免电池停在原地导致玩家站着不动时每帧反复 +100%。
        const relocated = this.scatterCell(TILE * 4, [s.player.pos]);
        if (relocated) p.pos = relocated;
        else p.taken = true;
        s.messageText = "找到电池，电量 +100%。手电筒更亮了。";
        s.messageTimer = 2.5;
        this.audio.playBattery();
      } else if (p.kind === "potion") {
        s.player.potions += 1;
        p.taken = true;
        s.messageText = "拾得生命药水。按 1 饮用，获得 10 秒护盾；倒计时结束后它会碎掉。";
        s.messageTimer = 3;
        this.audio.playPickup();
      } else if (p.kind === "crucifix") {
        s.player.crucifix += 1;
        p.taken = true;
        s.messageText = "拾得十字架。按 2 祭出，可定身附近的怪物数秒。";
        s.messageTimer = 3;
        this.audio.playPickup();
      } else if (p.kind === "radio") {
        s.player.radio = true;
        p.taken = true;
        s.messageText = "拾得收音机。它会被动接收附近怪物的杂讯——越近越响。按 3 主动调频会暴露你。";
        s.messageTimer = 4;
        this.audio.playPickup();
      } else if (p.kind === "ripple-tracker") {
        s.player.rippleTracker = true;
        p.taken = true;
        s.messageText = "拾得水纹罗盘。它会显示怪物在水面留下的残留路径。";
        s.messageTimer = 4;
        this.audio.playPickup();
      }
    }

    // 灰烬拾取
    for (const ash of s.ashPickups) {
      if (ash.taken) continue;
      const d = Math.hypot(ash.pos.x - s.player.pos.x, ash.pos.y - s.player.pos.y);
      if (d >= TILE * 0.55) continue;
      ash.taken = true;
      s.player.ashes += 1;
      s.messageText = `拾起一捧灰烬，是「${ash.name}」的名字。按 G 在仪式点归还，或带着它继续下沉。`;
      s.messageTimer = 4.5;
      this.audio.playPickup();
    }

    // 归还灰烬（道德选择）：在仪式点附近按 G
    if (this.input.state.returnAsh) {
      this.input.state.returnAsh = false;
      if (s.player.ashes > 0) {
        const nearSigil = s.sigils.find(
          (sig) => Math.hypot(sig.pos.x - s.player.pos.x, sig.pos.y - s.player.pos.y) < SIGIL_RANGE * 1.5,
        );
        if (nearSigil) {
          s.player.ashes -= 1;
          s.moral.ashesReturned += 1;
          // 归还灰烬可降低当前危险度（让逝者安息=减少追责）
          s.dangerLevel = Math.max(0, s.dangerLevel - 0.3);
          s.player.sanity = Math.min(1, s.player.sanity + 0.08);
          s.messageText = "你把名字归还给了仪式点。雾松动了一些，但你知道这不能赎回全部。";
          s.messageTimer = 4;
          this.audio.playPickup();
        } else {
          s.messageText = "需要靠近仪式点才能归还灰烬。";
          s.messageTimer = 2;
        }
      } else {
        s.messageText = "你手上没有灰烬。";
        s.messageTimer = 1.6;
      }
    }

    // 切换手电模式
    if (this.input.state.toggleFlashlight) {
      this.input.state.toggleFlashlight = false;
      s.player.flashlightMode = s.player.flashlightMode === "wide" ? "focus" : "wide";
      s.messageText = s.player.flashlightMode === "focus"
        ? "手电切换为【聚焦】：照得更远，但视野变窄。"
        : "手电切换为【广角】：视野更宽，但照得更近。";
      s.messageTimer = 2.4;
    }

    // 收音机主动调频扫描（暴露自己但定位所有怪物）
    if (this.input.state.useRadio) {
      this.input.state.useRadio = false;
      if (s.player.radio) {
        // 主动调频：暴露位置（制造噪音），但短暂在小地图标记所有怪物
        s.noiseLevel = Math.max(s.noiseLevel, 0.7);
        s.mapPulse = 1;
        for (const m of s.monsters) {
          s.pings.push({
            pos: { ...m.pos },
            age: 0,
            life: 1.4,
            radius: 0,
            maxRadius: TILE * 1.5,
          });
        }
        s.messageText = "你转动收音机旋钮。所有杂讯源短暂显形——但它们也听见了你。";
        s.messageTimer = 3;
        this.audio.playLunge();
      }
    }

    // 水纹追踪器：被动记录怪物路径
    if (s.player.rippleTracker) {
      this.updateRipplePaths(s, dt);
    }

    if (s.messageTimer > 0) s.messageTimer -= dt;


    // 被怪物抓住：优先级链 —— 同行幸存者牺牲 → 限时生命药水护盾 → 真正被抓住
    if (caughtPlayer(s.player, s.monsters)) {
      const follower = s.survivors.find((sv) => sv.rescued && !sv.sacrificed);
      if (follower) {
        // 1) 同行幸存者以命换命
        follower.sacrificed = true;
        s.survivors = s.survivors.filter((sv) => sv !== follower);
        const blocker = this.nearestMonsterToPlayer(s);
        if (blocker) {
          this.knockMonsterAway(blocker, s.player.pos);
          // 牺牲后，这只怪物几秒内不能再追你
          blocker.stunTimer = Math.max(blocker.stunTimer, 2.6);
          blocker.chaseLock = Math.max(blocker.chaseLock, SACRIFICE_CHASELOCK);
          blocker.state = "investigate";
          blocker.target = { x: s.player.pos.x, y: s.player.pos.y };
        }
        this.flashTimer = 0.55;
        s.player.invulnTimer = Math.max(s.player.invulnTimer, 1.2);
        this.audio.playHit();
        s.messageText = "幸存者以命换命，替你挡下了一次！这只怪物暂时不敢再追你。新的幸存者已在别处出现。";
        s.messageTimer = 5;
        // 牺牲后继续刷新其他幸存者（每次最多解救一名）
        this.respawnSurvivor(s);
      } else if (s.player.shieldTimer > 0) {
        // 2) 生命药水护盾：10 秒内免疫一次，不致死
        s.player.shieldTimer = 0;
        s.player.shields = 0;
        s.player.invulnTimer = Math.max(s.player.invulnTimer, 1.4);
        const blocker = this.nearestMonsterToPlayer(s);
        if (blocker) {
          this.knockMonsterAway(blocker, s.player.pos);
          blocker.stunTimer = Math.max(blocker.stunTimer, 2.2);
          blocker.chaseLock = Math.max(blocker.chaseLock, SHIELD_CHASELOCK);
          blocker.state = "investigate";
          blocker.target = { x: s.player.pos.x, y: s.player.pos.y };
        }
        this.flashTimer = 0.45;
        this.audio.playHit();
        s.messageText = "血膜炸裂。它被推开了，但你只被宽恕了一次。";
        s.messageTimer = 4;
      } else {
        this.flashTimer = 1;
        this.audio.playScare();
        this.saveBest(s.depth);
        s.phase = "caught";
        this.cb.onPhaseChange?.("caught");
      }
    }

    if (this.exitOpen) {
      const d = Math.hypot(this.map.exit.x - s.player.pos.x, this.map.exit.y - s.player.pos.y);
      if (d < TILE * 0.7) {
        this.descend();
      }
    }

    if (this.flashTimer > 0) this.flashTimer -= dt;

    this.emitHud();
  }

  private descend() {
    const s = this.state;
    const nextDepth = s.depth + 1;
    this.saveBest(nextDepth);
    this.audio.playDescend();
    const hadFollower = s.survivors.some((sv) => sv.rescued && !sv.sacrificed);
    this.state = this.createInitialState(nextDepth, {
      battery: s.player.battery,
      sanity: s.player.sanity,
      totalElapsed: s.totalElapsed + s.elapsed,
      potions: s.player.potions,
      shields: s.player.shields,
      shieldTimer: s.player.shieldTimer,
      crucifix: s.player.crucifix,
      hadFollower,
    });
    this.flashTimer = 0;
    this.scanCooldown = 0;
    // 进入下一层后写入存档（道具与同伴一并保留）
    this.writeSave();
  }

  private updateSanity(player: Player, danger: number, dt: number) {

    const darkFear = player.battery < 0.3 ? (0.3 - player.battery) / 0.3 : 0;
    const drain = danger * 0.17 + darkFear * 0.045;
    const recover = danger < 0.15 && player.battery > 0.3 ? 0.05 : 0;
    player.sanity = clamp(player.sanity - drain * dt + recover * dt, 0, 1);
  }

  private updatePings(s: GameState, dt: number) {
    for (const ping of s.pings) {
      ping.age += dt;
      ping.radius = ping.maxRadius * Math.min(1, ping.age / ping.life);
    }
    s.pings = s.pings.filter((ping) => ping.age < ping.life);
  }

  private updateSigils(s: GameState, dt: number) {
    const design = levelForDepth(s.depth);
    let cleansing = false;

    for (const sigil of s.sigils) {
      if (sigil.pulse > 0) sigil.pulse = Math.max(0, sigil.pulse - dt);
      if (!sigil.active || sigil.progress >= 1) continue;

      const d = Math.hypot(sigil.pos.x - s.player.pos.x, sigil.pos.y - s.player.pos.y);
      const inRange = d < SIGIL_RANGE;
      if (inRange && this.input.state.interact) {
        cleansing = true;
        sigil.progress = Math.min(1, sigil.progress + dt / SIGIL_CLEANSE_TIME);
        s.noiseLevel = Math.max(s.noiseLevel, 0.72);
        s.player.sanity = Math.max(0, s.player.sanity - dt * 0.035);
        if (sigil.progress >= 1) {
          sigil.pulse = 1;
          this.audio.playPickup();
          if (design.emotion === "恐怖") this.forceChase(s, 3.2);
          if (s.sigils.every((item) => item.progress >= 1)) {
            s.messageText = design.completeText + " " + design.exitPrompt;
            s.messageTimer = 5.5;
          } else {
            s.messageText = `${design.sigilLabel}回应了。雾短暂退去。`;
            s.messageTimer = 3;
          }
        } else if (s.messageTimer <= 0.1) {
          s.messageText = `按住 E 完成${design.sigilLabel}。它在尖叫，附近的东西都听得见。`;
          s.messageTimer = 0.25;
        }
      } else if (inRange && s.messageTimer <= 0) {
        s.messageText = `按住 E 完成${design.sigilLabel}。`;
        s.messageTimer = 1.2;
      }
    }

    if (cleansing) {
      s.pings.push({
        pos: { ...s.player.pos },
        age: 0,
        life: 0.35,
        radius: 0,
        maxRadius: TILE * 2.2,
      });
    }
  }

  private updateSurvivors(s: GameState, dt: number) {
    for (const survivor of s.survivors) {
      const d = Math.hypot(survivor.pos.x - s.player.pos.x, survivor.pos.y - s.player.pos.y);

      if (!survivor.rescued) {
        if (d < SURVIVOR_RANGE && this.input.state.interact) {
          survivor.rescued = true;
          this.survivorsSaved += 1;
          survivor.followOffset = s.survivors.filter((item) => item.rescued).length;
          s.messageText = "你救下了一名幸存者。她会跟着你下沉，必要时会以命相护替你挡下一次。";
          s.messageTimer = 4.5;
          this.audio.playPickup();
        } else if (d < SURVIVOR_RANGE && s.messageTimer <= 0) {
          s.messageText = "按住 E 解救幸存者。";
          s.messageTimer = 1.2;
        }
        continue;
      }

      const backAngle = s.player.angle + Math.PI + (survivor.followOffset % 2 === 0 ? 0.45 : -0.45);
      const target = {
        x: s.player.pos.x + Math.cos(backAngle) * TILE * 0.72,
        y: s.player.pos.y + Math.sin(backAngle) * TILE * 0.72,
      };

      // 跟丢修复：离玩家太远（被甩开 / 卡在墙后）时，直接召回玩家身后，绝不丢失
      if (d > TILE * 6) {
        survivor.pos.x = s.player.pos.x + Math.cos(backAngle) * TILE * 0.9;
        survivor.pos.y = s.player.pos.y + Math.sin(backAngle) * TILE * 0.9;
        // 如果召回点恰好在墙里，逐步试几个角度
        for (let a = 0.5; a < Math.PI * 2; a += 0.5) {
          const tx = s.player.pos.x + Math.cos(backAngle + a) * TILE * 0.9;
          const ty = s.player.pos.y + Math.sin(backAngle + a) * TILE * 0.9;
          if (!isWall(this.map, tx, ty, this.exitOpen)) {
            survivor.pos.x = tx;
            survivor.pos.y = ty;
            break;
          }
        }
        continue;
      }

      const dx = target.x - survivor.pos.x;
      const dy = target.y - survivor.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < TILE * 0.28) continue;

      // 距离越远追得越快，确保不会轻易掉队
      const speed = dist > TILE * 2.2 ? 250 : dist > TILE * 1.2 ? 180 : 120;
      const step = Math.min(dist, speed * dt);
      const nx = survivor.pos.x + (dx / dist) * step;
      const ny = survivor.pos.y + (dy / dist) * step;
      const r = 6;
      // 沿轴向贴墙移动；若两头都堵住，则朝玩家直线方向强行靠拢（避免在拐角处卡死掉队）
      const moveX = !isWall(this.map, nx - r, survivor.pos.y, this.exitOpen) && !isWall(this.map, nx + r, survivor.pos.y, this.exitOpen);
      const moveY = !isWall(this.map, survivor.pos.x, ny - r, this.exitOpen) && !isWall(this.map, survivor.pos.x, ny + r, this.exitOpen);
      if (moveX) survivor.pos.x = nx;
      if (moveY) survivor.pos.y = ny;
      if (!moveX && !moveY && dist > TILE * 0.6) {
        // 两轴都撞墙：尝试沿单一轴滑行
        if (!isWall(this.map, nx - r, survivor.pos.y, this.exitOpen) && !isWall(this.map, nx + r, survivor.pos.y, this.exitOpen)) {
          survivor.pos.x = nx;
        } else if (!isWall(this.map, survivor.pos.x, ny - r, this.exitOpen) && !isWall(this.map, survivor.pos.x, ny + r, this.exitOpen)) {
          survivor.pos.y = ny;
        } else {
          // 真正卡死时，瞬间召回玩家身边
          survivor.pos.x = s.player.pos.x + Math.cos(backAngle) * TILE * 0.9;
          survivor.pos.y = s.player.pos.y + Math.sin(backAngle) * TILE * 0.9;
        }
      }
    }
  }

  /** 在远离玩家与指定锚点的开放格中随机挑一个，用于刷新电池/幸存者 */
  private scatterCell(minDistFromPlayer: number, anchors: Vec2[]): Vec2 | null {
    const cells = findOpenCells(this.map).filter(
      (c) => Math.hypot(c.x - this.state.player.pos.x, c.y - this.state.player.pos.y) > minDistFromPlayer,
    );
    if (cells.length === 0) return null;
    const picked = selectScatteredCells(cells, 1, anchors, TILE * 3);
    return picked[0] ?? null;
  }

  /** 幸存者牺牲后，在别处刷新一名新的可解救幸存者（每次最多一名） */
  private respawnSurvivor(s: GameState) {
    // 若已存在未解救的幸存者，则不重复刷新
    if (s.survivors.some((sv) => !sv.rescued && !sv.sacrificed)) return;
    const pos = this.scatterCell(TILE * 5, [s.player.pos, ...s.clues.map((c) => c.pos)]);
    if (!pos) return;
    s.survivors.push({ pos, rescued: false, followOffset: 0, sacrificed: false });
  }

  private nearestMonsterToPlayer(s: GameState): Monster | null {
    let best: Monster | null = null;
    let bestD = Infinity;
    for (const m of s.monsters) {
      const dd = Math.hypot(m.pos.x - s.player.pos.x, m.pos.y - s.player.pos.y);
      if (dd < bestD) {
        bestD = dd;
        best = m;
      }
    }
    return best;
  }

  private forceChase(s: GameState, seconds: number) {
    for (const m of s.monsters) {
      const d = Math.hypot(m.pos.x - s.player.pos.x, m.pos.y - s.player.pos.y);
      if (d > TILE * 11) continue;
      m.state = "chase";
      m.target = { ...s.player.pos };
      m.alertTimer = Math.max(m.alertTimer, seconds);
      m.chaseLock = Math.max(m.chaseLock, seconds * 0.55);
    }
    s.noiseLevel = Math.max(s.noiseLevel, 0.9);
  }

  /** 把怪物沿远离玩家方向击退，撞墙即止 */
  private knockMonsterAway(m: Monster, from: Vec2) {
    const dx = m.pos.x - from.x;
    const dy = m.pos.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const knock = TILE * 3;
    const ux = dx / dist;
    const uy = dy / dist;
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const nx = m.pos.x + (ux * knock) / steps;
      const ny = m.pos.y + (uy * knock) / steps;
      if (isWall(this.map, nx, m.pos.y, this.exitOpen)) break;
      if (isWall(this.map, m.pos.x, ny, this.exitOpen)) {
        m.pos.x = nx;
        break;
      }
      m.pos.x = nx;
      m.pos.y = ny;
    }
  }

  /** 道具使用：1 饮用药水（10 秒免疫护盾），2 祭出十字架（定身附近怪物） */
  private useItems(s: GameState) {
    const input = this.input.state;
    if (input.usePotion) {
      input.usePotion = false;
      if (s.player.potions > 0) {
        s.player.potions -= 1;
        s.player.shields = 1;
        s.player.shieldTimer = SHIELD_DURATION;
        s.messageText = "药水像铁锈一样爬进喉咙。十秒之内，死亡认不出你。";
        s.messageTimer = 3.4;
        this.audio.playPickup();
      } else {
        s.messageText = "没有生命药水了。";
        s.messageTimer = 1.4;
      }
    }
    if (input.useCrucifix) {
      input.useCrucifix = false;
      if (s.player.crucifix > 0) {
        s.player.crucifix -= 1;
        let frozen = 0;
        for (const m of s.monsters) {
          const d = Math.hypot(m.pos.x - s.player.pos.x, m.pos.y - s.player.pos.y);
          if (d <= FREEZE_RADIUS) {
            m.stunTimer = Math.max(m.stunTimer, FREEZE_TIME);
            m.chaseLock = Math.max(m.chaseLock, FREEZE_TIME);
            m.state = "investigate";
            frozen++;
          }
        }
        s.pings.push({
          pos: { ...s.player.pos },
          age: 0,
          life: 1.2,
          radius: 0,
          maxRadius: FREEZE_RADIUS,
        });
        this.audio.playLunge();
        s.messageText =
          frozen > 0
            ? `十字架发出圣光，定住了 ${frozen} 只怪物 ${FREEZE_TIME.toFixed(0)} 秒。`
            : "十字架发出圣光，但附近没有怪物。";
        s.messageTimer = 3.4;
      } else {
        s.messageText = "没有十字架了。";
        s.messageTimer = 1.4;
      }
    }
  }

  private updateHallucinations(s: GameState, dt: number) {
    const insanity = 1 - s.player.sanity;
    this.hallucTimer -= dt;
    if (this.hallucTimer <= 0) {
      this.hallucTimer = 1.2 + Math.random() * 1.3;
      const count = Math.floor(insanity * 5);
      const list: Vec2[] = [];
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = TILE * (2.5 + Math.random() * 4);
        list.push({
          x: s.player.pos.x + Math.cos(ang) * dist,
          y: s.player.pos.y + Math.sin(ang) * dist,
        });
      }
      s.hallucinations = list;
    }
  }

  // 水纹追踪器：记录每只怪物最近的移动轨迹
  private updateRipplePaths(s: GameState, dt: number) {
    // 每只怪物维护一条短路径（最近 8 个采样点）
    const maxPoints = 8;
    if (s.ripplePaths.length !== s.monsters.length) {
      s.ripplePaths = s.monsters.map(() => []);
    }
    this.rippleSampleTimer = (this.rippleSampleTimer ?? 0) - dt;
    if (this.rippleSampleTimer <= 0) {
      this.rippleSampleTimer = 0.4;
      for (let i = 0; i < s.monsters.length; i++) {
        const path = s.ripplePaths[i] ?? (s.ripplePaths[i] = []);
        path.push({ ...s.monsters[i].pos });
        if (path.length > maxPoints) path.shift();
      }
    }
  }

  private render(time: number) {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    const s = this.state;


    const flicker = computeFlicker(s.player.battery, time);
    s.flicker = flicker;
    const batteryFactor = 0.32 + 0.68 * s.player.battery;

    // 手电模式影响照射参数
    const modeConeAngle = coneAngleFor(s.player.flashlightMode);
    const modeConeRange = coneRangeFor(s.player.flashlightMode, CONE_RANGE * batteryFactor * (0.55 + 0.45 * flicker));

    const brightness = clamp((0.28 + 0.72 * s.player.battery) * flicker, 0, 1);
    const insanity = 1 - s.player.sanity;


    const shakeX = insanity > 0.4 ? Math.sin(time * 13) * insanity * 2.5 : 0;
    const shakeY = insanity > 0.4 ? Math.cos(time * 11) * insanity * 2.5 : 0;

    // this.camera 保持无抖动，供鼠标瞄准的屏幕→世界坐标映射使用，
    // 避免理智过低时屏幕抖动让手电方向跟着乱晃。抖动只作用于渲染相机 cam。
    this.camera.x = s.player.pos.x - w / 2;
    this.camera.y = s.player.pos.y - h / 2;
    const cam = { x: this.camera.x + shakeX, y: this.camera.y + shakeY };

    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, w, h);

    this.renderTiles(ctx, cam, w, h);
    this.renderExit(ctx, cam);

    const screenOrigin: Vec2 = { x: s.player.pos.x - cam.x, y: s.player.pos.y - cam.y };
    // 任何实体只可能在手电锥形或环境光范围内被看到，先用平方距离快速裁剪，
    // 远处实体直接跳过，省去昂贵的 hasLine 射线投射。
    const maxVisRangeSq = Math.max(modeConeRange, AMBIENT_RANGE) ** 2;
    const vis = (pos: Vec2) => {
      const dx = pos.x - s.player.pos.x;
      const dy = pos.y - s.player.pos.y;
      if (dx * dx + dy * dy > maxVisRangeSq) return false;
      return (
        inFlashlight(this.map, s.player.pos, s.player.angle, pos, this.exitOpen, modeConeRange, modeConeAngle) ||
        inAmbient(this.map, s.player.pos, pos, this.exitOpen)
      );
    };

    for (const p of s.pickups) {
      if (p.taken) continue;
      if (vis(p.pos)) {
        if (p.kind === "potion") this.renderPotion(ctx, p.pos, cam, time);
        else if (p.kind === "crucifix") this.renderCrucifix(ctx, p.pos, cam, time);
        else this.renderBattery(ctx, p.pos, cam, time);
      }
    }

    for (const clue of s.clues) {
      if (!clue.collected && vis(clue.pos)) {
        this.renderClue(ctx, clue.pos, cam, time);
      }
    }

    for (const sigil of s.sigils) {
      if (vis(sigil.pos)) {
        this.renderSigil(ctx, sigil, cam, time);
      }
    }

    for (const survivor of s.survivors) {
      if (!survivor.rescued && vis(survivor.pos)) {
        this.renderSurvivor(ctx, survivor, cam, time);
      }
    }

    this.renderHallucinations(ctx, cam, time, insanity);

    for (const m of s.monsters) {
      if (vis(m.pos)) {
        this.renderMonster(ctx, m, cam, time);
      }
    }

    // 水纹追踪器：显示怪物路径
    if (s.player.rippleTracker) {
      this.renderRipplePaths(ctx, cam, s.ripplePaths, time);
    }

    const conePoly = castFlashlight(this.map, s.player.pos, s.player.angle, this.exitOpen, modeConeRange, modeConeAngle).map(
      (p) => ({ x: p.x - cam.x, y: p.y - cam.y }),
    );
    const nearPoly = castVisibility(this.map, s.player.pos, this.exitOpen).map(
      (p) => ({ x: p.x - cam.x, y: p.y - cam.y }),
    );
    renderDarkness(ctx, w, h, screenOrigin, conePoly, nearPoly, modeConeRange, brightness);

    renderFog(ctx, w, h, time, s.dangerLevel);

    this.renderPlayer(ctx, screenOrigin, s.player.angle);
    for (const survivor of s.survivors) {
      if (survivor.rescued) {
        this.renderSurvivor(ctx, survivor, cam, time);
      }
    }
    this.renderDangerSignal(ctx, w, h, time);
    this.renderShieldWarning(ctx, w, h, time);
    this.renderNoisePulse(ctx, screenOrigin);
    this.renderPings(ctx, cam);
    this.renderPsychGuide(ctx, w, h, screenOrigin, time);
    this.renderMiniMap(ctx, w, time);
    this.renderHUD(ctx, w, h, s, time);


    renderLowBattery(ctx, w, h, s.player.battery, flicker);
    renderDamageFlash(ctx, w, h, Math.max(0, this.flashTimer));
    if (s.transition > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${s.transition})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  private renderPsychGuide(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    origin: Vec2,
    time: number,
  ) {
    const s = this.state;
    const design = levelForDepth(s.depth);
    let target: Vec2 | null = null;
    if (this.exitOpen) {
      target = this.map.exit;
    } else {
      let best = Infinity;
      if (!s.clues.every((clue) => clue.collected)) {
        for (const clue of s.clues) {
          if (clue.collected) continue;
          const d = Math.hypot(clue.pos.x - s.player.pos.x, clue.pos.y - s.player.pos.y);
          if (d < best) {
            best = d;
            target = clue.pos;
          }
        }
      } else {
        for (const sigil of s.sigils) {
          if (sigil.progress >= 1) continue;
          const d = Math.hypot(sigil.pos.x - s.player.pos.x, sigil.pos.y - s.player.pos.y);
          if (d < best) {
            best = d;
            target = sigil.pos;
          }
        }
      }
    }
    if (!target) return;

    const ang = Math.atan2(target.y - s.player.pos.y, target.x - s.player.pos.x);
    const pulse = 0.45 + 0.3 * Math.sin(time * 4);
    const collectedAll = s.clues.every((c) => c.collected);
    const label = this.exitOpen ? design.exitLabel : collectedAll ? design.sigilLabel : design.clueLabel;
    const motif = guideMotif(design.guide);

    ctx.save();
    ctx.translate(origin.x, origin.y);

    if (design.guide === "radio" || design.guide === "heartbeat") {
      ctx.strokeStyle = `rgba(210, 205, 175, ${0.18 + pulse * 0.18})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const r = 34 + i * 14 + pulse * 8;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * (44 + i * 8), Math.sin(ang) * (44 + i * 8), r, -0.7 + ang, 0.7 + ang);
        ctx.stroke();
      }
    } else if (design.guide === "ghost") {
      const gx = Math.cos(ang) * 72;
      const gy = Math.sin(ang) * 72;
      ctx.fillStyle = `rgba(205, 210, 205, ${0.22 + pulse * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(gx, gy, 7, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(235, 235, 220, ${0.16 + pulse * 0.14})`;
      ctx.beginPath();
      ctx.arc(gx, gy - 14, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (design.guide === "light") {
      const grad = ctx.createLinearGradient(0, 0, Math.cos(ang) * 120, Math.sin(ang) * 120);
      grad.addColorStop(0, "rgba(235,230,190,0)");
      grad.addColorStop(1, `rgba(235,230,190,${0.2 + pulse * 0.12})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang - 0.12) * 28, Math.sin(ang - 0.12) * 28);
      ctx.lineTo(Math.cos(ang) * 118, Math.sin(ang) * 118);
      ctx.stroke();
    } else {
      ctx.fillStyle = guideColor(design.guide, pulse);
      for (let i = 0; i < 10; i++) {
        const lane = (i - 4.5) * 5;
        const drift = ((time * 32 + i * 17) % 88) + 22;
        const wobble = Math.sin(time * 1.7 + i) * 9;
        const x = Math.cos(ang) * drift + Math.cos(ang + Math.PI / 2) * (lane + wobble);
        const y = Math.sin(ang) * drift + Math.sin(ang + Math.PI / 2) * (lane + wobble);
        ctx.fillRect(x, y, 2, 2);
      }
    }

    ctx.fillStyle = `rgba(224, 218, 196, ${0.58 + pulse * 0.25})`;
    ctx.font = "11px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(`${motif} ${label}`, Math.cos(ang) * 76, Math.sin(ang) * 76 + 24);
    ctx.restore();
  }

  private floorTexturePattern(ctx: CanvasRenderingContext2D, cam: Vec2): CanvasPattern | null {
    const image = this.floorTexture;
    if (!image?.complete || image.naturalWidth === 0) return null;

    if (!this.floorPattern) {
      this.floorPattern = ctx.createPattern(image, "repeat");
    }

    if (this.floorPattern && "setTransform" in this.floorPattern) {
      const scale = 0.42;
      this.floorPattern.setTransform(
        new DOMMatrix()
          .translateSelf(-cam.x * scale, -cam.y * scale)
          .scaleSelf(scale, scale),
      );
    }

    return this.floorPattern;
  }

  private renderTiles(ctx: CanvasRenderingContext2D, cam: Vec2, w: number, h: number) {
    const design = levelForDepth(this.state.depth);
    const floorPattern = this.floorTexturePattern(ctx, cam);
    const startCol = Math.max(0, Math.floor(cam.x / TILE));
    const endCol = Math.min(this.map.cols, Math.ceil((cam.x + w) / TILE));
    const startRow = Math.max(0, Math.floor(cam.y / TILE));
    const endRow = Math.min(this.map.rows, Math.ceil((cam.y + h) / TILE));

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const t = this.map.grid[r][c];
        const x = c * TILE - cam.x;
        const y = r * TILE - cam.y;
        if (t === 1) {

          ctx.fillStyle = this.theme.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = "#1b1916";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
          ctx.strokeStyle = this.theme.wallLine;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y + TILE / 2);
          ctx.lineTo(x + TILE, y + TILE / 2);
          ctx.stroke();
        } else if (t === 2) {
          ctx.fillStyle = this.exitOpen ? "#243526" : "#201f1d";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = this.exitOpen ? "#6aa26b" : "#6b5b45";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.fillStyle = this.exitOpen ? "#9affad" : "#8a6e47";
          ctx.font = "10px Courier New";
          ctx.textAlign = "center";
          ctx.fillText(this.exitOpen ? design.exitLabel : "未显影", x + TILE / 2, y + TILE / 2 + 3);
        } else {
          ctx.fillStyle = (r + c) % 2 === 0 ? this.theme.floorA : this.theme.floorB;
          ctx.fillRect(x, y, TILE, TILE);
          if (floorPattern) {
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.globalCompositeOperation = "soft-light";
            ctx.fillStyle = floorPattern;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.restore();
          }
          ctx.strokeStyle = "rgba(0,0,0,0.22)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        }
      }
    }
  }

  private renderExit(ctx: CanvasRenderingContext2D, cam: Vec2) {
    if (!this.exitOpen) return;
    const design = levelForDepth(this.state.depth);
    const x = this.map.exit.x - cam.x;
    const y = this.map.exit.y - cam.y;
    ctx.save();
    ctx.fillStyle = "#3a5a3a";
    ctx.fillRect(x - TILE / 2, y - TILE / 2, TILE, TILE);
    ctx.fillStyle = "#9affad";
    ctx.font = "10px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(design.exitLabel, x, y + 3);
    ctx.restore();
  }

  private renderBattery(ctx: CanvasRenderingContext2D, pos: Vec2, cam: Vec2, time: number) {
    const x = pos.x - cam.x;
    const y = pos.y - cam.y;
    const pulse = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 24);
    glow.addColorStop(0, `rgba(120, 220, 255, ${0.45 * pulse})`);
    glow.addColorStop(1, "rgba(120, 220, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 24, y - 24, 48, 48);

    ctx.fillStyle = "#1c2a30";
    ctx.fillRect(x - 5, y - 9, 10, 18);
    ctx.fillStyle = "#7fd6ff";
    ctx.fillRect(x - 5, y - 9, 10, 4);
    ctx.fillStyle = "#cfeeff";
    ctx.fillRect(x - 2, y - 12, 4, 3);
    ctx.strokeStyle = "rgba(180,230,255,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 5, y - 9, 10, 18);
    ctx.restore();
  }

  private renderPotion(ctx: CanvasRenderingContext2D, pos: Vec2, cam: Vec2, time: number) {
    const x = pos.x - cam.x;
    const y = pos.y - cam.y;
    const pulse = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
    glow.addColorStop(0, `rgba(255, 80, 96, ${0.45 * pulse})`);
    glow.addColorStop(1, "rgba(255, 80, 96, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 26, y - 26, 52, 52);

    ctx.fillStyle = "rgba(40, 16, 20, 0.9)";
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e04760";
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 5.5, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a3a44";
    ctx.fillRect(x - 2, y - 11, 4, 6);
    ctx.fillStyle = "#caa24a";
    ctx.fillRect(x - 3, y - 13, 6, 3);
    ctx.strokeStyle = "rgba(255, 200, 200, 0.85)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 8, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private renderCrucifix(ctx: CanvasRenderingContext2D, pos: Vec2, cam: Vec2, time: number) {
    const x = pos.x - cam.x;
    const y = pos.y - cam.y;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
    glow.addColorStop(0, `rgba(240, 232, 180, ${0.4 * pulse})`);
    glow.addColorStop(1, "rgba(240, 232, 180, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 26, y - 26, 52, 52);

    ctx.translate(x, y);
    ctx.rotate(Math.sin(time) * 0.05);
    ctx.strokeStyle = "#e8e2c4";
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 11);
    ctx.moveTo(-7, -1);
    ctx.lineTo(7, -1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 250, 220, 0.95)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  private renderClue(ctx: CanvasRenderingContext2D, pos: Vec2, cam: Vec2, time: number) {
    const x = pos.x - cam.x;
    const y = pos.y - cam.y;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 30);
    glow.addColorStop(0, `rgba(255, 240, 180, ${0.5 * pulse})`);
    glow.addColorStop(1, "rgba(255, 240, 180, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 30, y - 30, 60, 60);

    ctx.fillStyle = `rgba(245, 238, 200, ${0.85 + 0.15 * pulse})`;
    ctx.fillRect(x - 7, y - 9, 14, 18);
    ctx.strokeStyle = "rgba(120,110,80,0.95)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 7, y - 9, 14, 18);
    ctx.strokeStyle = "rgba(90,80,60,0.7)";
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 4);
    ctx.lineTo(x + 4, y - 4);
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.moveTo(x - 4, y + 4);
    ctx.lineTo(x + 4, y + 4);
    ctx.stroke();
    ctx.restore();
  }

  private renderSigil(ctx: CanvasRenderingContext2D, sigil: Sigil, cam: Vec2, time: number) {
    const x = sigil.pos.x - cam.x;
    const y = sigil.pos.y - cam.y;
    const complete = sigil.progress >= 1;
    const active = sigil.active && !complete;
    const pulse = 0.55 + 0.45 * Math.sin(time * (active ? 5.4 : 2.2));

    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, active ? 42 : 30);
    if (complete) {
      glow.addColorStop(0, `rgba(130, 255, 190, ${0.22 + sigil.pulse * 0.35})`);
      glow.addColorStop(1, "rgba(130, 255, 190, 0)");
    } else if (active) {
      glow.addColorStop(0, `rgba(190, 130, 255, ${0.35 + pulse * 0.22})`);
      glow.addColorStop(1, "rgba(190, 130, 255, 0)");
    } else {
      glow.addColorStop(0, `rgba(120, 120, 140, ${0.12 * pulse})`);
      glow.addColorStop(1, "rgba(120, 120, 140, 0)");
    }
    ctx.fillStyle = glow;
    ctx.fillRect(x - 48, y - 48, 96, 96);

    ctx.translate(x, y);
    ctx.rotate(time * (complete ? 0.2 : active ? 0.9 : 0.15));
    ctx.strokeStyle = complete ? "rgba(150,255,190,0.9)" : active ? "rgba(205,165,255,0.9)" : "rgba(135,130,150,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const r = i % 2 === 0 ? 15 : 9;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    if (!complete && sigil.progress > 0) {
      ctx.strokeStyle = "rgba(245,235,210,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sigil.progress);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderHallucinations(
    ctx: CanvasRenderingContext2D,
    cam: Vec2,
    time: number,
    insanity: number,
  ) {
    if (insanity < 0.25) return;
    ctx.save();
    for (let i = 0; i < this.state.hallucinations.length; i++) {
      const hpos = this.state.hallucinations[i];
      const x = hpos.x - cam.x;
      const y = hpos.y - cam.y;
      const flick = 0.25 + 0.25 * Math.sin(time * 9 + i * 2.1);
      ctx.fillStyle = `rgba(20, 18, 22, ${flick * insanity})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 9, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(150,150,155,${flick * insanity * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y - 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderMonster(ctx: CanvasRenderingContext2D, monster: Monster, cam: Vec2, time: number) {
    const x = monster.pos.x - cam.x;
    const y = monster.pos.y - cam.y;
    ctx.save();
    const shake = monster.state === "chase" ? Math.sin(time * 30) * 2 : 0;
    ctx.translate(shake, 0);

    if (monster.kind === "stalker") this.drawStalker(ctx, x, y, monster, time);
    else if (monster.kind === "listener") this.drawListener(ctx, x, y, monster, time);
    else if (monster.kind === "brute") this.drawBrute(ctx, x, y, monster, time);
    else if (monster.kind === "crawler") this.drawCrawler(ctx, x, y, monster, time);
    else this.drawWanderer(ctx, x, y, monster);

    // 十字架定身：冰晶光环
    if (monster.chaseLock > 0 && monster.stunTimer > 0) {
      ctx.save();
      const a = 0.4 + 0.3 * Math.sin(time * 12);
      const frost = ctx.createRadialGradient(x, y, 0, x, y, 26);
      frost.addColorStop(0, `rgba(170, 220, 255, ${a * 0.4})`);
      frost.addColorStop(1, "rgba(170, 220, 255, 0)");
      ctx.fillStyle = frost;
      ctx.fillRect(x - 28, y - 28, 56, 56);
      ctx.strokeStyle = `rgba(200, 235, 255, ${a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (monster.stunTimer > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 230, 140, 0.9)";
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * Math.PI * 2) / 3;
        const sx = x + Math.cos(a) * 12;
        const sy = y - 22 + Math.sin(a) * 4;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  private drawWanderer(ctx: CanvasRenderingContext2D, x: number, y: number, m: Monster) {
    if (m.state !== "wander") {
      const aura = ctx.createRadialGradient(x, y, 0, x, y, m.state === "chase" ? 46 : 32);
      aura.addColorStop(0, m.state === "chase" ? "rgba(160,0,0,0.25)" : "rgba(210,190,140,0.12)");
      aura.addColorStop(1, "rgba(160,0,0,0)");
      ctx.fillStyle = aura;
      ctx.fillRect(x - 50, y - 50, 100, 100);
    }
    ctx.fillStyle = m.state === "chase" ? "#d3cbc2" : "#b8b0a8";
    ctx.beginPath();
    ctx.ellipse(x, y, 11, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a0000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
  }

  private drawStalker(ctx: CanvasRenderingContext2D, x: number, y: number, m: Monster, time: number) {
    const aura = ctx.createRadialGradient(x, y, 0, x, y, m.state === "chase" ? 54 : 30);
    aura.addColorStop(0, m.state === "chase" ? "rgba(200,20,20,0.32)" : "rgba(120,30,30,0.16)");
    aura.addColorStop(1, "rgba(160,0,0,0)");
    ctx.fillStyle = aura;
    ctx.fillRect(x - 60, y - 60, 120, 120);

    ctx.fillStyle = m.state === "chase" ? "#9a8f88" : "#867c75";
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a0808";
    ctx.lineWidth = 2;
    const sway = Math.sin(time * 12) * 4;
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x + sway, y + 16);
    ctx.moveTo(x - 6, y - 4);
    ctx.lineTo(x + 6, y + 6);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,40,40,0.9)";
    ctx.beginPath();
    ctx.arc(x - 2, y - 12, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 2, y - 12, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }


  private drawListener(ctx: CanvasRenderingContext2D, x: number, y: number, m: Monster, time: number) {
    const lunge = Math.max(0, m.lungeFlash);
    if (m.state !== "wander" || lunge > 0) {
      const aura = ctx.createRadialGradient(x, y, 0, x, y, 40 + lunge * 30);
      aura.addColorStop(0, `rgba(140,140,90,${0.16 + lunge * 0.3})`);
      aura.addColorStop(1, "rgba(140,140,90,0)");
      ctx.fillStyle = aura;
      ctx.fillRect(x - 70, y - 70, 140, 140);
    }
    const bulge = 1 + lunge * 0.4 + Math.sin(time * 4) * 0.05;
    ctx.fillStyle = m.state === "chase" ? "#c9c2b0" : "#aaa494";
    ctx.beginPath();
    ctx.ellipse(x, y, 14 * bulge, 13 * bulge, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3024";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 2);
    ctx.lineTo(x + 6, y + 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(60,55,45,0.85)";
    ctx.beginPath();
    ctx.ellipse(x - 12, y - 6, 4, 9, -0.5, 0, Math.PI * 2);
    ctx.ellipse(x + 12, y - 6, 4, 9, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 残暴者：体型巨大、行动迟缓的重装怪物
  private drawBrute(ctx: CanvasRenderingContext2D, x: number, y: number, m: Monster, time: number) {
    const aura = ctx.createRadialGradient(x, y, 0, x, y, m.state === "chase" ? 58 : 34);
    aura.addColorStop(0, m.state === "chase" ? "rgba(150, 30, 20, 0.32)" : "rgba(90, 40, 30, 0.16)");
    aura.addColorStop(1, "rgba(90, 20, 10, 0)");
    ctx.fillStyle = aura;
    ctx.fillRect(x - 62, y - 62, 124, 124);

    const sway = Math.sin(time * 5) * 2;
    ctx.fillStyle = m.state === "chase" ? "#7a5a4a" : "#5f4838";
    ctx.beginPath();
    ctx.ellipse(x, y, 17, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    // 厚重肩部
    ctx.fillStyle = "#4a3628";
    ctx.beginPath();
    ctx.ellipse(x - 12, y - 2, 7, 12, -0.4, 0, Math.PI * 2);
    ctx.ellipse(x + 12, y - 2, 7, 12, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a140c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 8);
    ctx.lineTo(x + 8, y - 8 + sway);
    ctx.stroke();
    // 一只浑浊的大眼
    ctx.fillStyle = m.state === "chase" ? "rgba(255, 120, 60, 0.95)" : "rgba(220, 120, 70, 0.8)";
    ctx.beginPath();
    ctx.arc(x, y - 6, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 匍匐者：贴地、高速、视野极远的爬行怪物
  private drawCrawler(ctx: CanvasRenderingContext2D, x: number, y: number, m: Monster, time: number) {
    const aura = ctx.createRadialGradient(x, y, 0, x, y, m.state === "chase" ? 50 : 28);
    aura.addColorStop(0, m.state === "chase" ? "rgba(40, 90, 70, 0.34)" : "rgba(40, 80, 60, 0.14)");
    aura.addColorStop(1, "rgba(40, 90, 70, 0)");
    ctx.fillStyle = aura;
    ctx.fillRect(x - 56, y - 56, 112, 112);

    const wriggle = Math.sin(time * 16) * 5;
    ctx.fillStyle = m.state === "chase" ? "#5e7a64" : "#4a604f";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // 节段身体
    ctx.strokeStyle = "rgba(20,40,30,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 4);
    ctx.quadraticCurveTo(x - 18, y + 4 + wriggle, x - 24, y + 6);
    ctx.stroke();
    // 抬起的头颅与多眼
    ctx.fillStyle = "#3a4a3e";
    ctx.beginPath();
    ctx.ellipse(x + 10, y, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200, 255, 180, 0.95)";
    ctx.beginPath();
    ctx.arc(x + 12, y - 1, 1.2, 0, Math.PI * 2);
    ctx.arc(x + 9, y - 2, 1.2, 0, Math.PI * 2);
    ctx.arc(x + 14, y, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, origin: Vec2, angle: number) {
    ctx.save();
    ctx.translate(origin.x, origin.y);

    const pulse = 0.65 + 0.18 * Math.sin(performance.now() / 160);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
    halo.addColorStop(0, `rgba(235, 228, 190, ${0.28 * pulse})`);
    halo.addColorStop(1, "rgba(235, 228, 190, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(-38, -38, 76, 76);

    // 生命药水护盾光环：提示玩家当前拥有免疫层数
    const p = this.state.player;
    if (p.shieldTimer > 0 || p.invulnTimer > 0) {
      const urgency = p.shieldTimer > 0 ? 1 - p.shieldTimer / SHIELD_DURATION : 0.2;
      const sp = 0.5 + 0.3 * Math.sin(performance.now() / Math.max(55, 140 - urgency * 80));
      ctx.strokeStyle = `rgba(255, 90, 110, ${0.35 + 0.35 * urgency * sp})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 18 + urgency * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 120, 130, ${0.85 * sp})`;
      ctx.font = "bold 10px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(p.shieldTimer > 0 ? `${p.shieldTimer.toFixed(1)}s` : "!", 0, -24);
    }

    ctx.rotate(angle);

    const af = this.state.player.attackFlash;
    if (af > 0) {
      const prog = 1 - af / 0.22;
      const reach = ATTACK_RANGE;
      const half = (Math.PI * 0.7) / 2;
      const sweep = -half + Math.PI * 0.7 * prog;
      ctx.save();
      ctx.strokeStyle = `rgba(230, 235, 255, ${0.7 * (1 - prog)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, reach * 0.8, sweep - 0.4, sweep + 0.4);
      ctx.stroke();
      ctx.restore();
    }

    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(248, 238, 198, 0.95)";
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#8a8a92";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f5edbd";
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(5, -7);
    ctx.lineTo(5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#171719";
    ctx.beginPath();
    ctx.arc(-2, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderSurvivor(ctx: CanvasRenderingContext2D, survivor: Survivor, cam: Vec2, time: number) {
    const x = survivor.pos.x - cam.x;
    const y = survivor.pos.y - cam.y;
    const pulse = 0.65 + 0.25 * Math.sin(time * 4);

    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, survivor.rescued ? 30 : 42);
    glow.addColorStop(0, survivor.rescued ? `rgba(130, 210, 255, ${0.22 * pulse})` : `rgba(255, 230, 160, ${0.35 * pulse})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 46, y - 46, 92, 92);

    ctx.fillStyle = survivor.rescued ? "#78a7bd" : "#c8b274";
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#efe4c0";
    ctx.beginPath();
    ctx.arc(x, y - 12, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = survivor.rescued ? "rgba(150, 220, 255, 0.9)" : "rgba(255, 230, 160, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, survivor.rescued ? 15 : 18, 0, Math.PI * 2);
    ctx.stroke();

    if (!survivor.rescued) {
      ctx.fillStyle = "rgba(255, 230, 160, 0.95)";
      ctx.font = "10px Courier New";
      ctx.textAlign = "center";
      ctx.fillText("求救", x, y + 30);
    }
    ctx.restore();
  }

  private renderDangerSignal(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
    const danger = this.state.dangerLevel;
    if (danger <= 0.05) return;
    ctx.save();
    const alpha = (0.08 + 0.08 * Math.sin(time * 14)) * danger;
    ctx.fillStyle = `rgba(130, 8, 8, ${alpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private renderShieldWarning(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
    const timer = this.state.player.shieldTimer;
    if (timer <= 0) return;
    const urgency = clamp(1 - timer / SHIELD_DURATION, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(time * (5 + urgency * 12));
    ctx.save();

    const edge = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * (0.28 - urgency * 0.08), w / 2, h / 2, Math.max(w, h) * 0.68);
    edge.addColorStop(0, "rgba(70,0,0,0)");
    edge.addColorStop(0.68, `rgba(80,10,6,${0.04 + urgency * 0.12})`);
    edge.addColorStop(1, `rgba(100,14,10,${0.12 + urgency * 0.28})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = `rgba(120, 32, 20, ${urgency * (0.18 + pulse * 0.18)})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const side = i % 4;
      const t = (Math.sin(time * 0.7 + i * 9.17) * 0.5 + 0.5);
      const x = side < 2 ? t * w : side === 2 ? 0 : w;
      const y = side >= 2 ? t * h : side === 0 ? 0 : h;
      const len = 22 + urgency * 58;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(i * 2.4) * len, y + Math.sin(i * 1.9) * len);
      ctx.stroke();
    }

    if (timer < 3) {
      ctx.fillStyle = `rgba(40, 0, 0, ${0.08 + pulse * 0.08})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  private renderNoisePulse(ctx: CanvasRenderingContext2D, origin: Vec2) {
    const noise = this.state.noiseLevel;
    if (noise <= 0.2) return;
    ctx.save();
    ctx.strokeStyle = `rgba(220, 220, 190, ${0.18 * noise})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 28 + noise * 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private renderPings(ctx: CanvasRenderingContext2D, cam: Vec2) {
    if (this.state.pings.length === 0) return;
    ctx.save();
    for (const ping of this.state.pings) {
      const alpha = Math.max(0, 1 - ping.age / ping.life);
      const x = ping.pos.x - cam.x;
      const y = ping.pos.y - cam.y;
      ctx.strokeStyle = `rgba(160, 210, 255, ${0.32 * alpha})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 12]);
      ctx.beginPath();
      ctx.arc(x, y, ping.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 水纹追踪器：渲染怪物路径
  private renderRipplePaths(ctx: CanvasRenderingContext2D, cam: Vec2, paths: Vec2[][], time: number) {
    ctx.save();
    for (const path of paths) {
      if (path.length < 2) continue;
      ctx.strokeStyle = `rgba(120, 180, 230, ${0.25 + 0.15 * Math.sin(time * 3)})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const p = path[i];
        const x = p.x - cam.x;
        const y = p.y - cam.y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // HUD：显示道具栏（新道具系统）
  private renderHUD(ctx: CanvasRenderingContext2D, w: number, h: number, s: GameState, time: number) {
    ctx.save();
    const baseY = h - 90;
    const padding = 12;

    // 背景板
    ctx.fillStyle = "rgba(20, 20, 22, 0.82)";
    ctx.fillRect(padding, baseY, w - padding * 2, 78);
    ctx.strokeStyle = "rgba(100, 100, 110, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, baseY, w - padding * 2, 78);

    ctx.fillStyle = "#e8e2c4";
    ctx.font = "11px Courier New";
    ctx.textAlign = "left";

    let offsetX = padding + 10;
    const lineH = 16;

    // 道具栏标题
    ctx.fillText("道具栏", offsetX, baseY + 14);
    offsetX = padding + 10;
    let offsetY = baseY + 32;

    // 第一行：原有道具
    ctx.fillText(`[1] 药水 ×${s.player.potions}`, offsetX, offsetY);
    offsetX += 130;
    ctx.fillText(`[2] 十字架 ×${s.player.crucifix}`, offsetX, offsetY);
    offsetX += 140;

    // 灰烬（道德选择核心）
    const ashColor = s.player.ashes > 0 ? "#f5c84a" : "#666";
    ctx.fillStyle = ashColor;
    ctx.fillText(`[G] 灰烬 ×${s.player.ashes}`, offsetX, offsetY);
    ctx.fillStyle = "#e8e2c4";

    // 第二行：新道具
    offsetX = padding + 10;
    offsetY += lineH;
    const radioStatus = s.player.radio ? "✓" : "✗";
    ctx.fillText(`[3] 收音机 ${radioStatus}`, offsetX, offsetY);
    offsetX += 130;
    const trackerStatus = s.player.rippleTracker ? "✓" : "✗";
    ctx.fillText(`水纹罗盘 ${trackerStatus}`, offsetX, offsetY);
    offsetX += 140;

    // 手电模式
    const flashMode = s.player.flashlightMode === "wide" ? "广角" : "聚焦";
    ctx.fillText(`[F] 手电: ${flashMode}`, offsetX, offsetY);

    ctx.restore();
  }

  private renderMiniMap(ctx: CanvasRenderingContext2D, w: number, time: number) {
    const s = this.state;
    const size = w < 520 ? 124 : Math.min(188, Math.max(132, w * 0.19));
    const pad = w < 520 ? 6 : 12;
    const x0 = w - size - 16;
    const y0 = 64;
    const cell = size / Math.max(this.map.cols, this.map.rows);
    const mapW = this.map.cols * cell;
    const mapH = this.map.rows * cell;
    const ox = x0 + (size - mapW) / 2;
    const oy = y0 + (size - mapH) / 2;
    const pulse = 0.18 + s.mapPulse * 0.2 + 0.04 * Math.sin(time * 4);

    ctx.save();
    ctx.fillStyle = "rgba(6, 7, 8, 0.68)";
    ctx.strokeStyle = `rgba(190, 205, 210, ${0.18 + pulse})`;
    ctx.lineWidth = 1;
    ctx.fillRect(x0 - pad, y0 - pad, size + pad * 2, size + pad * 2);
    ctx.strokeRect(x0 - pad, y0 - pad, size + pad * 2, size + pad * 2);

    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        if (!s.visited[r]?.[c]) continue;
        const t = this.map.grid[r][c];
        if (t === 1) ctx.fillStyle = "rgba(150, 155, 150, 0.25)";
        else if (t === 2) ctx.fillStyle = this.exitOpen ? "rgba(135, 255, 160, 0.88)" : "rgba(145, 110, 70, 0.65)";
        else ctx.fillStyle = "rgba(210, 215, 200, 0.22)";
        ctx.fillRect(ox + c * cell, oy + r * cell, Math.max(1, cell - 0.4), Math.max(1, cell - 0.4));
      }
    }

    const drawDot = (pos: Vec2, color: string, radius = 2.2) => {
      const x = ox + (pos.x / TILE) * cell;
      const y = oy + (pos.y / TILE) * cell;
      const c = Math.floor(pos.x / TILE);
      const r = Math.floor(pos.y / TILE);
      if (!s.visited[r]?.[c] && s.mapPulse <= 0) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    for (const clue of s.clues) {
      if (!clue.collected) drawDot(clue.pos, "rgba(255, 226, 130, 0.95)", 2.3);
    }
    for (const sigil of s.sigils) {
      if (sigil.progress < 1) {
        drawDot(sigil.pos, sigil.active ? "rgba(190, 145, 255, 0.98)" : "rgba(120, 120, 145, 0.6)", 2.7);
      }
    }
    for (const survivor of s.survivors) {
      drawDot(survivor.pos, survivor.rescued ? "rgba(130, 220, 255, 0.98)" : "rgba(255, 210, 110, 0.92)", 2.8);
    }
    if (this.exitOpen) drawDot(this.map.exit, "rgba(140, 255, 160, 1)", 2.8);
    drawDot(s.player.pos, "rgba(245, 245, 230, 1)", 3);

    const scanReady = Math.max(0, Math.min(1, 1 - this.scanCooldown / SCAN_COOLDOWN));
    const barY = y0 + size + 16;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x0 - pad, barY, size + pad * 2, 4);
    ctx.fillStyle = scanReady >= 1 ? "rgba(120, 210, 255, 0.82)" : "rgba(120, 150, 170, 0.62)";
    ctx.fillRect(x0 - pad, barY, (size + pad * 2) * scanReady, 4);

    ctx.font = "10px Courier New";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(220, 225, 210, 0.68)";
    ctx.fillText(scanReady >= 1 ? "Q 声呐就绪" : "Q 声呐充能中", x0 - pad, barY + 16);
    ctx.restore();
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}


function computeFlicker(battery: number, time: number): number {
  if (battery > 0.25) return 1;
  const lowness = 1 - battery / 0.25;
  const n = Math.sin(time * 27.3) * Math.sin(time * 9.1) * Math.sin(time * 3.7);

  if (n < -0.25 - (1 - lowness) * 0.4) return 0.12;
  return 1 - lowness * 0.3;
}

function endlessBonus(depth: number): { battery: number; sanity: number; potions: number; crucifix: number } {
  if (depth <= 2) return { battery: 0, sanity: 0, potions: 0, crucifix: 0 };
  const endlessDepth = Math.max(0, depth - LEVELS.length);
  return {
    battery: Math.min(1.8, depth * 0.04),
    sanity: Math.min(0.18, endlessDepth * 0.015),
    potions: endlessDepth > 0 && depth % 2 === 0 ? 1 : 0,
    crucifix: endlessDepth > 0 && depth % 3 === 0 ? 1 : 0,
  };
}

function monsterPlanForDepth(depth: number): MonsterKind[] {
  const design = levelForDepth(depth);
  if (design.monsterPressure <= 0) return [];
  // 阶梯难度：层数越深，怪物越多、越凶
  const count = Math.min(Math.max(1, Math.round((3 + Math.floor(depth * 0.8)) * design.monsterPressure)), 18);
  const kinds: MonsterKind[] = [];
  for (let i = 0; i < count; i++) {
    let kind: MonsterKind = "wanderer";
    const r = i + depth;
    // 深层引入更危险、外貌各异的种类
    if (depth >= 6 && r % 5 === 4) kind = "brute";
    else if (depth >= 4 && r % 4 === 3) kind = "crawler";
    else if (depth >= 3 && r % 3 === 2) kind = "listener";
    else if (depth >= 2 && r % 2 === 1) kind = "stalker";
    kinds.push(kind);
  }
  return kinds;
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function selectScatteredCells(cells: Vec2[], count: number, anchors: Vec2[], minDistance: number): Vec2[] {
  const selected: Vec2[] = [];
  const pool = [...cells];
  shuffle(pool);

  for (let i = 0; i < count && pool.length > 0; i++) {
    let threshold = minDistance;
    let candidates: number[] = [];

    while (threshold > TILE * 0.8 && candidates.length === 0) {
      candidates = pool
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => nearestDistance(cell, [...anchors, ...selected]) >= threshold)
        .map(({ index }) => index);
      threshold *= 0.78;
    }

    const pickedIndex =
      candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : Math.floor(Math.random() * pool.length);
    const [picked] = pool.splice(pickedIndex, 1);
    selected.push(jitterCellCenter(picked));
  }

  return selected;
}

function nearestDistance(point: Vec2, anchors: Vec2[]): number {
  if (anchors.length === 0) return Infinity;
  return anchors.reduce((best, anchor) => Math.min(best, Math.hypot(point.x - anchor.x, point.y - anchor.y)), Infinity);
}

function jitterCellCenter(pos: Vec2): Vec2 {
  const jitter = TILE * 0.36;
  return {
    x: pos.x + (Math.random() - 0.5) * jitter,
    y: pos.y + (Math.random() - 0.5) * jitter,
  };
}

function createVisitedGrid(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
}

function markVisitedArea(visited: boolean[][], map: GameMap, center: Vec2, radius: number) {
  const minC = Math.max(0, Math.floor((center.x - radius) / TILE));
  const maxC = Math.min(map.cols - 1, Math.ceil((center.x + radius) / TILE));
  const minR = Math.max(0, Math.floor((center.y - radius) / TILE));
  const maxR = Math.min(map.rows - 1, Math.ceil((center.y + radius) / TILE));

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE / 2;
      if (Math.hypot(x - center.x, y - center.y) <= radius) visited[r][c] = true;
    }
  }
}


export interface Theme {
  name: string;
  floorA: string;
  floorB: string;
  wall: string;
  wallLine: string;
  bgm: number;
}

function themeForDepth(depth: number): Theme {
  const level = levelForDepth(depth);
  return { name: level.title, ...level.theme };
}

function levelForDepth(depth: number): LevelDesign {
  if (depth <= LEVELS.length) return LEVELS[Math.max(1, depth) - 1];

  const loop = depth - LEVELS.length - 1;
  const name = ENDLESS_NAMES[loop % ENDLESS_NAMES.length];
  const guide = ENDLESS_GUIDES[loop % ENDLESS_GUIDES.length];
  const clueLabel = ENDLESS_CLUE_LABELS[loop % ENDLESS_CLUE_LABELS.length];
  const sigilLabel = ENDLESS_SIGIL_LABELS[(loop + Math.floor(loop / 2)) % ENDLESS_SIGIL_LABELS.length];
  const exitLabel = ENDLESS_EXIT_LABELS[(loop + 2) % ENDLESS_EXIT_LABELS.length];
  const theme = ENDLESS_THEMES[loop % ENDLESS_THEMES.length];
  const pressure = Math.min(2.35, 1.0 + loop * 0.08);
  const clueCount = Math.min(7, 3 + Math.floor((depth - 7) / 4));
  const sigilCount = Math.min(6, 2 + Math.floor((depth - 8) / 5));

  return {
    chapter: "无尽下沉",
    title: `${name} B${depth}`,
    emotion: depth % 3 === 0 ? "恐怖" : depth % 3 === 1 ? "压抑" : "悲伤",
    mechanic: ENDLESS_MECHANICS[loop % ENDLESS_MECHANICS.length],
    dossier: "熟悉的地点被雾重新拼错。这里没有新的解释，只有更深的回声和更多补给。",
    artPromptId: "scene-endless-descent",
    clueLabel,
    sigilLabel,
    exitLabel,
    guide,
    clueCount,
    sigilCount,
    intro: `第 ${depth} 层 · ${name}。雾把熟悉的地点重新拼错，补给变多，追来的东西也更多。`,
    clueTexts: Array.from({ length: clueCount }, (_, i) => {
      const base = CLUE_TEXTS[(loop + i) % CLUE_TEXTS.length];
      return `第 ${depth} 层${clueLabel} ${i + 1}：${base}`;
    }),
    sigilPrompt: `完成 ${sigilCount} 处${sigilLabel}。每一次停留都会把怪物吸得更近。`,
    exitPrompt: `跟随${guideMotif(guide)}，找到${exitLabel}。它只通向更深处。`,
    completeText: `${sigilLabel}全部沉默，${exitLabel}在雾中张开。`,
    monsterPressure: pressure,
    theme,
  };
}

function guideMotif(guide: LevelDesign["guide"]): string {
  switch (guide) {
    case "ash":
      return "灰烬";
    case "ghost":
      return "背影";
    case "radio":
      return "杂音";
    case "light":
      return "晨光";
    case "heartbeat":
      return "心跳";
    case "bell":
      return "铃声";
    case "water":
      return "水纹";
    case "silence":
      return "静默";
  }
}

function guideColor(guide: LevelDesign["guide"], pulse: number): string {
  if (guide === "water") return `rgba(155, 185, 190, ${0.25 + pulse * 0.22})`;
  if (guide === "bell") return `rgba(230, 210, 145, ${0.25 + pulse * 0.22})`;
  if (guide === "silence") return `rgba(235, 230, 200, ${0.2 + pulse * 0.16})`;
  return `rgba(210, 205, 185, ${0.22 + pulse * 0.2})`;
}
