# Operations & Incident Response Runbook

## 1. Overview & Operational Responsibilities

This runbook defines standard operational procedures, routine maintenance tasks, and incident response playbooks for the **Utility + Ad Platform**.

- **Target Audience**: Site Reliability Engineers (SREs), DevOps Engineers, and On-Call Backend Engineers.
- **Primary Objectives**: Maximize service availability (99.9% uptime target), preserve zero data loss, and maintain response latencies < 50ms for public tool routes.

---

## 2. Standard Deployment Procedure

### Pre-Deployment Checklist
1. All automated CI checks pass on `.github/workflows/ci.yml`.
2. Regression test suite passes 100% (minimum 170 passing tests).
3. Zero unresolved migration conflicts in Prisma history.
4. `OPENAI_API_KEY` is confirmed absent from deployment manifests and secrets.

### Production Release Sequence
```bash
# 1. Pull latest verified container images or build artifacts
docker compose -f docker-compose.prod.yml pull

# 2. Execute pending database migrations BEFORE switching application traffic
docker compose -f docker-compose.prod.yml run --rm backend pnpm --filter @ad-utility/backend prisma:deploy

# 3. Perform rolling restart of backend instances
docker compose -f docker-compose.prod.yml up -d --no-deps backend

# 4. Await readiness probe confirmation (HTTP 200)
curl -sf http://localhost:4000/api/v1/health/readiness || exit 1

# 5. Perform rolling restart of frontend instances
docker compose -f docker-compose.prod.yml up -d --no-deps frontend

# 6. Verify end-to-end edge connectivity
curl -sf http://localhost:3000/ || exit 1
```

---

## 3. Database Migration Procedures

### Running Migrations in Production
Never run `prisma db push` or `prisma migrate dev` in staging or production.
Always use `prisma:deploy`:

```bash
# Inside container or host environment with DATABASE_URL configured:
pnpm --filter @ad-utility/backend prisma:deploy
```

### Inspecting Migration Status
```bash
npx prisma migrate status
```

Expected output:
```text
Database schema is up to date!
```

---

## 4. Database Backup & Restore Procedures

### Automated Daily / Hourly Backups
The automated backup scripts generate timestamped, gzip-compressed SQL dumps containing table schema, constraints, and table records.

#### Linux / POSIX:
```bash
# Run backup to default ./backups directory
./scripts/backup-db.sh

# Or specify custom backup target directory
./scripts/backup-db.sh /var/backups/ad-utility
```

#### Windows PowerShell:
```powershell
# Run backup to ./backups directory
powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1

# Custom output directory
powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1 -OutputDir "D:\Backups\ad-utility"
```

### Database Restore Procedure (Disaster Recovery)

> [!CAUTION]
> Restoring a database drops the target database and recreates it from the dump file. Ensure correct database credentials and names are provided.

#### Linux / POSIX:
```bash
# Restore specific backup file into target database
./scripts/restore-db.sh ./backups/ad_utility_backup_20260908_134500.sql.gz ad_utility_db
```

#### Windows PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-db.ps1 `
  -BackupFile "backups\ad_utility_backup_20260908_134500.sql.gz" `
  -TargetDb "ad_utility_db"
```

### Post-Restore Verification Checklist
Verify row counts across key operational tables:
```sql
SELECT 'utilities' as table_name, count(*) FROM "Utility"
UNION ALL
SELECT 'users', count(*) FROM "User"
UNION ALL
SELECT 'categories', count(*) FROM "Category"
UNION ALL
SELECT 'campaigns', count(*) FROM "Campaign"
UNION ALL
SELECT 'creatives', count(*) FROM "Creative";
```

---

## 5. Emergency Rollback Procedures

### Scenario: Broken Release / Fatal Regression
If a new release causes unhandled 500 errors, broken utility pipelines, or ad serving failures:

1. **Rollback Container Images Immediately**:
   ```bash
   # Re-tag previous known stable container image
   docker tag ad-utility-backend:previous ad-utility-backend:latest
   docker tag ad-utility-frontend:previous ad-utility-frontend:latest
   
   # Restart services with stable image
   docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
   ```
2. **Rollback Database Migration (If Applicable)**:
   - If the migration added backward-compatible columns/tables, DO NOT roll back the database schema immediately.
   - If a breaking schema change was deployed, restore the pre-deployment database backup using `scripts/restore-db.*`.

---

## 6. Incident Response & Triaging Playbooks

### Incident Playbook A: Backend Unhealthy (Readiness Fails with 503)
**Symptom**: `GET /api/v1/health/readiness` returns 503 Service Unavailable, ingress removes backend from pool.

1. Check liveness probe:
   ```bash
   curl -i http://localhost:4000/api/v1/health/liveness
   ```
   - If liveness returns 200, the Node.js process is alive, but PostgreSQL is unreachable.
2. Verify PostgreSQL container health:
   ```bash
   docker ps --filter "name=ad_utility_postgres"
   docker logs --tail 50 ad_utility_postgres
   ```
3. Check PostgreSQL connection limits:
   ```bash
   docker exec -it ad_utility_postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
   ```
4. If connection pool exhausted, restart backend to cleanly release Prisma client pool connections:
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```

---

### Incident Playbook B: Redis Memory Exhaustion (OOM)
**Symptom**: Utilities fallback to database reads; logs indicate Redis memory limit reached.

1. Inspect Redis memory usage:
   ```bash
   docker exec -it ad_utility_redis redis-cli info memory
   ```
2. Verify Redis eviction policy is set to `volatile-lru`:
   ```bash
   docker exec -it ad_utility_redis redis-cli config get maxmemory-policy
   ```
3. Flush expired or non-critical cache keys:
   ```bash
   docker exec -it ad_utility_redis redis-cli -n 0 keys "cat:*" | xargs -r docker exec -i ad_utility_redis redis-cli del
   ```
4. Confirm platform fail-open behavior: Utilities and Ads will continue serving directly from PostgreSQL without failing user requests.

---

### Incident Playbook C: Ad Delivery Latency Spike
**Symptom**: Ad delivery latency exceeds 50ms, slowing page load.

1. Inspect active campaign count in database:
   ```bash
   docker exec -it ad_utility_postgres psql -U postgres -d ad_utility_db -c "SELECT count(*) FROM \"Campaign\" WHERE \"status\" = 'ACTIVE';"
   ```
2. Test ad delivery endpoint directly with timing:
   ```bash
   curl -w "@scripts/curl-format.txt" -o /dev/null -s "http://localhost:4000/api/v1/ad-engine/deliver?slotType=BANNER_TOP&placement=TOOL_PAGE"
   ```
3. If Redis connection dropped, check Redis container latency.

---

## 7. Request Tracing with `X-Request-Id`

Every HTTP request handled by the NestJS backend includes a unique correlation ID.

### Locating an Incident by Request ID
1. When a user or frontend reports an error with Request ID `976a3130-50c9-473b-8101-100c9a5c1ef4`:
2. Search backend logs:
   ```bash
   docker logs ad_utility_backend 2>&1 | grep "976a3130-50c9-473b-8101-100c9a5c1ef4"
   ```
3. The correlated logs trace the entire request journey: DTO validation -> Auth -> Adapter execution -> Database queries.

---

## 8. Probe Troubleshooting Summary

| Probe Endpoint | Expected Status | Root Cause on Failure | Immediate Remedy |
| :--- | :--- | :--- | :--- |
| `GET /api/v1/health` | 200 OK | Process crashed or frozen event loop | Restart backend container |
| `GET /api/v1/health/liveness` | 200 OK | Event loop deadlock or memory leak | Inspect heap memory; restart container |
| `GET /api/v1/health/readiness` | 200 OK | Database network disconnect / auth error | Verify `DATABASE_URL` and Postgres container |
| `GET /` (Frontend) | 200 OK | Node SSR build error or upstream timeout | Inspect frontend logs; verify `NEXT_PUBLIC_API_URL` |
