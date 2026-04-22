# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Manuskripta (artifacts/manuskripta)
Premium AI-powered book writing mobile app (Expo, Android 10+).

**Design**: Dark/light theme — background #000000 (dark) or #F5F5F0 (light), cards #0A0A0A, borders #1A1A1A, gold accent #D4AF37
**Auth**: Invite-only, admin approval required. Admin: macdondavid565@gmail.com
**AI**: DeepSeek API (`EXPO_PUBLIC_DEEPSEEK_API_KEY` env secret required), async job system
**Routes**: `/(auth)/login`, `/(auth)/register`, `/(app)/dashboard`, `/(app)/create-book`, `/(app)/format-book`, `/(app)/book-details`, `/announcements`, `/admin`
**Key files**:
- `context/AppContext.tsx` — all state (auth, jobs, settings, announcements), AsyncStorage persistence
- `services/aiService.ts` — DeepSeek API integration, blueprint/chapter/copyright generation
- `services/generationEngine.ts` — async job runner, retry logic, stop/restart
- `components/` — GoldButton, GoldInput, ToneChip, BookCard, SettingsPanel, AppHeader, ErrorBoundary
- `hooks/useColors.ts` — palette based on theme setting
- Access request link: https://wa.link/tvplnb

### API Server (artifacts/api-server)
Express 5 REST API serving at port 8080 (mounted at `/api` and `/api-server/api`).

**Routes**: `/api/auth/*`, `/api/users/*`, `/api/jobs/*`, `/api/announcements/*`, `/api/ai/complete`
**Key files**:
- `src/app.ts` — Express app with dual mounting
- `src/routes/auth.ts` — login/register/logout/me + Google OAuth (`/auth/google-login`)
- `src/routes/jobs.ts` — job CRUD with user scoping + `/jobs/all` admin endpoint
- `src/routes/users.ts` — user management (admin only), `/users/:email/jobs` for usage monitor
- `src/routes/announcements.ts` — announcements CRUD
- `src/routes/ai.ts` — DeepSeek proxy at `/api/ai/complete`

**Google OAuth**: POST `/api/auth/google-login` with `{ idToken }` body. Verifies against Google tokeninfo endpoint. Requires `GOOGLE_CLIENT_ID` env var.

### Manuskripta Web (artifacts/manuskripta-web)
React + Vite web app served at `/manuskripta-web/` (port 24421).

**Design**: Dark/light theme — black/gold theme matching mobile app. Theme persisted in localStorage.
**Auth**: Invite-only system, JWT bearer token in localStorage. Google Sign-In supported (requires `VITE_GOOGLE_CLIENT_ID`).
**Key files**:
- `src/context/AppContext.tsx` — auth (incl. googleLogin), jobs, announcements, theme state
- `src/lib/api.ts` — REST API client, includes `authApi.googleLogin()` and `usersApi.getUserJobs()`
- `src/lib/types.ts` — shared types (User.maxBooksPerMonth, UserSettings.theme, etc.)
- `src/pages/login.tsx` — email/password + Google Sign-In button + pending access flow
- `src/pages/settings.tsx` — Theme toggle, Auto-download, Memory Bank, Default Copyright, Default Tones, Logout
- `src/pages/admin.tsx` — Members Dashboard (Pending/Approved/Rejected tabs), Usage Monitor, Live Jobs, Announcements, System Health
- `src/pages/create-book.tsx` — Pre-populates tones and memoryBank from settings, "Use Default" copyright option
- `src/pages/dashboard.tsx` — Monthly book limit display (maxBooksPerMonth)

### Database Schema (lib/db/src/schema/manuskripta.ts)
- `msk_users` — users with approval status, `max_books_per_month` limit (per month), `google_id`, admin flag
- `msk_sessions` — JWT token sessions  
- `msk_jobs` — book generation jobs (per user)
- `msk_announcements` — admin-posted announcements

**Schema note**: `max_books_per_month` replaced `max_concurrent_books`. Default is 4 for new users, set during approval.

## Settings System
- **Theme**: Dark (pure #000) / Light toggle — persisted in localStorage/AsyncStorage
- **Memory Bank**: Auto-injected into every book generation prompt
- **Default Copyright**: Used when "Use Default" is selected during book creation
- **Default Tones**: Pre-populated in book creation form
- **Auto-Download**: Toggle for automatic file saving on completion
- Settings accessible from every screen via NavBar ⚙ button (web) or SettingsPanel (mobile)

## Access Control
- New users → `pending` status, shown "Request Access" button → https://wa.link/tvplnb
- Admin (macdondavid565@gmail.com) approves/rejects from Admin Panel
- On approval: monthly book limit (max_books_per_month) and 30-day window set
- Admin can edit monthly limit at any time from Members Dashboard

## Google Auth Setup
To enable Google Sign-In:
1. Create a project at https://console.cloud.google.com
2. Enable Google Identity Services
3. Create OAuth 2.0 credentials
4. Set `VITE_GOOGLE_CLIENT_ID` (web) and `GOOGLE_CLIENT_ID` (API server) env vars
5. The Google Sign-In button appears automatically on the login page

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
