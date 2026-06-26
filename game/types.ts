export interface Vec2 {
  x: number;
  y: number;
}

export type TileType = 0 | 1 | 2 | 3;

export type FlashlightMode = "wide" | "focus";

export interface Player {
  pos: Vec2;
  angle: number;
  speed: number;
  radius: number;
  stamina: number;
  sprinting: boolean;
  exhausted: boolean;
  battery: number;
  sanity: number;
  attackCooldown: number;
  attackFlash: number;
  potions: number;
  shields: number;
  shieldTimer: number;
  crucifix: number;
  invulnTimer: number;
  // 新道具系统
  ashes: number;           // 灰烬：归还名字
  radio: boolean;          // 收音机：被动探测
  rippleTracker: boolean;  // 水纹追踪：显示怪物路径
  flashlightMode: FlashlightMode; // 手电模式：广角/聚焦
  inventory: PickupKind[]; // 背包容量限制
  maxInventory: number;    // 最大容量
}

export type MonsterKind = "wanderer" | "stalker" | "listener" | "brute" | "crawler";
export type MonsterState = "wander" | "investigate" | "chase";

export interface Monster {
  pos: Vec2;
  angle: number;
  speed: number;
  radius: number;
  kind: MonsterKind;
  state: MonsterState;
  wanderTimer: number;
  target: Vec2 | null;
  alertTimer: number;
  lungeFlash: number;
  stunTimer: number;
  chaseLock: number;
}

export interface Clue {
  pos: Vec2;
  collected: boolean;
  text: string;
}

export interface Sigil {
  pos: Vec2;
  active: boolean;
  progress: number;
  pulse: number;
}

export interface EchoPing {
  pos: Vec2;
  age: number;
  life: number;
  radius: number;
  maxRadius: number;
}

export type PickupKind = "battery" | "potion" | "crucifix" | "ash" | "radio" | "ripple-tracker";

export interface Pickup {
  pos: Vec2;
  taken: boolean;
  kind: PickupKind;
}

export interface AshPickup {
  pos: Vec2;
  taken: boolean;
  name: string; // 死者名字
  returned: boolean;
}

export interface Survivor {
  pos: Vec2;
  rescued: boolean;
  followOffset: number;
  sacrificed?: boolean;
  name?: string;        // 同行者名字
  trust?: number;       // 信任度 0-1，影响结局
}

export type GamePhase = "playing" | "paused" | "caught" | "escaped";

// 叙事/道德选择状态
export interface MoralState {
  ashesReturned: number;     // 归还的灰烬数量
  ashesAbandoned: number;    // 遗弃的灰烬数量
  survivorsSaved: number;    // 救下的同行者
  survivorsSacrificed: number; // 牺牲的同行者
  cluesIgnored: number;      // 忽视的证物
  truthFaced: number;        // 直面的真相
  silenceChosen: number;     // 选择沉默的次数
}

export type EndingKind = "redemption" | "denial" | "sacrifice" | "truth" | "endless";

export interface GameState {
  player: Player;
  monsters: Monster[];
  clues: Clue[];
  sigils: Sigil[];
  pickups: Pickup[];
  ashPickups: AshPickup[];   // 灰烬（死者名字）
  survivors: Survivor[];
  phase: GamePhase;
  staticLevel: number;
  messageText: string;
  messageTimer: number;
  elapsed: number;
  totalElapsed: number;
  dangerLevel: number;
  noiseLevel: number;
  depth: number;
  hallucinations: Vec2[];
  visited: boolean[][];
  pings: EchoPing[];
  mapPulse: number;
  flicker: number;
  transition: number;
  moral: MoralState;          // 道德状态
  ripplePaths: Vec2[][];      // 水纹追踪显示的怪物路径
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  pausePressed: boolean;
  restartPressed: boolean;
  attackPressed: boolean;
  scanPressed: boolean;
  interact: boolean;
  usePotion: boolean;
  useCrucifix: boolean;
  virtualMove: Vec2;
  virtualSprint: boolean;
  aim: Vec2 | null;
  // 新道具操作
  toggleFlashlight: boolean;  // 切换手电模式
  useRadio: boolean;          // 使用收音机扫描
  returnAsh: boolean;         // 归还灰烬
}
