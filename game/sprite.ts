/**
 * Sprite 图集加载与动画系统
 * 支持单图集多帧切割、动画播放、翻转、速度控制
 */

export interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteAnimation {
  name: string;
  frames: number[];
  fps: number;
  loop: boolean;
}

export interface SpriteSheet {
  image: HTMLImageElement | null;
  frames: SpriteFrame[];
  animations: Map<string, SpriteAnimation>;
  loaded: boolean;
}

export class SpriteAnimator {
  private sheet: SpriteSheet;
  private currentAnim: string | null = null;
  private currentFrame = 0;
  private elapsed = 0;
  private flipX = false;
  private flipY = false;
  private speedMultiplier = 1;

  constructor(sheet: SpriteSheet) {
    this.sheet = sheet;
  }

  play(animName: string, reset = false) {
    if (this.currentAnim !== animName || reset) {
      this.currentAnim = animName;
      this.currentFrame = 0;
      this.elapsed = 0;
    }
  }

  setFlip(flipX: boolean, flipY = false) {
    this.flipX = flipX;
    this.flipY = flipY;
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = multiplier;
  }

  update(dt: number) {
    if (!this.currentAnim) return;
    const anim = this.sheet.animations.get(this.currentAnim);
    if (!anim || anim.frames.length === 0) return;

    this.elapsed += dt * this.speedMultiplier;
    const frameDuration = 1 / anim.fps;

    if (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration;
      this.currentFrame++;

      if (this.currentFrame >= anim.frames.length) {
        if (anim.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = anim.frames.length - 1;
        }
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale = 1,
    rotation = 0
  ) {
    if (!this.sheet.loaded || !this.sheet.image || !this.currentAnim) return;

    const anim = this.sheet.animations.get(this.currentAnim);
    if (!anim || anim.frames.length === 0) return;

    const frameIndex = anim.frames[this.currentFrame];
    const frame = this.sheet.frames[frameIndex];
    if (!frame) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(this.flipX ? -scale : scale, this.flipY ? -scale : scale);

    ctx.drawImage(
      this.sheet.image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      -frame.width / 2,
      -frame.height / 2,
      frame.width,
      frame.height
    );

    ctx.restore();
  }

  getCurrentFrameSize(): { width: number; height: number } | null {
    if (!this.currentAnim) return null;
    const anim = this.sheet.animations.get(this.currentAnim);
    if (!anim || anim.frames.length === 0) return null;
    const frameIndex = anim.frames[this.currentFrame];
    const frame = this.sheet.frames[frameIndex];
    return frame ? { width: frame.width, height: frame.height } : null;
  }

  isPlaying(): boolean {
    return this.currentAnim !== null;
  }

  hasAnimation(name: string): boolean {
    return this.sheet.animations.has(name);
  }
}

/**
 * 创建等宽等高帧切割的图集（适合逐帧动画）
 */
export function createGridSpriteSheet(
  imagePath: string,
  frameWidth: number,
  frameHeight: number,
  cols: number,
  rows: number,
  animations: { name: string; frames: number[]; fps: number; loop: boolean }[]
): SpriteSheet {
  const image = typeof Image === "undefined" ? null : new Image();
  const frames: SpriteFrame[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      frames.push({
        x: col * frameWidth,
        y: row * frameHeight,
        width: frameWidth,
        height: frameHeight,
      });
    }
  }

  const animMap = new Map<string, SpriteAnimation>();
  animations.forEach((a) => animMap.set(a.name, a));

  const sheet: SpriteSheet = {
    image,
    frames,
    animations: animMap,
    loaded: false,
  };

  if (image) {
    image.onload = () => {
      sheet.loaded = true;
    };
    image.src = imagePath;
  }

  return sheet;
}

/**
 * 创建单帧静态图集（适合道具/物品）
 */
export function createSingleFrameSheet(imagePath: string, animationNames: string[] = ["idle"]): SpriteSheet {
  const image = typeof Image === "undefined" ? null : new Image();

  const sheet: SpriteSheet = {
    image,
    frames: [],
    animations: new Map(),
    loaded: false,
  };

  if (image) {
    image.onload = () => {
      sheet.frames = [{ x: 0, y: 0, width: image.width, height: image.height }];
      for (const name of animationNames) {
        sheet.animations.set(name, { name, frames: [0], fps: 1, loop: true });
      }
      sheet.loaded = true;
    };
    image.src = imagePath;
  }

  return sheet;
}

/**
 * Sprite 资源管理器
 */
export class SpriteManager {
  private sheets = new Map<string, SpriteSheet>();

  register(key: string, sheet: SpriteSheet) {
    this.sheets.set(key, sheet);
  }

  get(key: string): SpriteSheet | undefined {
    return this.sheets.get(key);
  }

  createAnimator(key: string): SpriteAnimator | null {
    const sheet = this.sheets.get(key);
    return sheet ? new SpriteAnimator(sheet) : null;
  }

  allLoaded(): boolean {
    for (const sheet of this.sheets.values()) {
      if (!sheet.loaded) return false;
    }
    return true;
  }
}
