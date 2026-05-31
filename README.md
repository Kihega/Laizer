# SMSS — Stationery Management & Sales System

A production-ready mobile + API monorepo for managing stationery service centres,
workers, stock, service provision tracking, reports, and owner-to-worker notices.

---

## Architecture

```
SMSS-main/
├── backend/          Express.js REST API  (Node.js, Prisma, Redis)
└── mobile/           React Native app     (Expo Router, Zustand, Axios)
```

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Mobile   | React Native + Expo Router (TypeScript)         |
| Backend  | Express.js on Render free tier (JavaScript)     |
| Database | PostgreSQL via Supabase (data storage only)     |
| Cache    | Upstash Redis (JWT sessions + API caching)      |
| ORM      | Prisma                                          |
| Auth     | Custom JWT (access + refresh) + bcrypt          |

---

## User Roles

| Role   | Login method           | Access                                          |
|--------|------------------------|-------------------------------------------------|
| Owner  | Email + password       | Centres, Workers, Reports, Notices (send)       |
| Worker | Centre ID (text string)| Stock, Service events, Notices (receive)        |

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- npm ≥ 10
- Expo Go app on your Android/iOS device

---

### 1 — Backend Setup

```bash
cd backend

# Install dependencies (Prisma client auto-generates on postinstall)
npm install

# Copy env file and fill in your values
cp .env.example .env
# Edit .env: set DATABASE_URL, DIRECT_URL, REDIS_URL, SECRET_KEY

# Run database migration (creates all 8 tables in Supabase)
npm run db:migrate

# Start development server
npm run dev
# → API running at http://localhost:8000
# → Health: http://localhost:8000/api/health/
```

---

### 2 — Mobile Setup

```bash
cd mobile

# Install dependencies
npm install

# Copy env file
cp .env.local.example .env.local
# Edit .env.local:
#   Android emulator → EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
#   iOS simulator    → EXPO_PUBLIC_API_URL=http://localhost:8000
#   Physical device  → EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8000

# Start Expo dev server
npm start
# Scan the QR code with Expo Go on your phone
```

---

### 3 — Create the First Owner Account

The system has no registration screen (owner accounts are seeded by the
developer). Create the first owner directly via Prisma Studio or a script:

```bash
cd backend

# Open Prisma Studio in the browser
npm run db:studio
# → Navigate to the "users" table → Add record
#   role: owner
#   email: owner@example.com
#   passwordHash: (run the seed script below)

# Or use this one-liner to hash a password and print it:
node -e "const b=require('bcryptjs'); b.hash('YourPassword123',12).then(h=>console.log(h))"
```

Paste the printed hash into the `password_hash` column for the owner record.

---

### 4 — Create First Centre and Assign Worker

1. Log in on the mobile app as Owner
2. Go to **Centres → + Add**
3. Fill in Centre No (e.g. `STN001`), Centre ID (e.g. `CENTRE-ARU-001`), Name, Location
4. Go to **Workers → + Register** — enter worker's name, NIM, phone
5. Go to **Workers → [worker] → Assign to Centre** — pick your new centre

The worker can now log in on the mobile app using the Centre ID: `CENTRE-ARU-001`

---

## API Reference

All endpoints are prefixed with `/api/`

| Method | Path                              | Auth          | Description                    |
|--------|-----------------------------------|---------------|--------------------------------|
| GET    | `/api/health/`                    | None          | Health + DB + Redis check      |
| POST   | `/api/auth/owner/login/`          | None          | Owner email + password login   |
| POST   | `/api/auth/worker/login/`         | None          | Worker Centre ID login         |
| POST   | `/api/auth/refresh/`              | None          | Refresh access token           |
| POST   | `/api/auth/logout/`               | None          | Blacklist refresh token        |
| GET    | `/api/auth/me/`                   | Any           | Current user profile           |
| GET    | `/api/centres/`                   | Owner         | List owner's centres           |
| POST   | `/api/centres/`                   | Owner         | Create centre                  |
| PATCH  | `/api/centres/:id/`               | Owner         | Update centre                  |
| DELETE | `/api/centres/:id/`               | Owner         | Deactivate centre              |
| GET    | `/api/workers/`                   | Owner         | List all workers               |
| POST   | `/api/workers/`                   | Owner         | Register worker                |
| POST   | `/api/workers/:id/assign/`        | Owner         | Assign to centre               |
| POST   | `/api/workers/:id/transfer/`      | Owner         | Transfer to another centre     |
| DELETE | `/api/workers/:id/`               | Owner         | Deactivate worker              |
| GET    | `/api/stock/`                     | Owner+Worker  | List stock items               |
| POST   | `/api/stock/`                     | Worker        | Register stock item            |
| PATCH  | `/api/stock/:id/`                 | Worker        | Update stock item              |
| DELETE | `/api/stock/:id/`                 | Worker        | Delete stock item              |
| GET    | `/api/services/`                  | Owner+Worker  | List service events            |
| POST   | `/api/services/`                  | Worker        | Log service event              |
| PATCH  | `/api/services/:id/`              | Worker        | Edit event (< 60 min)          |
| DELETE | `/api/services/:id/`              | Worker        | Delete event (< 60 min)        |
| GET    | `/api/notices/`                   | Owner+Worker  | List notices                   |
| POST   | `/api/notices/`                   | Owner         | Send notice + push notif       |
| POST   | `/api/notices/:id/read/`          | Worker        | Mark notice as read            |
| GET    | `/api/reports/daily/`             | Owner         | Daily summary per centre       |
| GET    | `/api/reports/weekly/`            | Owner         | Weekly summary per centre      |
| POST   | `/api/push-token/`                | Any           | Save Expo push token           |

---

## Environment Variables

### backend/.env
```
NODE_ENV=production
PORT=8000
SECRET_KEY=<64-char random hex>
DATABASE_URL=postgresql://...    (Supabase Transaction pooler, port 6543)
DIRECT_URL=postgresql://...      (Supabase Direct connection, port 5432)
REDIS_URL=rediss://...           (Upstash Redis TLS URL)
CORS_ALLOWED_ORIGINS=http://localhost:8081,exp://localhost:19000
JWT_ACCESS_EXPIRES_IN=60m
JWT_REFRESH_EXPIRES_IN=7d
```

Generate SECRET_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### mobile/.env.local
```
EXPO_PUBLIC_API_URL=https://smss-api.onrender.com
```

---

## Deployment

### Backend → Render (free tier)

1. Create a **Web Service** in Render
2. Connect your GitHub repo
3. Set:  Root Directory = `backend`
4. Set:  Build command  = `npm install`
5. Set:  Start command  = `npm start`
6. Add all env vars from `backend/.env.example`
7. Enable **Auto-Deploy** from `main` branch

> ⚠️  Render free tier sleeps after 15 min of inactivity.
> The first request after sleep takes ~10 seconds to respond.
> Upgrade to Starter ($7/mo) for production use.

### Mobile → Expo EAS

```bash
cd mobile
npm install -g eas-cli
eas login
eas build:configure

# Preview build (APK for internal testing)
eas build --platform android --profile preview

# Production build (AAB for Google Play)
eas build --platform android --profile production
```

---

## Running Tests

```bash
cd backend
npm test               # Run all tests
npm run test:coverage  # With coverage report
```

---

## Database Management

```bash
cd backend

npm run db:studio    # Open Prisma Studio (visual DB browser)
npm run db:migrate   # Apply pending migrations
npm run db:generate  # Regenerate Prisma Client after schema changes
```

---

## Branching Strategy

```
main     ← Production. Protected. Deploy to Render on merge.
develop  ← Integration. All feature work merges here.
feature/ ← One branch per sprint story.
```

---

*SMSS v1.0 · Built with Express.js + React Native + Expo*
