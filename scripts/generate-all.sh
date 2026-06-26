#!/bin/bash
# 批量生成所有 Sprite 图集
# 每个任务间隔 3 秒，避免 API 限流

echo "🎨 开始批量生成 Sprite 图集..."
echo ""

tasks=(
  "player-walk"
  "stalker-anim"
  "listener-anim"
  "brute-anim"
  "crawler-anim"
  "survivor-idle"
  "clue"
  "sigil-anim"
)

for task in "${tasks[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  node scripts/generate-one.js "$task"

  if [ $? -eq 0 ]; then
    echo "✅ $task 完成"
  else
    echo "❌ $task 失败"
  fi

  echo ""
  echo "⏱️  等待 3 秒..."
  sleep 3
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 批量生成完成！"
echo ""
echo "📋 查看效果:"
echo "   npm run dev"
echo "   访问 http://localhost:3000/sprite-preview.html"
