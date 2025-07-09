############################
# 1️⃣ Build stage          #
############################
FROM node:24-alpine AS build
WORKDIR /usr/src/app

ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

# Install build deps for optional native addons (rollup, esbuild, etc.)
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build Vite production bundle
COPY . .
RUN npm run build

############################
# 2️⃣ Production stage     #
############################
FROM node:24-alpine AS prod
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/vite.config.* ./
# Copy only runtime files
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4173
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
