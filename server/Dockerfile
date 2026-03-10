FROM node:18-alpine
RUN apk add --no-cache mongodb
RUN mkdir -p /data/db
WORKDIR /opt/application
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ .
RUN chmod +x run.sh
EXPOSE 8000
CMD ["sh", "run.sh"]
