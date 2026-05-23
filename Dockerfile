FROM node:24-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY server/ocr/requirements.txt ./server/ocr/requirements.txt
RUN python3 -m pip install --break-system-packages -r server/ocr/requirements.txt

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
ENV PYTHON_BIN=python3
ENV SQLITE_DB_PATH=/app/data/app.db

EXPOSE 3001

CMD ["npm", "start"]
