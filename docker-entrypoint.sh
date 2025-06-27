#!/usr/bin/env sh
set -e

echo "⏳ Waiting for database $DB_HOST:$DB_PORT..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; do
  sleep 2
done
echo "✅ Database is ready"

echo "⚙️  Running migrations..."
npx sequelize-cli db:migrate --env ${NODE_ENV:-development}
echo "🌱 Running seeders..."
npx sequelize-cli db:seed:all --env ${NODE_ENV:-development}

echo "🚀 Starting application..."
exec "$@"
