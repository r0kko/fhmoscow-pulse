############################
# 1️⃣ Build & verify stage #
############################
FROM node:latest AS build
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run lint

###########################
# 2️⃣  Production stage   #
###########################
FROM node:latest AS prod

RUN apt-get update &&  apt-get upgrade -y && npm install -g npm && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/. .

USER node

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "bin/www"]
