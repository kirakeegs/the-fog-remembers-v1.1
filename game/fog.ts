import { Vec2 } from "./types";

export function renderDarkness(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  screenOrigin: Vec2,
  coneScreenPoly: Vec2[],
  nearScreenPoly: Vec2[],
  coneRange: number,
  brightness: number,
) {
  ctx.save();
  // 全屏压暗（雾夜底色）
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(0, 0, w, h);

  // 在手电锥形与近身范围里"挖掉"黑暗
  ctx.globalCompositeOperation = "destination-out";
  drawPoly(ctx, nearScreenPoly, 0.6);
  drawPoly(ctx, coneScreenPoly, Math.max(0.35, brightness));

  // 手电照射区域叠加暖光（越靠近中心越亮），让被照亮的范围真正发亮
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(screenOrigin.x, screenOrigin.y, 0, screenOrigin.x, screenOrigin.y, coneRange);
  glow.addColorStop(0, `rgba(255, 238, 196, ${0.22 * brightness})`);
  glow.addColorStop(0.55, `rgba(255, 226, 170, ${0.12 * brightness})`);
  glow.addColorStop(1, "rgba(255, 226, 170, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(screenOrigin.x, screenOrigin.y, coneRange, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderFog(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, danger: number) {
  ctx.save();
  ctx.globalAlpha = 0.18 + danger * 0.12;
  for (let i = 0; i < 12; i++) {
    const y = ((i * 73 + time * (18 + i)) % (h + 160)) - 80;
    const grad = ctx.createLinearGradient(0, y, w, y + 80);
    grad.addColorStop(0, "rgba(190,190,180,0)");
    grad.addColorStop(0.5, "rgba(190,190,180,0.13)");
    grad.addColorStop(1, "rgba(190,190,180,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, w, 90);
  }
  ctx.restore();
}

export function renderDamageFlash(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(150, 0, 0, ${0.22 * amount})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function renderGrain(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, insanity: number) {
  ctx.save();
  ctx.globalAlpha = 0.08 + insanity * 0.16;
  ctx.fillStyle = "#fff";
  const count = 90 + Math.floor(insanity * 160);
  for (let i = 0; i < count; i++) {
    const x = (Math.sin(i * 91.7 + time * 31) * 0.5 + 0.5) * w;
    const y = (Math.sin(i * 47.3 + time * 43) * 0.5 + 0.5) * h;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

export function renderLowBattery(ctx: CanvasRenderingContext2D, w: number, h: number, battery: number, flicker: number) {
  if (battery > 0.28 && flicker > 0.25) return;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${battery <= 0.02 ? 0.62 : (1 - flicker) * 0.35})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawPoly(ctx: CanvasRenderingContext2D, points: Vec2[], alpha: number) {
  if (points.length < 3) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
}
