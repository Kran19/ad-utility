#!/usr/bin/env bash
# ==============================================================================
# Database Backup Script for Utility + Ad Platform (PostgreSQL)
# ==============================================================================
set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-ad_utility_db}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_backup_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "================================================================="
echo " Starting Database Backup: ${POSTGRES_DB}"
echo " Host: ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo " Destination: ${BACKUP_FILE}"
echo " Timestamp: $(date)"
echo "================================================================="

pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  --clean --if-exists --no-owner --no-privileges \
  -F p -f "${BACKUP_FILE}"

FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "================================================================="
echo " Backup successfully completed!"
echo " File: ${BACKUP_FILE} (Size: ${FILESIZE})"
echo "================================================================="
