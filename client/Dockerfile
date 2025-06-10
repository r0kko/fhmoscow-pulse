############################
# 1️⃣ Build stage          #
############################
FROM node:latest AS build
WORKDIR /usr/src/app

# Install build deps for optional native addons (rollup, esbuild, etc.)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build Vite production bundle
COPY . .
RUN npm run build

############################
# 2️⃣ Production stage     #
############################
FROM node:latest AS prod
WORKDIR /usr/src/app

# Copy only runtime files
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4173
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
