FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Leave empty when host nginx proxies /api on the same origin (see deploy/nginx-caremind.example.conf)
ARG VITE_API_BASE_URL=
ARG VITE_LIVEKIT_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL

RUN npm run build

FROM node:20-alpine AS production

RUN npm install -g serve@14.2.4

WORKDIR /app
COPY --from=builder /app/dist ./dist

EXPOSE 80

CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:80"]
