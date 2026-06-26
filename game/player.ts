import { GameMap, isWall } from "./map";
import { InputState, Player } from "./types";

export function createPlayer(spawn: { x: number; y: number }): Player {
  return {
    pos: { x: spawn.x, y: spawn.y },
    angle: 0,
    speed: 165,
    radius: 7,
    stamina: 1,
    sprinting: false,
    exhausted: false,
    battery: 1,
    sanity: 1,
    attackCooldown: 0,
    attackFlash: 0,
    potions: 0,
    shields: 0,
    shieldTimer: 0,
    crucifix: 0,
    invulnTimer: 0,
    // 新道具系统
    ashes: 0,
    radio: false,
    rippleTracker: false,
    flashlightMode: "wide",
    inventory: [],
    maxInventory: 6,
  };
}

export function updatePlayer(
  player: Player,
  input: InputState,
  map: GameMap,
  exitOpen: boolean,
  dt: number,
  drainRate = 0.018,
) {
  if (player.attackCooldown > 0) player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  if (player.attackFlash > 0) player.attackFlash = Math.max(0, player.attackFlash - dt);
  if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  if (player.shieldTimer > 0) player.shieldTimer = Math.max(0, player.shieldTimer - dt);

  let dx = input.virtualMove.x;
  let dy = input.virtualMove.y;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;

  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }

  const moving = Math.hypot(dx, dy) > 0.05;
  const canSprint = moving && (input.sprint || input.virtualSprint) && player.stamina > 0.04 && !player.exhausted;
  player.sprinting = canSprint;

  if (canSprint) {
    player.stamina = Math.max(0, player.stamina - dt * 0.28);
    if (player.stamina <= 0.02) player.exhausted = true;
  } else {
    player.stamina = Math.min(1, player.stamina + dt * (moving ? 0.12 : 0.22));
    if (player.stamina > 0.35) player.exhausted = false;
  }

  player.battery = Math.max(0, player.battery - dt * drainRate * (moving ? 1.15 : 0.85));

  const move = player.speed * (canSprint ? 1.55 : 1) * (player.exhausted ? 0.78 : 1) * dt;
  const nx = player.pos.x + dx * move;
  const ny = player.pos.y + dy * move;
  const r = player.radius;

  if (!collides(map, nx, player.pos.y, r, exitOpen)) player.pos.x = nx;
  if (!collides(map, player.pos.x, ny, r, exitOpen)) player.pos.y = ny;

  if (moving) player.angle = Math.atan2(dy, dx);
  else if (input.aim) player.angle = Math.atan2(input.aim.y - player.pos.y, input.aim.x - player.pos.x);
}

function collides(map: GameMap, x: number, y: number, r: number, exitOpen: boolean): boolean {
  return (
    isWall(map, x - r, y - r, exitOpen) ||
    isWall(map, x + r, y - r, exitOpen) ||
    isWall(map, x - r, y + r, exitOpen) ||
    isWall(map, x + r, y + r, exitOpen)
  );
}
