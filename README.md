================================================================================
  LAIZER  --  STATIONERY MANAGEMENT & SALES SYSTEM (SMSS)
  Mobile-Based Business Operations Platform
================================================================================
  Version  : 1.1
  Updated  : June 2026
================================================================================


OVERVIEW
--------
Laizer (SMSS) is a cross-platform mobile application that digitises the
day-to-day operations of a stationery business running across multiple
service centres. The owner gets a single dashboard to manage centres,
workers, stock, and revenue trends in real time. Workers on the ground
log transactions, manage stock levels, and receive notices from the owner
instantly -- replacing paper-based record-keeping entirely.

Core problems it solves:
  [1] Manual, paper-based stock tracking across dispersed service centres
  [2] No real-time visibility into service trends or worker activity
  [3] Slow, unreliable communication between the owner and centre workers


--------------------------------------------------------------------------------
TABLE OF CONTENTS
--------------------------------------------------------------------------------

  1.  Features
  2.  Tech Stack
  3.  Project Structure
  4.  Getting Started
        4a. Prerequisites
        4b. Backend Setup
        4c. Mobile Setup
  5.  Environment Variables
  6.  API Reference
  7.  User Roles
  8.  Database Schema
  9.  Deployment
  10. CI / CD
  11. Branching Strategy
  12. Future Enhancements
  13. License


================================================================================
1. FEATURES
================================================================================

OWNER
-----
  Module      Capabilities
  ----------  ----------------------------------------------------------------
  Centres     Add, edit, deactivate, and delete service centres
  Workers     Register workers, assign / transfer between centres, deactivate
  Reports     Daily & weekly revenue summaries, service trends, stock levels
  Notices     Compose and send normal or urgent notices; view read receipts

WORKER
------
  Module          Capabilities
  ----------      ------------------------------------------------------------
  Authentication  Log in using the assigned Centre ID (no email required)
  Stock           Add, update, and remove stock items (pieces or boxes)
                  with Tanzanian Shilling (Tshs) pricing
  Services        Log photocopy, printing, lamination, scanning, designing
                  events per customer transaction
  Notices         View owner notices; receive push notifications for new ones


================================================================================
2. TECH STACK
================================================================================

MOBILE  (/mobile)
  Layer                Technology
  -------------------  --------------------------------------------------------
  Framework            React Native + Expo (Managed Workflow)
  Language             TypeScript
  Navigation           Expo Router v6  (file-based routing)
  Icons                @expo/vector-icons -- Ionicons
  State management     Zustand
  API client           Axios + TanStack React Query
  Push notifications   Expo Notifications
  Auth storage         Expo SecureStore

BACKEND  (/backend)
  Layer                Technology
  -------------------  --------------------------------------------------------
  Runtime              Node.js (>= 18)
  Framework            Express.js
  Language             JavaScript (ES modules)
  ORM                  Prisma
  Database             PostgreSQL via Supabase (free tier)
  Caching              In-process Map  (Upstash Redis -- optional)
  Authentication       Custom JWT:
                         Access token   60 min
                         Refresh token  7 days
  Validation           Zod schemas on every route
  Hosting              Render (free tier, Dockerised)


================================================================================
3. PROJECT STRUCTURE
================================================================================

  Laizer/
  |-- backend/                     Express.js REST API
  |   |-- prisma/
  |   |   |-- schema.prisma         Database schema (8 tables)
  |   |   +-- seed.js               Default seed data
  |   |-- src/
  |   |   |-- config/               Environment config loader
  |   |   |-- lib/                  jwt.js  redis.js  audit.js  push.js
  |   |   |-- middleware/           auth.js  errorHandler.js
  |   |   +-- routes/               auth.js  centres.js  workers.js
  |   |                             stock.js  services.js  reports.js
  |   |                             notices.js  health.js
  |   |-- Dockerfile
  |   |-- start.sh                  migrate + start (used by Render)
  |   +-- .env.example
  |
  |-- mobile/                      React Native / Expo application
  |   |-- app/
  |   |   |-- (auth)/
  |   |   |   +-- login.tsx         Owner & worker login screen
  |   |   |-- (owner)/              Owner-only tab group
  |   |   |   |-- _layout.tsx       Tab bar with Ionicons
  |   |   |   |-- dashboard.tsx     Revenue stats + quick actions
  |   |   |   |-- centres.tsx       Centre management
  |   |   |   |-- workers.tsx       Worker management
  |   |   |   |-- reports.tsx       Daily / weekly reports
  |   |   |   +-- notices.tsx       Send notices to workers
  |   |   +-- (worker)/             Worker-only tab group
  |   |       |-- _layout.tsx       Tab bar with Ionicons
  |   |       |-- dashboard.tsx     Stats + quick actions
  |   |       |-- stock.tsx         Stock management
  |   |       |-- services.tsx      Service event logger
  |   |       +-- notices.tsx       Notice inbox
  |   |-- components/
  |   |   +-- ui/                   Button  Card  Input  StatusBadge
  |   |-- constants/                theme.ts  api.ts
  |   |-- hooks/                    useAuth.ts
  |   |-- services/                 api.ts  (Axios service layer)
  |   |-- store/                    authStore.ts  (Zustand)
  |   +-- .env.local.example
  |
  |-- Agile_Scrum_Files/            Sprint backlogs & retrospectives
  |   |-- Sprint_0_Setup/
  |   |-- Sprint_1_Authentication/
  |   |-- Sprint_2_Centre_and_Worker_Management/
  |   |-- Sprint_3_Stock_Management/
  |   |-- Sprint_4_Service_Provision_Tracking/
  |   |-- Sprint_5_Reports_and_Notices/
  |   +-- Sprint_6_QA_and_Production_Release/
  |
  +-- Project_Documentation/        Architecture & system design docs
      |-- PROJECT_SUMMARY.txt
      |-- SYSTEM_ARCHITECTURE_AND_DATABASE_DESIGN.txt
      +-- GITHUB_MONOREPO_SETUP_GUIDE.txt


================================================================================
4. GETTING STARTED
================================================================================

4a. Prerequisites
    --------------
    - Node.js >= 18          https://nodejs.org
    - npm or pnpm
    - Expo CLI               npm install -g expo-cli
    - A Supabase project     https://supabase.com  (free tier is sufficient)
    - One of the following to run the mobile app:
        * Android emulator (Android Studio)
        * iOS simulator (Xcode, macOS only)
        * Physical device running Expo Go  https://expo.dev/go


4b. Backend Setup
    -------------

    Step 1 -- Navigate to the backend directory
             cd backend

    Step 2 -- Install dependencies
             npm install

    Step 3 -- Set up environment variables
             cp .env.example .env
             # Open .env and fill in:
             #   DATABASE_URL  -- Supabase pooler connection string (port 6543)
             #   DIRECT_URL    -- Supabase direct connection string (port 5432)
             #   SECRET_KEY    -- long random secret for JWT signing

    Step 4 -- Generate Prisma client, run migrations, and seed the database
             npm run setup

    Step 5 -- Start the server
             npm run dev       # development mode (nodemon auto-reload)
             npm start         # production mode

    The API will be running at:  http://localhost:8000

    Verify with:
      GET http://localhost:8000/api/health
      Expected response: { "status": "ok" }


4c. Mobile Setup
    ------------

    Step 1 -- Navigate to the mobile directory
             cd mobile

    Step 2 -- Install dependencies
             npm install

    Step 3 -- Set up environment variables
             cp .env.local.example .env.local
             # Set EXPO_PUBLIC_API_URL to your backend:
             #   Android emulator  ->  http://10.0.2.2:8000
             #   iOS simulator     ->  http://localhost:8000
             #   Production        ->  https://your-api.onrender.com

    Step 4 -- Start Expo
             npm start

    In the Expo terminal:
      Press  a  to open on Android emulator
      Press  i  to open on iOS simulator
      Scan the QR code with Expo Go on a physical device


================================================================================
5. ENVIRONMENT VARIABLES
================================================================================

BACKEND  --  backend/.env
  (copy from backend/.env.example and fill in real values)
  (this file is .gitignored -- NEVER commit it)

  Variable                  Description
  ------------------------  ---------------------------------------------------
  NODE_ENV                  Runtime mode: production | development
  PORT                      HTTP port (default: 8000)
  SECRET_KEY                JWT signing secret -- generate with:
                              node -e "console.log(require('crypto')
                                .randomBytes(64).toString('hex'))"
  DATABASE_URL              Supabase Transaction Pooler URL  (port 6543)
                              postgresql://postgres.[ref]:[pw]@...supabase.com
                              :6543/postgres?pgbouncer=true
  DIRECT_URL                Supabase Direct URL  (port 5432)
                              postgresql://postgres.[ref]:[pw]@...supabase.com
                              :5432/postgres
  CORS_ALLOWED_ORIGINS      Comma-separated list of allowed origins
                              e.g. http://localhost:8081,https://your-app.com
  JWT_ACCESS_EXPIRES_IN     Access token TTL  (default: 60m)
  JWT_REFRESH_EXPIRES_IN    Refresh token TTL (default: 7d)
  SERVICE_EDIT_WINDOW_MS    How long a worker can edit a service event
                              (default: 3600000 = 60 minutes)
  OWNER_LOGIN_RATE_MAX      Max owner login attempts before rate limiting
                              (default: 20)


MOBILE  --  mobile/.env.local
  (copy from mobile/.env.local.example)
  (this file is .gitignored -- NEVER commit it)

  Variable                  Description
  ------------------------  ---------------------------------------------------
  EXPO_PUBLIC_API_URL       Base URL of the Express API
                              Android emulator : http://10.0.2.2:8000
                              iOS simulator    : http://localhost:8000
                              Production       : https://smss-api.onrender.com


================================================================================
6. API REFERENCE
================================================================================

All protected routes require the header:
  Authorization: Bearer <access_token>

  Method           Endpoint                      Auth            Description
  ---------------  ----------------------------  --------------  ---------------
  POST             /api/auth/owner/register      Public          Register owner
  POST             /api/auth/owner/login         Public          Owner login
                                                                 -> JWT pair
  POST             /api/auth/worker/login        Public          Worker login
                                                                 via Centre ID
  POST             /api/auth/refresh             Public          New access token
  POST             /api/auth/logout              Bearer          Revoke session
  GET              /api/auth/me                  Bearer          Own profile

  GET              /api/centres                  Bearer (Owner)  List centres
  POST             /api/centres                  Bearer (Owner)  Create centre
  PATCH            /api/centres/:id              Bearer (Owner)  Update centre
  DELETE           /api/centres/:id              Bearer (Owner)  Delete centre

  GET              /api/workers                  Bearer (Owner)  List workers
  POST             /api/workers                  Bearer (Owner)  Register worker
  PATCH            /api/workers/:id              Bearer (Owner)  Update worker
  DELETE           /api/workers/:id              Bearer (Owner)  Remove worker

  GET              /api/stock                    Bearer          List stock
  POST             /api/stock                    Bearer          Add stock item
  PATCH            /api/stock/:id                Bearer          Update stock
  DELETE           /api/stock/:id                Bearer          Remove stock

  GET              /api/services                 Bearer          List events
  POST             /api/services                 Bearer          Log service

  GET              /api/reports/daily            Bearer (Owner)  Daily revenue
  GET              /api/reports/weekly           Bearer (Owner)  Weekly report

  GET              /api/notices                  Bearer          List notices
  POST             /api/notices                  Bearer (Owner)  Send notice

  GET              /api/health                   Public          Health check


================================================================================
7. USER ROLES
================================================================================

owner
  - Authenticated via email + password
  - Full access to all management and reporting endpoints
  - JWT session stored with a TTL; blacklisted on logout

worker
  - Authenticated via their assigned Centre ID only (no email required)
  - Can only access stock and service-event endpoints for their centre
  - Cannot access owner-only routes (centres, workers, reports)

The role field is embedded in the JWT payload and enforced by middleware
on every protected request. Attempting to access a role-restricted route
returns HTTP 403 Forbidden.


================================================================================
8. DATABASE SCHEMA
================================================================================

Built with Prisma ORM on PostgreSQL (Supabase).

  Table           Description
  --------------  --------------------------------------------------------------
  User            Stores both owners and workers.
                  Key fields: fullName, email, phone, nim, role, isActive,
                  passwordHash, lastLogin
                  role enum: owner | worker

  Centre          A physical service centre.
                  Key fields: name, centreNo (e.g. STN001), location, isActive

  CentreWorker    Join table -- assigns workers to centres (many-to-many).
                  Key fields: userId, centreId, assignedAt

  StockItem       Inventory item at a centre.
                  Key fields: itemName, quantity, unit (pcs | boxes),
                  netPriceTshs, centreId

  ServiceEvent    A logged customer transaction.
                  Key fields: serviceType (photocopy | printing | lamination |
                  scanning | designing | other), serviceSubtype
                  (black_and_white | colour), pages, pricePerPageTshs,
                  totalAmountTshs, workerId, centreId

  Notice          A message from owner to workers.
                  Key fields: title, body, priority (low | normal | urgent),
                  centreId (null = all centres)

  NoticeRead      Read receipt per worker per notice.
                  Key fields: noticeId, userId, readAt

  AuditLog        Immutable record of all create / update / delete actions.
                  Key fields: action, entity, entityId, performedBy, meta

All monetary values are stored and displayed in Tanzanian Shillings (Tshs).


================================================================================
9. DEPLOYMENT
================================================================================

BACKEND  --  Render
  The backend ships with a Dockerfile and start.sh.
  Render auto-detects the Dockerfile on every push to main.

  start.sh execution order:
    1.  npx prisma migrate deploy    (applies any pending migrations)
    2.  node src/server.js           (starts the Express server)

  Steps to deploy:
    1.  Create a new Web Service on Render
    2.  Connect your GitHub repository
    3.  Set the root directory to  backend/
    4.  Set all environment variables from backend/.env.example
        in the Render Environment dashboard
    5.  Do NOT commit .env -- it is .gitignored

  Notes:
    - Free tier spins down after 15 min of inactivity; the first request
      after a cold start may take ~30 seconds.
    - Upgrade to a paid tier for always-on availability.


MOBILE  --  EAS Build (Expo Application Services)

  Install EAS CLI:
    npm install -g eas-cli
    eas login

  First-time configuration:
    cd mobile
    eas build:configure

  Build commands (defined in mobile/eas.json):
    npm run build:android     Production Android AAB / APK
    npm run build:preview     Preview APK for internal testing

  OTA updates (minor JS changes -- no store resubmission needed):
    npx expo publish


================================================================================
10. CI / CD
================================================================================

Two GitHub Actions workflows in .github/workflows/:

  File          Trigger               Actions
  ------------  --------------------  -----------------------------------------
  ci.yml        Every pull request    1. npm ci  in backend/
                                      2. npm run lint (ESLint)
                                      3. npm ci  in mobile/
                                      4. npm run typecheck (tsc --noEmit)
                                      PRs are blocked if any check fails.

  deploy.yml    Merge to main         1. POST to Render deploy webhook
                                        (triggers backend redeploy)
                                      2. eas build (production mobile build)


================================================================================
11. BRANCHING STRATEGY
================================================================================

  main             Production-ready code only. Branch-protected.
   |
   +-- develop     Integration branch. All features merge here first.
         |
         +-- feature/backend-auth-routes
         +-- feature/worker-login-centre-id
         +-- feature/stock-management
         +-- feature/service-events
         +-- feature/reports-dashboard
         +-- feature/notices-push
         +-- bugfix/<short-description>
         +-- hotfix/<short-description>        (branch from main if urgent)

  Workflow
  --------
  Step 1 : Developer creates a feature branch from develop
  Step 2 : Opens a Pull Request into develop
             - CI checks must pass
             - At least one reviewer must approve
  Step 3 : Merge into develop
  Step 4 : End of sprint: open PR from develop -> main
  Step 5 : Merge to main triggers:
             - Render: auto-redeploys the backend
             - EAS:    builds updated mobile app for distribution

  Commit message convention:
    feat:     a new feature
    fix:      a bug fix
    chore:    build / config / dependency changes
    docs:     documentation only
    refactor: code change that neither fixes a bug nor adds a feature
    test:     adding or updating tests

  Examples:
    feat: add worker transfer between centres
    fix: correct revenue calculation on weekly report
    chore: upgrade Prisma to 5.14


================================================================================
12. FUTURE ENHANCEMENTS  (post-MVP)
================================================================================

  Priority  Enhancement
  --------  ------------------------------------------------------------------
  High      Customer-facing receipt generation (PDF + WhatsApp share)
  High      Automated low-stock alerts with configurable thresholds
  Medium    Sales invoicing and detailed revenue tracking per worker
  Medium    Worker performance analytics dashboard
  Medium    Multi-language support (Swahili + English toggle)
  Low       Web admin dashboard built with Next.js
  Low       Upgrade Render to paid tier for always-on backend
  Low       Barcode / QR scanner for stock item lookup
  Low       Offline-first mode with background sync queue


================================================================================
13. LICENSE
================================================================================

  Private -- all rights reserved.

  This codebase is proprietary software developed for internal business use.
  It is NOT open source and may not be redistributed, sublicensed, copied,
  modified, or used in any derivative work without explicit written permission
  from the project owner.


================================================================================
End of README
================================================================================
