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
