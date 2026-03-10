FROM node:18-slim

RUN apt-get update && \
    apt-get install -y gnupg curl && \
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
      gpg --dearmor -o /etc/apt/keyrings/mongodb-server-7.0.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/mongodb-server-7.0.gpg] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" \
      > /etc/apt/sources.list.d/mongodb-org-7.0.list && \
    apt-get update && \
    apt-get install -y mongodb-org-server && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data/db

WORKDIR /opt/application
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ .
RUN chmod +x run.sh
EXPOSE 8000
CMD ["sh", "run.sh"]
