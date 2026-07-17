#!/bin/bash
# scripts/db_backup.sh
# Automate PostgreSQL backups from the container

BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

BACKUP_FILE="$BACKUP_DIR/sentinelai_backup_$(date +%Y%m%d_%H%M%S).sql"

echo "Creating database backup from container sentinelai_db..."
docker exec sentinelai_db pg_dump -U postgres sentinelai > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Backup successfully written to $BACKUP_FILE"
  # Keep only last 7 days of backups
  find $BACKUP_DIR -name "sentinelai_backup_*.sql" -mtime +7 -delete
else
  echo "Database backup FAILED!"
  exit 1
fi
