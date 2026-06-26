import { GameMap, isWall, TILE } from "./map";
import { Monster, MonsterKind, Player, Vec2 } from "./types";

export const STATIC_RANGE = TILE * 6;





interface KindTuning {
  speed: number;
  chaseMul: number;
  sightRange: number;
  sightArc: number;
  detectRange: number;
  hearingRange: number;
  hearingSensitivity: number;
  loseRange: number;
  alertHold: number;
  radius: number;
}

const TUNING: Record<MonsterKind, KindTuning> = {
  wanderer: {
    speed: 66,
    chaseMul: 1.4,
    sightRange: TILE * 6.0,
    sightArc: Math.PI * 0.82,
    detectRange: TILE * 2.4,
    hearingRange: TILE * 4.2,
    hearingSensitivity: 1,
    loseRange: TILE * 5.5,
    alertHold: 2.4,
    radius: 12,
  },
  stalker: {
    speed: 78,
    chaseMul: 1.62,
    sightRange: TILE * 8.2,
    sightArc: Math.PI * 1.0,
    detectRange: TILE * 2.8,
    hearingRange: TILE * 4.0,
    hearingSensitivity: 0.85,
    loseRange: TILE * 8.0,
    alertHold: 4.2,
    radius: 12,
  },
  listener: {
    speed: 52,
    chaseMul: 1.95,
    sightRange: TILE * 1.3,
    sightArc: Math.PI * 0.5,
    detectRange: TILE * 1.4,
    hearingRange: TILE * 7.5,
    hearingSensitivity: 1.7,
    loseRange: TILE * 3.0,
    alertHold: 1.0,
    radius: 13,
  },
  brute: {
    speed: 44,
    chaseMul: 1.35,
    sightRange: TILE * 5.0,
    sightArc: Math.PI * 0.7,
    detectRange: TILE * 2.2,
    hearingRange: TILE * 3.6,
    hearingSensitivity: 0.7,
    loseRange: TILE * 4.5,
    alertHold: 3.4,
    radius: 18,
  },
  crawler: {
    speed: 96,
    chaseMul: 1.5,
    sightRange: TILE * 9.0,
    sightArc: Math.PI * 0.62,
    detectRange: TILE * 2.0,
    hearingRange: TILE * 3.2,
    hearingSensitivity: 0.9,
    loseRange: TILE * 9.0,
    alertHold: 2.0,
    radius: 9,
  },
};

export function tuningFor(kind: MonsterKind): KindTuning {
  return TUNING[kind];
}

export function createMonster(pos: Vec2, kind: MonsterKind = "wanderer"): Monster {
  const t = TUNING[kind];
  return {
    pos: { x: pos.x, y: pos.y },
    angle: Math.random() * Math.PI * 2,
    speed: t.speed,
    radius: t.radius,
    kind,
    state: "wander",
    wanderTimer: 1 + Math.random() * 2,
    target: null,
    alertTimer: 0,
    lungeFlash: 0,
    stunTimer: 0,
    chaseLock: 0,
  };
}

export function updateMonster(
  m: Monster,
  player: Player,
  map: GameMap,
  exitOpen: boolean,
  dt: number,
  playerNoise = 0,
) {
  const t = TUNING[m.kind];
  const dx = player.pos.x - m.pos.x;
  const dy = player.pos.y - m.pos.y;
  const dist = Math.hypot(dx, dy);

  if (m.lungeFlash > 0) m.lungeFlash -= dt;


  if (m.stunTimer > 0) {
    m.stunTimer -= dt;
    return;
  }

  // 幸存者牺牲 / 十字架定身之后的一段冷却：不会重新进入追击
  if (m.chaseLock > 0) {
    m.chaseLock -= dt;
    // 冷却期间若仍在追，强制降级为搜索，避免立刻又扑上来
    if (m.state === "chase") {
      m.state = "investigate";
      m.target = { x: player.pos.x, y: player.pos.y };
      m.alertTimer = Math.max(m.alertTimer, 0.8);
    }
  }

  // ========== 怪物机制差异化：每种怪物有独立的感知规则 ==========
  // 站立不动是否降噪（聆听者的核心对策）
  const playerStandingStill = playerNoise <= 0.05;

  let canSeePlayer: boolean;
  let heardPlayer: boolean;

  switch (m.kind) {
    case "listener":
      // 聆听者：几乎全盲，只靠声音。站定即隐身。
      // 对策：停止移动（不发出噪音）就能从追击中脱身
      canSeePlayer = dist < t.sightRange && hasLineOfSight(map, m.pos, player.pos, exitOpen);
      heardPlayer =
        !playerStandingStill &&
        playerNoise > 0.08 &&
        dist < t.hearingRange * (0.45 + playerNoise * t.hearingSensitivity);
      break;

    case "stalker":
      // 追猎者：长视野、死咬。一旦锁定，丢失目标后仍持续追击很久。
      // 对策：彻底切断视线 + 拉开极大距离，或用障碍物绕死它
      canSeePlayer =
        dist < t.sightRange &&
        withinVisionCone(m.angle, dx, dy, t.sightArc) &&
        hasLineOfSight(map, m.pos, player.pos, exitOpen);
      heardPlayer =
        playerNoise > 0.15 &&
        dist < t.hearingRange * (0.45 + playerNoise * t.hearingSensitivity);
      break;

    case "brute":
      // 残暴者：重装慢速，转身极慢。正面无法击退（attackMonsters 中处理）。
      // 对策：从侧后方绕行，利用它的转向迟缓
      canSeePlayer =
        dist < t.sightRange &&
        withinVisionCone(m.angle, dx, dy, t.sightArc) &&
        hasLineOfSight(map, m.pos, player.pos, exitOpen);
      heardPlayer =
        playerNoise > 0.25 &&
        dist < t.hearingRange * (0.4 + playerNoise * t.hearingSensitivity);
      break;

    case "crawler":
      // 匍匐者：贴地高速，视野极远，但在窄道才会爆发追击。
      // 对策：在开阔地带它较弱，狭窄通道极度危险
      canSeePlayer =
        dist < t.sightRange &&
        withinVisionCone(m.angle, dx, dy, t.sightArc) &&
        hasLineOfSight(map, m.pos, player.pos, exitOpen);
      heardPlayer =
        playerNoise > 0.12 &&
        dist < t.hearingRange * (0.45 + playerNoise * t.hearingSensitivity);
      break;

    default: // wanderer
      // 游荡者：标准威胁，视野+近距离感知均衡
      canSeePlayer =
        dist < t.sightRange &&
        withinVisionCone(m.angle, dx, dy, t.sightArc) &&
        hasLineOfSight(map, m.pos, player.pos, exitOpen);
      heardPlayer =
        playerNoise > 0.12 &&
        dist < t.hearingRange * (0.45 + playerNoise * t.hearingSensitivity);
      break;
  }

  const wasCalm = m.state !== "chase";

  // 聆听者不靠近距离触发（它看不见），其余怪物保留近距离感知
  const proximityDetect = m.kind === "listener" ? false : dist < t.detectRange;
  const senses = canSeePlayer || proximityDetect || heardPlayer;

  if (senses) {
    if (m.chaseLock > 0) {
      // 被定身/被挡下后的冷却期：只搜索，不追击
      if (m.state === "chase") {
        m.state = "investigate";
        m.target = { x: player.pos.x, y: player.pos.y };
        m.alertTimer = Math.max(m.alertTimer, 0.8);
      } else if (m.state !== "investigate") {
        m.state = "investigate";
        m.target = { x: player.pos.x, y: player.pos.y };
        m.alertTimer = Math.max(m.alertTimer, 1.6);
      }
    } else {
      if (wasCalm) m.lungeFlash = 0.5;
      m.state = "chase";
      m.target = { x: player.pos.x, y: player.pos.y };
      m.alertTimer = t.alertHold;
    }
  } else if (heardPlayer && m.state !== "chase") {
    m.state = "investigate";
    m.target = { x: player.pos.x, y: player.pos.y };
    m.alertTimer = 2.8;
  } else if (m.state === "chase") {
    // 追猎者死咬：丢失目标后追击时间更长（alertHold 已设很高）
    m.alertTimer -= dt;
    if (dist > t.loseRange && m.alertTimer <= 0) {
      m.state = m.target ? "investigate" : "wander";
      m.alertTimer = 1.2;
    }
  }

  let targetAngle: number;
  let speed = m.speed;

  if (m.state === "chase") {
    targetAngle = Math.atan2(dy, dx);
    speed = m.speed * t.chaseMul;

    // 匍匐者：在窄道（被墙夹住）时额外加速，开阔地略减速
    if (m.kind === "crawler") {
      const inCorridor = isInCorridor(map, m.pos, m.radius, exitOpen);
      speed *= inCorridor ? 1.35 : 0.82;
    }
  } else if (m.state === "investigate" && m.target) {
    const tx = m.target.x - m.pos.x;
    const ty = m.target.y - m.pos.y;
    const td = Math.hypot(tx, ty);
    targetAngle = Math.atan2(ty, tx);
    speed = m.speed * 0.82;

    if (td < TILE * 0.35) {
      m.target = null;
      m.alertTimer -= dt;
      if (m.alertTimer <= 0) {
        m.state = "wander";
        m.wanderTimer = 0.2;
      }
    }
  } else {
    m.wanderTimer -= dt;
    if (m.wanderTimer <= 0) {
      m.angle += (Math.random() - 0.5) * Math.PI;
      m.wanderTimer = 1.5 + Math.random() * 2.5;
    }
    targetAngle = m.angle;
    speed = m.speed * 0.55;
  }

  // 残暴者转向极慢（机制差异：必须绕行而非硬刚）
  let turnRate: number;
  if (m.kind === "brute") {
    turnRate = m.state === "chase" ? 0.05 : 0.025;
  } else if (m.kind === "stalker") {
    turnRate = m.state === "chase" ? 0.22 : 0.06;
  } else {
    turnRate = m.state === "chase" ? 0.18 : 0.06;
  }
  m.angle = lerpAngle(m.angle, targetAngle, turnRate);

  const move = speed * dt;
  const nx = m.pos.x + Math.cos(m.angle) * move;
  const ny = m.pos.y + Math.sin(m.angle) * move;
  const r = m.radius;


  let blocked = false;
  if (!hitWall(map, nx, m.pos.y, r, exitOpen)) {
    m.pos.x = nx;
  } else blocked = true;
  if (!hitWall(map, m.pos.x, ny, r, exitOpen)) {
    m.pos.y = ny;
  } else blocked = true;

  if (blocked && m.state === "wander") {
    m.angle += Math.PI / 2 + Math.random() * Math.PI;
  } else if (blocked && m.state === "investigate") {
    m.target = null;
    m.state = "wander";
    m.wanderTimer = 0.2;
  }
}

// 判断怪物是否处于窄道中（左右或上下被墙夹住）
function isInCorridor(map: GameMap, pos: Vec2, r: number, exitOpen: boolean): boolean {
  const probe = TILE * 0.9;
  const leftWall = isWall(map, pos.x - probe, pos.y, exitOpen);
  const rightWall = isWall(map, pos.x + probe, pos.y, exitOpen);
  const upWall = isWall(map, pos.x, pos.y - probe, exitOpen);
  const downWall = isWall(map, pos.x, pos.y + probe, exitOpen);
  // 横向通道（上下有墙）或纵向通道（左右有墙）
  return (upWall && downWall) || (leftWall && rightWall);
}


export function nearestMonsterDist(player: Player, monsters: Monster[]): number {
  let best = Infinity;
  for (const m of monsters) {
    const d = Math.hypot(player.pos.x - m.pos.x, player.pos.y - m.pos.y);
    if (d < best) best = d;
  }
  return best;
}

export function dangerLevel(player: Player, monsters: Monster[]): number {
  let level = 0;
  for (const m of monsters) {
    const d = Math.hypot(player.pos.x - m.pos.x, player.pos.y - m.pos.y);
    const proximity = Math.max(0, 1 - d / STATIC_RANGE);
    const stateBoost = m.state === "chase" ? 0.55 : m.state === "investigate" ? 0.25 : 0;
    level = Math.max(level, Math.min(1, proximity * 0.75 + stateBoost));
  }
  return level;
}


export function caughtPlayer(player: Player, monsters: Monster[]): boolean {
  for (const m of monsters) {
    const d = Math.hypot(player.pos.x - m.pos.x, player.pos.y - m.pos.y);
    if (d < m.radius + player.radius) return true;
  }
  return false;
}


export const ATTACK_RANGE = TILE * 1.5;
const ATTACK_ARC = Math.PI * 0.7;

export function attackMonsters(
  player: Player,
  monsters: Monster[],
  map: GameMap,
  exitOpen: boolean,
): number {
  let hits = 0;
  for (const m of monsters) {
    const dx = m.pos.x - player.pos.x;
    const dy = m.pos.y - player.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist > ATTACK_RANGE + m.radius) continue;


    if (dist > player.radius + m.radius + 2) {
      let diff = Math.atan2(dy, dx) - player.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > ATTACK_ARC / 2) continue;
    }

    // ========== 残暴者：正面无法击退 ==========
    if (m.kind === "brute") {
      // 计算玩家攻击方向与怪物朝向的夹角
      const attackAngle = Math.atan2(dy, dx);
      let angleToMonsterFront = attackAngle - m.angle;
      while (angleToMonsterFront > Math.PI) angleToMonsterFront -= Math.PI * 2;
      while (angleToMonsterFront < -Math.PI) angleToMonsterFront += Math.PI * 2;

      // 如果从正面（±60度内）攻击，残暴者不会被击退
      const frontArc = Math.PI / 3;
      if (Math.abs(angleToMonsterFront) < frontArc) {
        // 正面攻击无效，只给玩家短暂眩晕反馈
        m.lungeFlash = 0.15;
        continue; // 不计入 hits，不造成击退/眩晕
      }
    }

    hits++;
    const knock =
      m.kind === "listener" ? TILE * 2.1 : m.kind === "stalker" ? TILE * 1.0 : TILE * 1.5;
    const stun =
      m.kind === "listener" ? 2.4 : m.kind === "stalker" ? 1.1 : 1.7;

    const ux = dist > 0.001 ? dx / dist : Math.cos(player.angle);
    const uy = dist > 0.001 ? dy / dist : Math.sin(player.angle);

    const stepN = 8;
    for (let s = 0; s < stepN; s++) {
      const nx = m.pos.x + (ux * knock) / stepN;
      const ny = m.pos.y + (uy * knock) / stepN;
      if (hitWall(map, nx, m.pos.y, m.radius, exitOpen)) break;
      if (hitWall(map, m.pos.x, ny, m.radius, exitOpen)) {
        m.pos.x = nx;
        break;
      }
      m.pos.x = nx;
      m.pos.y = ny;
    }

    m.stunTimer = Math.max(m.stunTimer, stun);
    m.lungeFlash = 0;
    m.state = "investigate";
    m.target = { x: player.pos.x, y: player.pos.y };
    m.alertTimer = 0.8;
  }
  return hits;
}

function hitWall(map: GameMap, x: number, y: number, r: number, exitOpen: boolean): boolean {
  return (
    isWall(map, x - r, y - r, exitOpen) ||
    isWall(map, x + r, y - r, exitOpen) ||
    isWall(map, x - r, y + r, exitOpen) ||
    isWall(map, x + r, y + r, exitOpen)
  );
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function withinVisionCone(angle: number, dx: number, dy: number, arc: number): boolean {
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < arc / 2;
}

function hasLineOfSight(map: GameMap, from: Vec2, to: Vec2, exitOpen: boolean): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0) return true;

  const step = 10;
  const ux = dx / dist;
  const uy = dy / dist;
  for (let d = step; d < dist; d += step) {
    if (isWall(map, from.x + ux * d, from.y + uy * d, exitOpen)) return false;
  }
  return true;
}
