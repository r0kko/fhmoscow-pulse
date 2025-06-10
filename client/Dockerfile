############################
# 1️⃣ Build stage          #
############################
FROM --platform=$BUILDPLATFORM node:20-slim AS build
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=optional

COPY . .
RUN npm run build

############################
# 2️⃣ Production stage     #
############################
FROM --platform=$TARGETPLATFORM node:20-slim AS prod
WORKDIR /usr/src/app

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4173
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
