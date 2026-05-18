#!/usr/bin/env sh
set -e

if [ "${NODE_ENV:-development}" != "production" ]; then
  echo "🔎 Checking runtime dependencies..."
  if ! npm ls sharp pdf-lib archiver@8.0.0 pdfkit@0.18.0 pdfkit-table@0.2.11 --depth=0 > /dev/null 2>&1; then
    echo "📦 Installing missing dependencies in dev container..."
    npm ci
  fi
fi

echo "🔎 Verifying runtime dependency versions..."
node scripts/verifyRuntimeDependencies.mjs

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
