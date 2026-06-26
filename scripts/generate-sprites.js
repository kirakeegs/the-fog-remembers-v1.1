/**
 * Sprite 图集生成脚本
 *
 * 调用 gpt-image-2 生成玩家、怪物、道具的 PNG 图集
 * 按 SPRITE_UPGRADE.md 规范自动保存到 public/assets/
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.IMAGE_GEN_API_KEY;
const BASE_URL = process.env.IMAGE_GEN_BASE_URL;
const MODEL = process.env.IMAGE_GEN_MODEL;

if (!API_KEY || !BASE_URL || !MODEL) {
  console.error('❌ 缺少环境变量配置，请检查 .env.local');
  process.exit(1);
}

// 生图任务定义
const SPRITE_TASKS = [
  {
    name: 'player-walk',
    category: 'characters',
    prompt: `2D top-down pixel art sprite sheet, 4-direction walking animation.
Subject: A lone survivor in a raincoat holding a weak flashlight, seen from back/side/front views.
Style: Low-saturation psychological horror, minimalist silhouette style, foggy harbor town aesthetic.
Layout: 256×256 sprite sheet, 4 columns × 4 rows (each frame 64×64 pixels):
  - Row 1: Walking down (4 frames loop)
  - Row 2: Walking up (4 frames loop)
  - Row 3: Walking left (4 frames loop)
  - Row 4: Walking right (4 frames loop)
Colors: Warm yellow flashlight glow, gray raincoat, low-saturation background.
Technical: Clean pixel grid alignment, consistent frame size, transparent background where possible.
Forbidden: No copyrighted characters, no franchise logos, no text.`,
    size: '256x256',
  },
  {
    name: 'wanderer-anim',
    category: 'monsters',
    prompt: `2D top-down pixel art sprite sheet, monster animation.
Subject: Wanderer - a standard threat, symbolizing ignored witnesses, shadowy humanoid figure.
Style: Distorted silhouette, low-saturation gray tones, blurred edges, psychological horror.
Layout: 224×128 sprite sheet, 4 columns × 2 rows (each frame 56×64 pixels):
  - Row 1: Wandering state (4 frames loop, slow floating motion)
  - Row 2: Chase state (4 frames loop, aggressive lunge)
Colors: Gray main body, red aura (when chasing), semi-transparent edges.
Technical: Clean pixel grid, consistent frame size, transparent background.
Forbidden: No copyrighted horror monsters, no franchise references, no text.`,
    size: '256x256',
  },
  {
    name: 'battery',
    category: 'items',
    prompt: `2D UI icon, single static image.
Subject: A small battery icon for a horror survival game, recognizable battery shape.
Style: Low-saturation harbor town aesthetic, simple and identifiable design.
Size: 64×64 pixels, clean pixel art or minimalist vector style.
Colors: Cold blue glow (120, 220, 255), dark casing,符合心理恐怖氛围.
Background: Transparent PNG.
Forbidden: No brand logos, no copyrighted designs, no text.`,
    size: '64x64',
  },
  {
    name: 'potion',
    category: 'items',
    prompt: `2D UI icon, single static image.
Subject: A small potion vial/bottle icon for a horror survival game, glass bottle with red liquid.
Style: Low-saturation harbor town aesthetic, simple and identifiable design.
Size: 64×64 pixels, clean pixel art or minimalist style.
Colors: Dark glass bottle, crimson red liquid (224, 71, 96), warm cork stopper.
Background: Transparent PNG.
Forbidden: No brand logos, no copyrighted designs, no text.`,
    size: '64x64',
  },
  {
    name: 'crucifix',
    category: 'items',
    prompt: `2D UI icon, single static image.
Subject: A simple cross/crucifix icon for a horror survival game, worn and weathered appearance.
Style: Low-saturation harbor town aesthetic, simple and identifiable design.
Size: 64×64 pixels, clean pixel art or minimalist style.
Colors: Aged bone white (232, 226, 196), warm glow, subtle rust stains.
Background: Transparent PNG.
Forbidden: No trademarked religious symbols, no copyrighted designs, no text.`,
    size: '64x64',
  },
];

/**
 * 调用生图 API
 */
async function generateImage(prompt, size = '1024x1024') {
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
              reject(new Error('API 返回格式异常: ' + data));
            }
          } catch (e) {
            reject(new Error('解析 API 响应失败: ' + e.message));
          }
        } else {
          reject(new Error(`API 返回错误 ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 下载图片到本地
 */
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

/**
 * 主流程
 */
async function main() {
  console.log('🎨 开始生成 Sprite 图集...\n');

  // 确保目录存在
  const assetsDir = path.join(__dirname, '..', 'public', 'assets');
  ['characters', 'monsters', 'items'].forEach(dir => {
    const fullPath = path.join(assetsDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  for (const task of SPRITE_TASKS) {
    console.log(`📦 生成 ${task.category}/${task.name}.png...`);
    try {
      console.log(`   调用 API (${task.size})...`);
      const imageUrl = await generateImage(task.prompt, task.size);

      console.log(`   下载图片...`);
      const filepath = path.join(assetsDir, task.category, `${task.name}.png`);
      await downloadImage(imageUrl, filepath);

      console.log(`   ✅ 已保存到 public/assets/${task.category}/${task.name}.png\n`);
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}\n`);
    }

    // 避免 API 限流
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('🎉 图集生成完成！');
  console.log('\n📋 后续步骤:');
  console.log('   1. 运行 npm run dev 启动项目');
  console.log('   2. 查看游戏内效果（图集加载后会自动替换圆圈）');
  console.log('   3. 如果效果不满意，可以调整提示词重新生成');
}

main().catch(err => {
  console.error('💥 脚本执行失败:', err);
  process.exit(1);
});
