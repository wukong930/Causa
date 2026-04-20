#!/bin/sh
set -e

# Auto-run database migrations on startup
# Uses raw SQL files since drizzle-kit is not available in standalone build
if [ -d "/app/drizzle" ] && [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Checking database migrations..."

  # Parse DATABASE_URL: postgresql://user:pass@host:port/dbname
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
  DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

  # Wait for postgres to be ready
  for i in $(seq 1 30); do
    if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
      break
    fi
    echo "[entrypoint] Waiting for database... ($i/30)"
    sleep 2
  done

  # Check if tables exist (use alerts as canary)
  TABLE_EXISTS=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alerts')" 2>/dev/null || echo "f")

  if [ "$TABLE_EXISTS" = "f" ]; then
    echo "[entrypoint] Tables not found, running migrations..."
    for f in /app/drizzle/*.sql; do
      echo "[entrypoint] Applying $(basename "$f")..."
      PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" 2>&1 || true
    done
    echo "[entrypoint] Migrations complete."
  else
    echo "[entrypoint] Tables already exist, skipping migrations."
  fi
fi

# Start the application
exec node server.js
