/**
 * 优化版生图脚本 - 逐个生成，强化提示词
 *
 * 改进点:
 * 1. 强调像素风格和图集布局
 * 2. 要求优化文件大小
 * 3. 每次只生成一个，避免批量超时
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.IMAGE_GEN_API_KEY;
const BASE_URL = process.env.IMAGE_GEN_BASE_URL;
const MODEL = process.env.IMAGE_GEN_MODEL;

// 优化后的生图任务
const TASKS = {
  'player-walk': {
    category: 'characters',
    prompt: `STRICT REQUIREMENTS: Must be a sprite sheet with exactly 4 columns and 4 rows in a perfect grid.

2D top-down retro pixel art sprite sheet, 8-bit style with crisp pixel edges.
Subject: A small survivor figure in dark raincoat holding a tiny flashlight, minimalist silhouette.
Layout: 256×256 image, MUST contain a 4×4 grid (16 frames total), each frame exactly 64×64 pixels:
  - Row 1: Walk down (frames 0-3)
  - Row 2: Walk up (frames 4-7)
  - Row 3: Walk left (frames 8-11)
  - Row 4: Walk right (frames 12-15)
Style: Retro pixel art, NOT high-resolution illustration. Low-saturation horror, foggy harbor town.
Colors: Warm yellow flashlight (small dot), gray raincoat, dark background.
Technical: Clean pixel grid alignment, NO anti-aliasing blur, sharp pixel edges, optimized for web, low file size.
Background: Dark gray or transparent.
Forbidden: No detailed realistic art, no copyrighted characters, no text, no logos.`,
    size: '256x256',
  },
  'stalker-anim': {
    category: 'monsters',
    prompt: `STRICT REQUIREMENTS: Must be a sprite sheet with exactly 4 columns and 2 rows in a perfect grid.

2D top-down retro pixel art sprite sheet, 8-bit horror style.
Subject: Stalker monster - thin elongated shadowy figure with red glowing eyes, aggressive pose.
Layout: 256×144 image, MUST contain a 4×2 grid (8 frames total), each frame exactly 64×72 pixels:
  - Row 1: Wander state (frames 0-3, slow drift)
  - Row 2: Chase state (frames 4-7, fast lunge)
Style: Retro pixel art, distorted silhouette, low-saturation gray and red tones.
Colors: Dark gray body, red glowing eyes, crimson aura when chasing.
Technical: Clean pixel grid, sharp edges, optimized for web, low file size.
Background: Transparent or dark.
Forbidden: No realistic art, no copyrighted monsters, no text.`,
    size: '256x256',
  },
  'listener-anim': {
    category: 'monsters',
    prompt: `STRICT REQUIREMENTS: Must be a sprite sheet with exactly 4 columns and 2 rows in a perfect grid.

2D top-down retro pixel art sprite sheet, 8-bit horror style.
Subject: Listener monster - eyeless bulky figure with large ear-like appendages, sensing pose.
Layout: 288×128 image, MUST contain a 4×2 grid (8 frames), each frame exactly 72×64 pixels:
  - Row 1: Wander state (frames 0-3, subtle pulse)
  - Row 2: Chase state (frames 4-7, aggressive expansion)
Style: Retro pixel art, no eyes visible, large ear shapes, low-saturation horror.
Colors: Pale gray body, darker ear shapes, yellow-green aura when active.
Technical: Clean pixel grid, sharp edges, optimized for web, low file size.
Background: Transparent or dark.
Forbidden: No realistic art, no copyrighted monsters, no text.`,
    size: '256x256',
  },
  'brute-anim': {
    category: 'monsters',
    prompt: `STRICT REQUIREMENTS: Must be a sprite sheet with exactly 4 columns and 2 rows in a perfect grid.

2D top-down retro pixel art sprite sheet, 8-bit horror style.
Subject: Brute monster - massive hulking figure, single large eye, slow heavy movement.
Layout: 320×176 image, MUST contain a 4×2 grid (8 frames), each frame exactly 80×88 pixels:
  - Row 1: Wander state (frames 0-1 repeated, very slow sway)
  - Row 2: Chase state (frames 4-7, heavy stomp)
Style: Retro pixel art, brutish shape, single glowing eye, low-saturation horror.
Colors: Dark brown body, orange-red glowing eye, rust-colored aura.
Technical: Clean pixel grid, sharp edges, optimized for web, low file size.
Background: Transparent or dark.
Forbidden: No realistic art, no copyrighted monsters, no text.`,
    size: '512x512',
  },
  'crawler-anim': {
    category: 'monsters',
    prompt: `STRICT REQUIREMENTS: Must be a sprite sheet with exactly 4 columns and 2 rows in a perfect grid.

2D top-down retro pixel art sprite sheet, 8-bit horror style.
Subject: Crawler monster - low segmented body, multiple small eyes, rapid crawling motion.
Layout: 256×96 image, MUST contain a 4×2 grid (8 frames), each frame exactly 64×48 pixels:
  - Row 1: Wander state (frames 0-3, slow wriggle)
  - Row 2: Chase state (frames 4-7, fast scuttle)
Style: Retro pixel art, insect-like, segmented body, low-saturation horror.
Colors: Dark green body, pale green multiple eyes, murky aura.
Technical: Clean pixel grid, sharp edges, optimized for web, low file size.
Background: Transparent or dark.
Forbidden: No realistic art, no copyrighted monsters, no text.`,
    size: '256x256',
  },
  'survivor-idle': {
    category: 'characters',
    prompt: `STRICT REQUIREMENTS: Must be a sprite sheet with exactly 4 columns and 1 row in a perfect grid.

2D top-down retro pixel art sprite sheet, 8-bit style.
Subject: Survivor NPC - small human figure in worn clothes, standing idle pose.
Layout: 192×64 image, MUST contain a 4×1 grid (4 frames), each frame exactly 48×64 pixels:
  - All frames: Idle breathing animation (subtle movement)
Style: Retro pixel art, minimalist silhouette, low-saturation horror aesthetic.
Colors: Muted beige/brown clothes, pale skin tone, warm yellow glow around figure.
Technical: Clean pixel grid, sharp edges, optimized for web, low file size.
Background: Transparent or dark.
Forbidden: No realistic art, no copyrighted characters, no text.`,
    size: '256x256',
  },
  'clue': {
    category: 'items',
    prompt: `2D UI icon, retro pixel art style, 8-bit game asset.
Subject: A small paper note/document icon, folded corner, simple readable design.
Size: 64×64 pixels, clean pixel art.
Style: Low-saturation horror game aesthetic, minimalist.
Colors: Aged paper (245, 238, 200), dark text lines, warm glow.
Technical: Sharp pixel edges, optimized for web, low file size.
Background: Transparent PNG.
Forbidden: No realistic textures, no text content, no logos.`,
    size: '64x64',
  },
  'sigil-anim': {
    category: 'items',
    prompt: `STRICT REQUIREMENTS: Must be a sprite sheet with exactly 4 columns and 2 rows in a perfect grid.

2D retro pixel art sprite sheet, 8-bit occult symbol animation.
Subject: Ritual sigil symbol - hexagram star pattern with circle.
Layout: 384×192 image, MUST contain a 4×2 grid (8 frames), each frame exactly 96×96 pixels:
  - Row 1: Inactive state (frames 0-3, dim pulse)
  - Row 2: Active state (frames 4-7, bright glow)
Style: Retro pixel art, mystical symbol, low-saturation horror.
Colors: Row 1 dim gray, Row 2 purple-pink glow.
Technical: Clean pixel grid, sharp edges, optimized for web, low file size.
Background: Transparent or dark.
Forbidden: No realistic art, no copyrighted symbols, no text.`,
    size: '512x512',
  },
};

async function generateImage(prompt, size) {
  return new Promise((resolve, reject) => {
    const url = new URL('/v1/images/generations', BASE_URL);
    const postData = JSON.stringify({
      model: MODEL,
      prompt: prompt,
      n: 1,
      size: size,
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.data && json.data[0] && json.data[0].url) {
              resolve(json.data[0].url);
            } else {
              reject(new Error('API 返回格式异常'));
            }
          } catch (e) {
            reject(new Error('解析失败: ' + e.message));
          }
        } else {
          reject(new Error(`API 错误 ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function generateOne(taskName) {
  const task = TASKS[taskName];
  if (!task) {
    console.error(`❌ 未知任务: ${taskName}`);
    console.log(`\n可用任务: ${Object.keys(TASKS).join(', ')}`);
    return;
  }

  console.log(`🎨 生成 ${task.category}/${taskName}.png...`);
  console.log(`   尺寸: ${task.size}\n`);

  const assetsDir = path.join(__dirname, '..', 'public', 'assets');
  const categoryPath = path.join(assetsDir, task.category);
  if (!fs.existsSync(categoryPath)) {
    fs.mkdirSync(categoryPath, { recursive: true });
  }

  try {
    console.log(`   📡 调用 API...`);
    const imageUrl = await generateImage(task.prompt, task.size);

    console.log(`   📥 下载图片...`);
    const filepath = path.join(categoryPath, `${taskName}.png`);
    await downloadImage(imageUrl, filepath);

    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   ✅ 已保存到 public/assets/${task.category}/${taskName}.png (${sizeMB}MB)\n`);
    console.log(`🎉 完成！刷新 http://localhost:3000/sprite-preview.html 查看效果\n`);
  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}\n`);
  }
}

// 命令行参数
const taskName = process.argv[2];
if (!taskName) {
  console.log('📋 使用方法: node generate-one.js <task-name>\n');
  console.log('可用任务:');
  Object.keys(TASKS).forEach(name => {
    const task = TASKS[name];
    console.log(`  - ${name.padEnd(20)} (${task.category})`);
  });
  process.exit(0);
}

generateOne(taskName).catch(err => {
  console.error('💥 脚本执行失败:', err);
  process.exit(1);
});
