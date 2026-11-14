# OJIX Engineering — Operator Handoff & Runbook

## 1. Local Prerequisites
- Node.js >= 20.0.0
- Docker Desktop with Docker Compose

## 2. Startup Protocol
1. Launch Docker Desktop and ensure the Docker Engine is running.
2. Start the local MariaDB database container:
   ```bash
   docker compose up -d db
   ```
3. Run the development stack (API on port `4000`, Web on port `5173`):
   ```bash
   npm run dev
   ```
4. Access the web application at `http://localhost:5173`.

## 3. Key Credentials & Demo Accounts
- Primary Demo Email: `keerthana1234p@gmail.com`
- Workspace Owner: Password `Owner@3126`
- Lead Advocate: Password `Lawyer@3126`
- Evidence Analyst: Password `Analyst@3126`
- Organisation Admin: Password `Admin@3126`

## 4. Rollback & Emergency Runbook
- To reset local database to clean seed:
  ```bash
  docker compose down -v
  docker compose up -d db
  npm run db:locations
  ```
- To verify system health via HTTP:
  ```bash
  curl http://localhost:4000/health
  ```

