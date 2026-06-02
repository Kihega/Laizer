# Laizer API — Termux Setup Guide

> Docker is **not** required locally.  
> Use plain Node.js commands on Termux. Docker is used only on Render.

---

## One-time setup

```bash
# Install Node.js and git (skip if already installed)
pkg install nodejs git

# Clone the repo (skip if you already have it)
git clone https://github.com/YOUR_USERNAME/Laizer.git
cd Laizer/backend

# Install npm dependencies
npm install

# Create your local .env from the example
cp .env.example .env
```

Now open `.env` and fill in:

```
DATABASE_URL=postgresql://postgres.hyowzumaoevdxwycumui:laizer##2026@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.hyowzumaoevdxwycumui:laizer##2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
SECRET_KEY=<your-64-char-hex>
NODE_ENV=development
PORT=8000
CORS_ALLOWED_ORIGINS=*
```

Generate a SECRET_KEY (run once):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Full setup (migrate + seed)

```bash
# Run Prisma migrate, then seed the test owner — one command:
npm run setup
```

Expected output:
```
✅ In-memory cache active.
🌱 Laizer — seeding database...
✅ Test owner ready:
   Email:    owner@laizer.com
   Password: Laizer@2026
```

---

## Daily workflow

```bash
cd Laizer/backend

# Pull latest changes
git pull origin develop

# Start the API server
npm start
# → Listening on http://localhost:8000

# OR with auto-reload (if nodemon works on your device)
npm run dev
```

Health check:
```bash
curl http://localhost:8000/api/health/
# → {"status":"ok","service":"SMSS API",...}
```

Test login:
```bash
curl -X POST http://localhost:8000/api/auth/owner/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@laizer.com","password":"Laizer@2026"}'
```

---

## Useful Prisma commands

```bash
# Apply any new migrations (after pulling from git)
npm run db:migrate

# Reset DB completely and re-seed (⚠️ destroys all data)
npm run db:reset

# Open Prisma Studio (visual DB browser — if browser available)
npm run db:studio

# Re-seed test owner only
npm run db:seed
```

---

## Backend → Mobile connection

Set the backend URL in `mobile/constants/api.ts`:

```ts
// For Termux local testing (phone + PC on same WiFi)
BASE_URL: 'http://192.168.x.x:8000'   // your PC's local IP

// For production (Render)
BASE_URL: 'https://laizer.onrender.com'
```

---

## What runs where

| Environment | How to run | Docker? |
|---|---|---|
| **Termux / local** | `npm start` | ❌ Not needed |
| **GitHub Actions CI** | `npm test` (Node) | ❌ Not needed |
| **Render production** | `start.sh` → `prisma migrate deploy` → `node src/server.js` | ✅ Auto |

---

## Test owner credentials

| Field | Value |
|---|---|
| Email | `owner@laizer.com` |
| Password | `Laizer@2026` |
| Role | owner |
| Active | true |

After first login:
1. Go to **Centres** → create a centre (you get a `CENTRE-XXX-001` ID)
2. Go to **Workers** → add a worker to that centre
3. Worker logs in with the Centre ID
