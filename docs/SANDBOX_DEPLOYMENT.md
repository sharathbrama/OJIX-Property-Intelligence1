# OJIX Property Intelligence — Zero-Cost Sandbox & Cloud Deployment

This guide outlines how to run and deploy the complete platform for testing, demonstrations, and stakeholder reviews with **$0.00 infrastructure cost**.

---

## 1. Instant Zero-Cost Live Sandbox (Cloudflare Edge Tunnel)

The platform is configured to serve both the React Single Page Application and the Express REST APIs under a single unified origin on port `4000`, connected directly to the local PostGIS 16 database.

### Start the Sandbox
```bash
# 1. Build production web bundle
npm run build

# 2. Launch the Cloudflare edge tunnel (zero cost, public HTTPS URL)
cloudflared tunnel --url http://localhost:4000
```

### Features of the Sandbox Environment
- **$0 Cost**: No credit card, no cloud bills, no tier limits.
- **Public HTTPS**: Cloudflare SSL edge encryption accessible on mobile, tablet, or client demo laptops anywhere.
- **Live PostGIS 16**: Real-time geodesic buffer evaluations (Rajakaluve 50m/25m SWD and 30m lake wetland).
- **All Engines Active**: Document Vault, Title DAG, Discrepancy Matrix, Legal Precedent Search, and PDF Due Diligence Reports.

---

## 2. 24/7 Cloud Deployment with Free Tiers ($0.00)

If you require a persistent cloud deployment that stays online even when your local machine is closed:

### Architecture
| Component | Free Cloud Provider | Free Tier Allocation | Cost |
| :--- | :--- | :--- | :--- |
| **PostgreSQL + PostGIS** | **Supabase** | 500 MB database, PostGIS extension pre-installed | **$0.00** |
| **Backend API** | **Render.com** | Free Web Service (512 MB RAM, free HTTPS subdomain) | **$0.00** |
| **Frontend Web** | **Vercel / Cloudflare Pages** | Unlimited preview deployments, free global CDN | **$0.00** |

### Step-by-Step 24/7 Setup

#### A. Database (Supabase Free Tier)
1. Create a free project on [supabase.com](https://supabase.com).
2. Under **Database → Extensions**, toggle **postgis** ON.
3. In SQL Editor, run [`infra/db/schema.sql`](../infra/db/schema.sql) followed by [`infra/db/seed.sql`](../infra/db/seed.sql).
4. Copy the PostgreSQL connection URI (`postgres://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`).

#### B. API Server (Render Free Tier)
1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New → Web Service**.
2. Connect the GitHub repository: `https://github.com/ojix-admin/OJIX-NonLetigation-Law-inteligence`.
3. Set:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm run start`
   - **Environment Variables**:
     - `DATABASE_URL`: *(Your Supabase connection string)*
     - `NODE_ENV`: `production`
     - `PORT`: `4000`

#### C. Frontend (Vercel / Cloudflare Pages Free Tier)
1. Connect repository on [vercel.com](https://vercel.com).
2. Set:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: `Vite`
   - **Environment Variable**: `VITE_API_URL` = *(Your Render API URL, e.g. `https://ojix-api.onrender.com`)*
3. Deploy!
