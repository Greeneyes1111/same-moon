# Image for the "web" and "studio" services. Small and quick to start:
# no ffmpeg, production dependencies only.
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY shared ./shared
COPY stories ./stories
COPY covers ./covers
COPY jobs ./jobs
COPY services ./services
USER node
EXPOSE 8080
CMD ["node", "services/web/server.js"]
