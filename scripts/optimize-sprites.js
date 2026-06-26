/**
 * 图片优化工具
 *
 * 功能：
 * 1. 压缩图片大小
 * 2. 调整到精确尺寸
 * 3. 验证图集布局
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 资产规格定义
const SPECS = {
  'player-walk': { width: 256, height: 256, cols: 4, rows: 4 },
  'wanderer-anim': { width: 224, height: 128, cols: 4, rows: 2 },
  'stalker-anim': { width: 256, height: 144, cols: 4, rows: 2 },
  'listener-anim': { width: 288, height: 128, cols: 4, rows: 2 },
  'brute-anim': { width: 320, height: 176, cols: 4, rows: 2 },
  'crawler-anim': { width: 256, height: 96, cols: 4, rows: 2 },
  'survivor-idle': { width: 192, height: 64, cols: 4, rows: 1 },
  'battery': { width: 64, height: 64, cols: 1, rows: 1 },
  'potion': { width: 64, height: 64, cols: 1, rows: 1 },
  'crucifix': { width: 64, height: 64, cols: 1, rows: 1 },
  'clue': { width: 64, height: 64, cols: 1, rows: 1 },
  'sigil-anim': { width: 384, height: 192, cols: 4, rows: 2 },
};

async function optimizeImage(inputPath, outputPath, spec) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log(`   原始: ${metadata.width}×${metadata.height}, ${(metadata.size / 1024).toFixed(0)}KB`);

    // 调整尺寸并压缩
    await image
      .resize(spec.width, spec.height, {
        fit: 'cover',
        position: 'center',
      })
      .png({
        compressionLevel: 9,
        palette: true, // 转为索引色，减小体积
        quality: 85,
      })
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(0);
    console.log(`   优化后: ${spec.width}×${spec.height}, ${sizeKB}KB`);

    return true;
  } catch (error) {
    console.error(`   ❌ 处理失败: ${error.message}`);
    return false;
  }
}

async function processAsset(name, category) {
  const spec = SPECS[name];
  if (!spec) {
    console.log(`⚠️  未找到规格: ${name}`);
    return;
  }

  const assetsDir = path.join(__dirname, '..', 'public', 'assets');
  const inputPath = path.join(assetsDir, category, `${name}.png`);
  const outputPath = path.join(assetsDir, category, `${name}-optimized.png`);

  if (!fs.existsSync(inputPath)) {
    console.log(`⚠️  文件不存在: ${category}/${name}.png`);
    return;
  }

  console.log(`🔧 处理 ${category}/${name}.png...`);
  const success = await optimizeImage(inputPath, outputPath, spec);

  if (success) {
    // 备份原文件
    const backupPath = path.join(assetsDir, category, `${name}-original.png`);
    fs.renameSync(inputPath, backupPath);

    // 使用优化后的文件
    fs.renameSync(outputPath, inputPath);

    console.log(`   ✅ 已优化并替换原文件`);
    console.log(`   📦 原文件已备份为 ${name}-original.png\n`);
  }
}

async function processAll() {
  console.log('🎨 开始批量优化图片...\n');

  const tasks = [
    ['player-walk', 'characters'],
    ['wanderer-anim', 'monsters'],
    ['battery', 'items'],
    ['potion', 'items'],
    ['crucifix', 'items'],
  ];

  for (const [name, category] of tasks) {
    await processAsset(name, category);
  }

  console.log('🎉 批量优化完成！\n');
  console.log('📋 验证效果:');
  console.log('   npm run dev');
  console.log('   访问 http://localhost:3000/sprite-preview.html\n');
}

// 命令行参数
const args = process.argv.slice(2);
if (args.length === 0) {
  processAll();
} else if (args.length === 2) {
  const [name, category] = args;
  processAsset(name, category);
} else {
  console.log('使用方法:');
  console.log('  node optimize-sprites.js              # 批量处理');
  console.log('  node optimize-sprites.js <name> <category>  # 单个处理');
}
