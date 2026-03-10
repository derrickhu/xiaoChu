FROM mongo:7.0 AS mongo-bin

FROM node:18-slim
COPY --from=mongo-bin /usr/bin/mongod /usr/bin/mongod
RUN apt-get update && apt-get install -y --no-install-recommends libcurl4 libssl3 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /data/db

WORKDIR /opt/application
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ .
RUN chmod +x run.sh
EXPOSE 8000
CMD ["sh", "run.sh"]
