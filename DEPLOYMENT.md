# OJIX Property Intelligence - Production Deployment & Operations Runbook

This document defines the deployment engineering specifications, containerization architecture, zero-downtime release strategies, and disaster recovery procedures for **OJIX Property Intelligence**.

---

## 1. System Architecture & Topology

```mermaid
flowchart TD
    Client["Web Client / Due-Diligence Lawyer"] -->|HTTPS :443| Ingress["Nginx Reverse Proxy / Cloud Ingress"]
    
    subgraph "DMZ & Web Tier"
        Ingress -->|Static Assets / SPA Fallback| Web["ojix-web (Nginx 1.27 Alpine)"]
        Ingress -->|/api/*| API["ojix-api (Node.js 20/22 Alpine)"]
    end
    
    subgraph "Application Core"
        API --> TitleEngine["Title Chain & DAG Engine"]
        API --> SpatialEngine["Spatial Rules & Buffer Engine"]
        API --> DocExtractor["OCR & Document Intelligence"]
        API --> LegalEngine["Legal Research & Precedents"]
        API --> RegistryEngine["Source Registry Sync"]
    end
    
    subgraph "Data & Spatial Tier"
        API -->|TCP :5432| DB[("PostgreSQL 16/17 + PostGIS 3.6")]
        API -->|Uploads| Vol[("Encrypted Object Store / Local Volume")]
    end
```

---

## 2. Container Images & Multi-Stage Builds

### **`apps/api/Dockerfile` (Backend Service)**
- **Base**: `node:20-alpine`
- **Security**: Non-root execution under unprivileged `node` user (UID 1000).
- **Process Supervisor**: `dumb-init` for deterministic signal forwarding (`SIGTERM`/`SIGINT`) and zombie reaping.
- **Healthcheck**: In-container liveness probe against `http://localhost:4000/healthz`.
- **Image Size**: Optimized via `npm prune --production` to exclude TypeScript compiler and testing dependencies.

### **`apps/web/Dockerfile` (Frontend SPA & Reverse Proxy)**
- **Base**: `nginx:1.27-alpine`
- **Routing**: Client-side SPA routing fallback (`try_files $uri $uri/ /index.html`).
- **Security Headers**:
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **Performance**: Automated Gzip compression and 1-year immutable caching for `/assets/`.
- **API Proxying**: In containerized networks, proxies `/api/*` directly to `http://api:4000/api/`.

---

## 3. Local & Containerized Orchestration

### **Starting the Full Stack with Docker Compose**

```bash
# 1. Clone repository and navigate to root
cd ojix-property-intelligence

# 2. Build and launch all services in detached mode
docker compose up -d --build

# 3. Verify health status of all containers
docker compose ps
```

### **Service Ports & Endpoints**
| Service | Container Name | Port Mapping | Health Check Endpoint |
|---|---|---|---|
| **Web Frontend** | `ojix-web` | `http://localhost:8080` | `http://localhost:8080/healthz` |
| **REST API** | `ojix-api` | `http://localhost:4000` | `http://localhost:4000/healthz` |
| **PostGIS Database** | `ojix-db` | `localhost:5432` | `pg_isready -U ojix -d ojix_property` |

---

## 4. Observability & Health Probes

The API exposes standard Kubernetes-compatible observability endpoints:

### **Liveness Probe: `GET /healthz`**
- **Purpose**: Verifies that the HTTP process is responsive.
- **Response**: `200 OK` (`text/plain: OK`).
- **Kubernetes Spec**:
  ```yaml
  livenessProbe:
    httpGet:
      path: /healthz
      port: 4000
    initialDelaySeconds: 10
    periodSeconds: 15
    timeoutSeconds: 5
    failureThreshold: 3
  ```

### **Readiness Probe: `GET /readyz`**
- **Purpose**: Verifies that the database pool is connected and the PostGIS spatial engine is functional before routing client traffic.
- **Response**: `200 OK` (JSON):
  ```json
  {
    "status": "ready",
    "service": "ojix-property-api",
    "postgis": "3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1",
    "uptimeSeconds": 1420,
    "memoryUsage": { "rss": 65421312, "heapUsed": 19263472 },
    "timestamp": "2026-10-01T02:25:21.718Z"
  }
  ```
- **Kubernetes Spec**:
  ```yaml
  readinessProbe:
    httpGet:
      path: /readyz
      port: 4000
    initialDelaySeconds: 5
    periodSeconds: 10
    timeoutSeconds: 3
    failureThreshold: 2
  ```

---

## 5. Zero-Downtime Deployment Strategy

### **Database Schema Migrations**
All migrations in `infra/db/migrations/` follow the **Expand and Contract pattern**:
1. **Expand**: Add new nullable columns or tables with default values (e.g. `source_registry_verifications`, `legal_bookmarks`, `workspace_settings`).
2. **Deploy Application**: Roll out new API containers that write to both old and new structures.
3. **Contract**: Backfill existing rows and apply non-null constraints without locking tables.

```bash
# Applying schema migrations in production:
psql -h <DB_HOST> -p 5432 -U ojix -d ojix_property -f infra/db/migrations/003_registry_and_tools.sql
```

### **Rolling Update Workflow (Kubernetes / ECS)**
1. New container image is pushed to container registry (`ghcr.io/ojix/property-api:v0.2.0`).
2. Deployment controller creates Pods with the new version.
3. Readiness probe checks `GET /readyz` until PostGIS connection succeeds.
4. Traffic is routed to new Pods; old Pods receive `SIGTERM` and finish inflight HTTP requests (graceful drain timeout: 30s).

---

## 6. Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Execution environment (`production` or `development`) |
| `PORT` | Yes | `4000` | Port for the API server to bind |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (`postgres://user:pass@host:5432/db`) |
| `CORS_ORIGIN` | Yes | `http://localhost:5173` | Permitted browser origins (comma-separated) |
| `UPLOAD_DIR` | No | `./uploads` | Local filesystem path for uploaded deeds |
| `MAX_UPLOAD_MB` | No | `25` | Maximum upload size per evidence file |
| `FIREBASE_PROJECT_ID` | No | — | Optional Firebase project ID for production JWT auth |
| `GCS_BUCKET` | No | — | Optional Google Cloud Storage bucket for cloud persistence |

---

## 7. Disaster Recovery & Backup Runbook

### **Automated Nightly Database Backup**
```bash
#!/bin/bash
# Backup script: backup-ojix.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/ojix"
mkdir -p "$BACKUP_DIR"

# Dump PostGIS database with custom directory format
pg_dump -h localhost -p 5432 -U ojix -d ojix_property -F c -b -v -f "$BACKUP_DIR/ojix_backup_${TIMESTAMP}.dump"

# Retain last 30 daily backups
find "$BACKUP_DIR" -type f -name "ojix_backup_*.dump" -mtime +30 -exec rm {} +
```

### **Restoration Procedure**
```bash
# 1. Terminate active application connections
psql -h localhost -p 5432 -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='ojix_property';"

# 2. Restore schema and PostGIS tables
pg_restore -h localhost -p 5432 -U ojix -d ojix_property -v -c "$BACKUP_DIR/ojix_backup_<TIMESTAMP>.dump"
```
