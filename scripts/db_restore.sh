#!/bin/bash
# scripts/db_restore.sh
# Restore a PostgreSQL SQL dump into the active db container

if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_backup_file.sql>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file $BACKUP_FILE does not exist."
  exit 1
fi

echo "Restoring database from $BACKUP_FILE into sentinelai_db..."
docker exec -i sentinelai_db psql -U postgres -d sentinelai < "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Restore completed successfully."
else
  echo "Restore FAILED!"
  exit 1
fi
