#!/bin/sh
# 如果没有配置外部 MONGO_URI，就启动本地 MongoDB
if [ -z "$MONGO_URI" ]; then
  echo "[run.sh] Starting local MongoDB..."
  mongod --dbpath /data/db --fork --logpath /var/log/mongod.log --bind_ip 127.0.0.1
  export MONGO_URI="mongodb://127.0.0.1:27017/lingchong"
fi

cd /opt/application
node app.js
