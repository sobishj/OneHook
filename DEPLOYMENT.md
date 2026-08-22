# SprintGames — Cloudflare Deployment Guide

Run these commands **once** to go live. Each step is required.

## Step 1 — Authenticate with Cloudflare
```
npx wrangler login
```
This opens a browser. Click **Allow** to authorize Wrangler.

## Step 2 — Create the D1 Database
```
npx wrangler d1 create onehook-db
```
Copy the `database_id` from the output. It looks like:
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
Paste it into `wrangler.toml` replacing the placeholder `00000000-0000-0000-0000-000000000000`.

## Step 3 — Apply the Database Schema
```
npx wrangler d1 execute onehook-db --remote --file=./migrations/0001_initial.sql
```

## Step 4 — Set Secrets
```
npx wrangler secret put JWT_SECRET
```
Enter a strong random string when prompted (e.g. a 64-character random hex string).

### Setup Email Delivery (Brevo)
To deliver verification emails directly to user inboxes (via [Brevo](https://brevo.com) — 300 free emails/day):
```
npx wrangler secret put BREVO_API_KEY
```
*(Required for user registration. Get your API key from [Brevo Dashboard](https://app.brevo.com/settings/keys/api).)*

## Step 5 — Deploy
```
npx wrangler deploy
```
Your Worker will be live at `https://onehook-api.<your-subdomain>.workers.dev`

## Step 6 — Connect Custom Domain (optional)
In the Cloudflare Dashboard → Workers & Pages → onehook-api → Settings → Domains & Routes → Add Custom Domain → `sprintgames.online`

---

## Local Development
```
npm install
npx wrangler d1 execute onehook-db --local --file=./migrations/0001_initial.sql
npm run dev
```
Visit http://localhost:8787
