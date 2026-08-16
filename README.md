# 🪝 OneHook — Browser Arcade Fishing Game

OneHook is a browser arcade fishing game running entirely on **Cloudflare's 100% Free-Tier Serverless Infrastructure**: **Cloudflare Workers** (Edge API & static assets) and **Cloudflare D1** (Database).

---

## 🏗️ Architecture Overview

```text
https://sprintgames.online
           │
           ▼
   Cloudflare Worker (src/worker.js)
     │                     │
     ├── GET /*            └── POST/GET /api/*
     ▼                         ▼
Static Game Assets          Cloudflare D1 (onehook-db)
(public/ directory)         (Prepared SQL Queries)
```

- **Frontend**: HTML5 Canvas, Vanilla CSS3, Vanilla JS ([`public/`](file:///c:/AntiGravity/OneHook/public/)). Zero build step required.
- **Backend**: Cloudflare Worker ([`src/worker.js`](file:///c:/AntiGravity/OneHook/src/worker.js)) handling static asset serving and 14 API endpoints.
- **Database**: Cloudflare D1 ([`migrations/0001_initial.sql`](file:///c:/AntiGravity/OneHook/migrations/0001_initial.sql)) using parameterized SQL prepared statements.
- **Hosting Cost**: **₹0 / month** on Cloudflare Free Tier.

---

## 🛠️ Prerequisites

- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)
- **Cloudflare Account** (Free tier)

---

## 💻 Local Development Setup

### 1. Install Dependencies
```powershell
npm install
```

### 2. Apply D1 Migrations Locally
```powershell
npx wrangler d1 execute onehook-db --local --file=./migrations/0001_initial.sql
```

### 3. Verify Local Seed Data
```powershell
npx wrangler d1 execute onehook-db --local --command="SELECT id, username, best_score FROM users;"
```

### 4. Start Local Development Server
```powershell
npm run dev
```
Open **`http://localhost:8787`** in your browser to play the game and test the API!

---

## 🚀 Production Deployment to Cloudflare

### Step 1: Login to Cloudflare CLI
```powershell
npx wrangler login
```

### Step 2: Create Remote D1 Database
```powershell
npx wrangler d1 create onehook-db
```
*(Copy the generated `database_id` from the terminal output and paste it into [`wrangler.toml`](file:///c:/AntiGravity/OneHook/wrangler.toml))*

### Step 3: Apply Migrations to Remote D1
```powershell
npm run d1:migrate:prod
```

### Step 4: Deploy Worker & Static Assets
```powershell
npm run deploy
```

---

## 🌐 Custom Domain Setup (`sprintgames.online`)

1. Go to **[Cloudflare Dashboard](https://dash.cloudflare.com/)** -> **Workers & Pages**.
2. Select your deployed Worker: **`onehook-api`**.
3. Go to **Settings** -> **Domains & Routes** -> click **Add Custom Domain**.
4. Enter `sprintgames.online` and click **Add Custom Domain**.
5. Repeat for `www.sprintgames.online`.
6. Cloudflare automatically routes incoming requests and manages free SSL/TLS certificates.

---

## 🔐 Environment Variables & Secrets

- **`JWT_SECRET`**: Used to sign and verify session tokens.
  - Set locally in `wrangler.toml` or `.dev.vars`: `JWT_SECRET="your_secret_key"`
  - Set in production via Cloudflare CLI:
    ```powershell
    npx wrangler secret put JWT_SECRET
    ```

---

## 💰 Cloudflare Free-Tier Usage Considerations

| Resource | Free Tier Limit | OneHook Typical Usage | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Worker Requests** | 100,000 requests / day | ~500–5,000 / day | **₹0.00** |
| **D1 Read Rows** | 5,000,000 / day | ~10,000 / day | **₹0.00** |
| **D1 Write Rows** | 100,000 / day | ~1,000 / day | **₹0.00** |
| **D1 Storage** | 5 GB | ~5 MB | **₹0.00** |
| **Bandwidth** | Unlimited | — | **₹0.00** |
