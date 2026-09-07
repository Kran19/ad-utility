# Environment & Docker Configuration Guide

## 1. Overview
The platform runs inside Docker container orchestration (`docker-compose.yml`) containing:
- `backend`: NestJS REST API server (Host Port 4000, Internal Port 4000)
- `frontend`: Next.js web application (Host Port 3001, Internal Port 3000)
- `postgres`: PostgreSQL 16 database (Host Port 5432, Internal Port 5432)
- `redis`: Redis 7 cache/queue server (Host Port 6379, Internal Port 6379)

---

## 2. Docker Setup Steps
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Build and start containers in detached mode:
   ```bash
   docker compose up --build -d
   ```
3. Access applications:
   - Frontend: `http://localhost:3001`
   - Backend API: `http://localhost:4000/api/v1`
   - Healthcheck: `http://localhost:4000/api/v1/health`
