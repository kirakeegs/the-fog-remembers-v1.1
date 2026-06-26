import { GameMap, isWall, TILE } from "./map";
import { FlashlightMode, Vec2 } from "./types";

export const CONE_ANGLE = Math.PI / 3.2;
export const CONE_RANGE = TILE * 6.5;
export const AMBIENT_RANGE = TILE * 2.3;

// 手电模式参数：广角视野宽但近，聚焦视野窄但远
export const FLASHLIGHT_MODES: Record<FlashlightMode, { angle: number; rangeMul: number }> = {
  wide: { angle: Math.PI / 2.2, rangeMul: 0.78 },  // 广角：角度大、距离短
  focus: { angle: Math.PI / 5.5, rangeMul: 1.55 }, // 聚焦：角度小、距离远
};

export function coneAngleFor(mode: FlashlightMode): number {
  return FLASHLIGHT_MODES[mode].angle;
}

export function coneRangeFor(mode: FlashlightMode, baseRange: number = CONE_RANGE): number {
  return baseRange * FLASHLIGHT_MODES[mode].rangeMul;
}

export function castVisibility(
  map: GameMap,
  origin: Vec2,
  exitOpen: boolean,
  range: number = AMBIENT_RANGE,
): Vec2[] {
  const points: Vec2[] = [];
  const rays = 60;
  for (let i = 0; i < rays; i++) {
    points.push(castRay(map, origin, (Math.PI * 2 * i) / rays, range, exitOpen));
  }
  return points;
}

export function castFlashlight(
  map: GameMap,
  origin: Vec2,
  angle: number,
  exitOpen: boolean,
  range: number = CONE_RANGE,
  coneAngle: number = CONE_ANGLE,
): Vec2[] {
  const points: Vec2[] = [origin];
  const rays = 72;
  for (let i = 0; i <= rays; i++) {
    const a = angle - coneAngle / 2 + (coneAngle * i) / rays;
    points.push(castRay(map, origin, a, range, exitOpen));
  }
  return points;
}

export function inFlashlight(
  map: GameMap,
  origin: Vec2,
  angle: number,
  point: Vec2,
  exitOpen: boolean,
  range: number = CONE_RANGE,
  coneAngle: number = CONE_ANGLE,
): boolean {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= coneAngle / 2 && hasLine(map, origin, point, exitOpen);
}

export function inAmbient(map: GameMap, origin: Vec2, point: Vec2, exitOpen: boolean): boolean {
  return Math.hypot(point.x - origin.x, point.y - origin.y) <= AMBIENT_RANGE && hasLine(map, origin, point, exitOpen);
}

function castRay(map: GameMap, origin: Vec2, angle: number, range: number, exitOpen: boolean): Vec2 {
  const step = 8;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  let last = { ...origin };
  for (let d = step; d <= range; d += step) {
    const p = { x: origin.x + ux * d, y: origin.y + uy * d };
    if (isWall(map, p.x, p.y, exitOpen)) return last;
    last = p;
  }
  return last;
}

function hasLine(map: GameMap, from: Vec2, to: Vec2, exitOpen: boolean): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const step = 10;
  for (let d = step; d < dist; d += step) {
    if (isWall(map, from.x + (dx / dist) * d, from.y + (dy / dist) * d, exitOpen)) return false;
  }
  return true;
}
