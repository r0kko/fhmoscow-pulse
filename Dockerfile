############################
# 1️⃣ Build & verify stage #
############################
FROM node:24-alpine AS build
WORKDIR /usr/src/app

COPY package*.json ./
COPY packages ./packages

RUN npm ci

COPY . .

RUN npm run lint

###########################
# 2️⃣  Production stage   #
###########################
FROM node:24-alpine AS prod

RUN apk add --no-cache postgresql-client && npm install -g npm

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/. .

USER node

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "bin/www"]
