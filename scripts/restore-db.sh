#!/usr/bin/env bash
# ==============================================================================
# Database Restore Script for Utility + Ad Platform (PostgreSQL)
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path_to_backup_file.sql> [target_database_name]"
  exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-${POSTGRES_DB:-ad_utility_db}}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' does not exist."
  exit 1
fi

echo "================================================================="
echo " Starting Database Restore"
echo " Source File: ${BACKUP_FILE}"
echo " Target DB: ${TARGET_DB}"
echo " Host: ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "================================================================="

psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${TARGET_DB}" \
  -v ON_ERROR_STOP=1 \
  -f "${BACKUP_FILE}"

echo "================================================================="
echo " Database restoration completed successfully into ${TARGET_DB}!"
echo "================================================================="
