# Dockerfile (for Express.js backend)
FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "server.ts"]