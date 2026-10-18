FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
