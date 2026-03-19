#!/bin/bash
# 音效 WAV→MP3 96kbps，BGM MP3→128kbps
# 依赖: brew install ffmpeg

set -e
cd "$(dirname "$0")/.."

if ! command -v ffmpeg &>/dev/null; then
  echo "请先安装 ffmpeg: brew install ffmpeg"
  exit 1
fi

AUDIO="audio"
BGM="audio_bgm"
BACKUP_SUFFIX=".bak"

# 音效 WAV → MP3 96kbps
for f in "$AUDIO"/*.wav; do
  [ -f "$f" ] || continue
  base="${f%.wav}"
  echo "  $f -> ${base}.mp3"
  ffmpeg -y -i "$f" -codec:a libmp3lame -b:a 96k -ac 1 -ar 44100 "${base}.mp3" 2>/dev/null
  rm "$f"
done

# BGM 重新编码为 128kbps
for f in "$BGM"/bgm.mp3 "$BGM"/boss_bgm.mp3; do
  [ -f "$f" ] || continue
  echo "  $f (128kbps)"
  ffmpeg -y -i "$f" -codec:a libmp3lame -b:a 128k -ac 1 -ar 44100 "${f}.tmp" 2>/dev/null
  mv "${f}.tmp" "$f"
done

# 更新 music.js 中的 .wav 引用为 .mp3
if [ -f "js/runtime/music.js" ]; then
  sed -i.bak "s/\.wav/.mp3/g" js/runtime/music.js && rm -f js/runtime/music.js.bak
  echo "  已更新 js/runtime/music.js"
fi
echo "Done."
