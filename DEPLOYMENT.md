# OneHook — Cloudflare Deployment Guide

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

### (Optional) Setup Real Email Delivery
To deliver verification emails directly to user inboxes (via [Resend](https://resend.com) - 3,000 free emails/month):
```
npx wrangler secret put RESEND_API_KEY
```
*(If unconfigured, the Worker uses MailChannels or outputs the verification code to the Cloudflare Worker console logs).*

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
