FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm install

COPY backend/ ./backend/
COPY frontend/ ./frontend/

RUN npm run build -w frontend
RUN npm run build -w backend

# ---

FROM node:20-alpine AS runtime

RUN apk add --no-cache su-exec

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm install --omit=dev -w backend

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist

ENV PORT=3001
ENV PUID=99
ENV PGID=100

EXPOSE 3001

CMD su-exec ${PUID}:${PGID} node backend/dist/index.js
