/**
 * 单独生成玩家图集（处理超时问题）
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.IMAGE_GEN_API_KEY;
const BASE_URL = process.env.IMAGE_GEN_BASE_URL;
const MODEL = process.env.IMAGE_GEN_MODEL;

const task = {
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
};

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

async function main() {
  console.log('🎨 生成玩家图集...\n');

  const assetsDir = path.join(__dirname, '..', 'public', 'assets');
  const fullPath = path.join(assetsDir, 'characters');
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  console.log(`📦 生成 ${task.category}/${task.name}.png...`);
  try {
    console.log(`   调用 API (${task.size})...`);
    const imageUrl = await generateImage(task.prompt, task.size);

    console.log(`   下载图片...`);
    const filepath = path.join(assetsDir, task.category, `${task.name}.png`);
    await downloadImage(imageUrl, filepath);

    console.log(`   ✅ 已保存到 public/assets/${task.category}/${task.name}.png\n`);
    console.log('🎉 玩家图集生成完成！');
  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('💥 脚本执行失败:', err);
  process.exit(1);
});
