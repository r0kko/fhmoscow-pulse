############################
# 1️⃣ Build & verify stage #
############################
FROM node:24.12.0-alpine3.23 AS build
WORKDIR /usr/src/app

COPY package*.json ./
COPY packages ./packages

RUN npm ci
RUN npm ls sharp pdf-lib archiver@8.0.0 pdfkit@0.18.0 pdfkit-table@0.2.11 --depth=0

COPY . .

RUN node scripts/verifyRuntimeDependencies.mjs
RUN npm run lint
RUN npm prune --omit=dev

###########################
# 2️⃣  Production stage   #
###########################
FROM node:24.12.0-alpine3.23 AS prod

RUN apk add --no-cache postgresql-client

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/.sequelizerc ./.sequelizerc
COPY --from=build /usr/src/app/app.js ./app.js
COPY --from=build /usr/src/app/logger.js ./logger.js
COPY --from=build /usr/src/app/assets ./assets
COPY --from=build /usr/src/app/bin ./bin
COPY --from=build /usr/src/app/packages ./packages
COPY --from=build /usr/src/app/scripts ./scripts
COPY --from=build /usr/src/app/src ./src

RUN chown -R node:node /usr/src/app && chmod -R u=rwX,go=rX /usr/src/app
RUN node scripts/verifyRuntimeDependencies.mjs

USER node

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "bin/www"]
