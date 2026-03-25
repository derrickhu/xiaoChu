#!/bin/bash
# 一键导出 + 分析
# 用法: bash export.sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "===== 1/2 导出云数据库 ====="
node export_wx.js
if [ $? -ne 0 ]; then
  echo "导出失败，终止"
  exit 1
fi

echo ""
echo "===== 2/2 运行数据分析 ====="
python analyze.py

echo ""
echo "===== 全部完成 ====="
echo "图表在 output/ 目录下"
echo "最高层玩家完整存档: output/top_floor_players_detail.json（终端内亦有摘要）"
echo "本地最高层榜(全量): output/local_floor_leaderboard.json"
echo "留存可行性说明 + 最后同步日分布: output/last_sync_by_day.json"
echo "排行与存档交叉: output/rank_player_cross.json"
echo "新增图表: 8_rank_cross / 9_saved_run / 10_idle_stamina / 11_avatar_sidebar_team"
