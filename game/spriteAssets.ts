/**
 * Sprite 资源定义
 *
 * 按 ASSET_PIPELINE.md 规范组织：
 * - characters/ 存放玩家、幸存者
 * - monsters/ 存放 5 种怪物
 * - items/ 存放道具
 *
 * 如果资源尚未生成，引擎会回退到原有圆圈绘制
 */

import {
  createGridSpriteSheet,
  createSingleFrameSheet,
  SpriteManager,
} from "./sprite";

export const spriteManager = new SpriteManager();

// ========== 玩家 ==========
// 假定玩家图集为 4 方向 × 4 帧行走动画 (64x64 每帧)
spriteManager.register(
  "player",
  createGridSpriteSheet(
    "/assets/characters/player-walk.png",
    64,
    64,
    4,
    4,
    [
      { name: "idle", frames: [0], fps: 1, loop: true },
      { name: "walk-down", frames: [0, 1, 2, 3], fps: 8, loop: true },
      { name: "walk-up", frames: [4, 5, 6, 7], fps: 8, loop: true },
      { name: "walk-left", frames: [8, 9, 10, 11], fps: 8, loop: true },
      { name: "walk-right", frames: [12, 13, 14, 15], fps: 8, loop: true },
    ]
  )
);

// ========== 幸存者 ==========
spriteManager.register(
  "survivor",
  createSingleFrameSheet("/assets/characters/character-rescued-survivor.png", ["idle", "rescued"])
);

// ========== 怪物 ==========
// 游荡者
spriteManager.register(
  "monster-wanderer",
  createGridSpriteSheet(
    "/assets/monsters/wanderer-anim.png",
    56,
    64,
    4,
    2,
    [
      { name: "wander", frames: [0, 1, 2, 3], fps: 4, loop: true },
      { name: "chase", frames: [4, 5, 6, 7], fps: 8, loop: true },
    ]
  )
);

// 追猎者
spriteManager.register(
  "monster-stalker",
  createSingleFrameSheet("/assets/monsters/monster-stalker.png", ["wander", "chase"])
);

// 聆听者
spriteManager.register(
  "monster-listener",
  createSingleFrameSheet("/assets/monsters/monster-listener.png", ["wander", "chase"])
);

// 残暴者
spriteManager.register(
  "monster-brute",
  createSingleFrameSheet("/assets/monsters/monster-brute.png", ["wander", "chase"])
);

// 匍匐者
spriteManager.register(
  "monster-crawler",
  createSingleFrameSheet("/assets/monsters/monster-crawler.png", ["wander", "chase"])
);

// ========== 道具 ==========
spriteManager.register("item-battery", createSingleFrameSheet("/assets/items/battery.png"));
spriteManager.register("item-potion", createSingleFrameSheet("/assets/items/potion.png"));
spriteManager.register("item-crucifix", createSingleFrameSheet("/assets/items/crucifix.png"));
spriteManager.register("item-clue", createSingleFrameSheet("/assets/items/item-clue-note.png"));

// ========== 仪式点与证物 ==========
spriteManager.register(
  "sigil",
  createSingleFrameSheet("/assets/ui/recall-sigil.png", ["inactive", "active"])
);

// ========== 新增道具（道具系统重做） ==========
// 灰烬
spriteManager.register("item-ash", createSingleFrameSheet("/assets/items/item-clue-note.png"));
// 收音机
spriteManager.register("item-radio", createSingleFrameSheet("/assets/items/item-crucifix-relic.png"));
// 水纹追踪器
spriteManager.register("item-ripple-tracker", createSingleFrameSheet("/assets/items/item-battery.png"));
