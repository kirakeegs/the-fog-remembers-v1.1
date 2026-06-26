import { TileType, Vec2 } from "./types";

export const TILE = 60;

export interface GameMap {
  grid: TileType[][];
  cols: number;
  rows: number;
  spawn: Vec2;
  exit: Vec2;
}

export function buildMap(depth = 1): GameMap {
  // 地图随层数增大：越往下沉，雾越广
  const cols = 25 + Math.min(28, depth * 3);
  const rows = 19 + Math.min(20, depth * 2);
  const grid: TileType[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (r === 0 || c === 0 || r === rows - 1 || c === cols - 1 ? 1 : 0)),
  );

  for (let r = 2; r < rows - 2; r += 2) {
    for (let c = 2; c < cols - 2; c += 2) {
      if (Math.random() < 0.52) grid[r][c] = 1;
      if (Math.random() < 0.38) {
        const dc = Math.random() < 0.5 ? 1 : -1;
        if (grid[r][c + dc] !== 2) grid[r][c + dc] = 1;
      } else {
        const dr = Math.random() < 0.5 ? 1 : -1;
        if (grid[r + dr]?.[c] !== 2) grid[r + dr][c] = 1;
      }
    }
  }

  const spawnCell = { c: 1, r: 1 };
  const exitCell = chooseExitCell(cols, rows, spawnCell);
  grid[spawnCell.r][spawnCell.c] = 3;
  grid[exitCell.r][exitCell.c] = 2;
  carvePath(grid, spawnCell, exitCell);

  return {
    grid,
    cols,
    rows,
    spawn: cellCenter(spawnCell.c, spawnCell.r),
    exit: cellCenter(exitCell.c, exitCell.r),
  };
}

export function tileAt(map: GameMap, x: number, y: number): TileType {
  const c = Math.floor(x / TILE);
  const r = Math.floor(y / TILE);
  if (r < 0 || c < 0 || r >= map.rows || c >= map.cols) return 1;
  return map.grid[r][c];
}

export function isWall(map: GameMap, x: number, y: number, exitOpen: boolean): boolean {
  const t = tileAt(map, x, y);
  return t === 1 || (t === 2 && !exitOpen);
}

export function findOpenCells(map: GameMap): Vec2[] {
  const cells: Vec2[] = [];
  const startC = Math.floor(map.spawn.x / TILE);
  const startR = Math.floor(map.spawn.y / TILE);
  const seen = Array.from({ length: map.rows }, () => Array.from({ length: map.cols }, () => false));
  const queue: Array<{ c: number; r: number }> = [{ c: startC, r: startR }];
  seen[startR][startC] = true;

  for (let i = 0; i < queue.length; i++) {
    const { c, r } = queue[i];
    const t = map.grid[r]?.[c];
    if (t === 0 || t === 3) cells.push(cellCenter(c, r));

    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nr < 1 || nc < 1 || nr >= map.rows - 1 || nc >= map.cols - 1 || seen[nr][nc]) continue;
      const nt = map.grid[nr][nc];
      if (nt === 1 || nt === 2) continue;
      seen[nr][nc] = true;
      queue.push({ c: nc, r: nr });
    }
  }

  return cells;
}

function cellCenter(c: number, r: number): Vec2 {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

function chooseExitCell(cols: number, rows: number, spawn: { c: number; r: number }) {
  const candidates: Array<{ c: number; r: number; weight: number }> = [];
  const forbidden = { c: cols - 2, r: rows - 2 };
  const minDist = Math.max(cols, rows) * 0.45;

  for (let r = 2; r < rows - 2; r++) {
    for (let c = 2; c < cols - 2; c++) {
      if (c === forbidden.c && r === forbidden.r) continue;
      const d = Math.hypot(c - spawn.c, r - spawn.r);
      if (d < minDist) continue;

      const edgeBias = Math.min(c, r, cols - 1 - c, rows - 1 - r);
      const farBias = d / Math.hypot(cols, rows);
      candidates.push({ c, r, weight: farBias * 1.8 + 1 / Math.max(1, edgeBias) });
    }
  }

  if (candidates.length === 0) return { c: Math.max(2, cols - 3), r: Math.max(2, rows - 3) };

  const total = candidates.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of candidates) {
    roll -= item.weight;
    if (roll <= 0) return { c: item.c, r: item.r };
  }
  const last = candidates[candidates.length - 1];
  return { c: last.c, r: last.r };
}

function carvePath(grid: TileType[][], from: { c: number; r: number }, to: { c: number; r: number }) {
  let c = from.c;
  let r = from.r;
  while (c !== to.c || r !== to.r) {
    grid[r][c] = grid[r][c] === 2 ? 2 : 0;
    if (c !== to.c && (r === to.r || Math.random() < 0.58)) c += Math.sign(to.c - c);
    else if (r !== to.r) r += Math.sign(to.r - r);
  }
  grid[to.r][to.c] = 2;
}
