FROM node:18-bookworm-slim

WORKDIR /usr/src/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
COPY . .

RUN npx prisma generate

EXPOSE 5000
CMD ["npm", "start"]
