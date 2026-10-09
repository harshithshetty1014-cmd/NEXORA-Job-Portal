# NEXORA — The Next-Gen Job Portal

NEXORA connects applicants with open roles and gives recruiters a focused workflow for publishing jobs and reviewing candidates. The React/Vite frontend calls the Express API at `/api`; MongoDB Atlas stores users, companies, jobs, and applications.

## Setup

1. Create a MongoDB Atlas cluster and a database user. Allow network access from the app's runtime in Atlas.
2. Add `MONGODB_URI` to the Replit Secrets for this project. Use the URI for the database you want NEXORA to use. Do not put the URI in source control or chat.
3. Ensure `SESSION_SECRET` is available in Replit Secrets. The API uses it to sign seven-day HTTP-only session cookies.
4. Start the `artifacts/api-server: API Server` and `artifacts/nexora: web` workflows, or run `pnpm --filter @workspace/api-server run dev` and `pnpm --filter @workspace/nexora run dev` in their respective services.
5. Open the app, register a Recruiter account, create a company profile, and publish a job. Register a second Applicant account in a separate browser session to apply and track the application.

`artifacts/api-server/.env.example` lists the required settings without real credentials. If Atlas is not connected yet, the API reports that persistence is unavailable and the app shows the setup state rather than displaying fake jobs.

## Demo flow

1. Register a Recruiter with a distinct email.
2. Create a company profile and publish a role.
3. Open a private/incognito browser window and register an Applicant.
4. Search for the role, save it, and submit an application.
5. Return to the recruiter session to move the candidate through Reviewing, Shortlisted, Interview, Offered, or Rejected.
6. Return to the applicant session to see the updated status.

## API

All application routes are under `/api`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | API and MongoDB readiness |
| GET | `/stats` | Public open-role, company, and application totals |
| POST | `/auth/register` | Create Applicant or Recruiter account |
| POST | `/auth/login` | Sign in |
| POST | `/auth/logout` | Clear session |
| GET/PATCH | `/auth/me` | Read/update own profile |
| GET/POST | `/jobs` | Search or create jobs |
| GET/PUT/DELETE | `/jobs/:id` | Read or manage a job |
| GET | `/jobs/mine` | Recruiter's own listings |
| GET/POST | `/companies` | List companies or create own company profile |
| GET/PUT | `/companies/:id` | Read/update a company |
| POST | `/applications` | Apply to an open job |
| GET | `/applications/me` | Applicant's own applications |
| GET | `/jobs/:id/applications` | Recruiter's applicants for an owned job |
| PATCH | `/applications/:id/status` | Recruiter status update |
| PATCH | `/applications/:id/withdraw` | Applicant withdrawal while eligible |
| GET | `/users/me/saved-jobs` | Applicant's saved listings |
| PUT/DELETE | `/users/me/saved-jobs/:jobId` | Save/remove a job |
| GET | `/dashboard/summary` | Role-specific database-backed dashboard metrics |

Job discovery accepts `q`, `location`, `jobType`, `experienceLevel`, `salaryMin`, `salaryMax`, `sort`, `page`, and `limit`. Responses omit password hashes. Protected requests use an HTTP-only cookie; ownership and role checks are enforced by the API. Duplicate applications are blocked by an application-level check and a unique MongoDB index.

## Structure

- `artifacts/nexora/` — React/Vite application and responsive UI.
- `artifacts/api-server/` — Express API, MongoDB models, authentication, and REST routes.
- `lib/api-spec/openapi.yaml` — API source contract; generated client hooks and validation schemas live in `lib/api-client-react/` and `lib/api-zod/`.
- `README.md` — setup and hackathon demo instructions.

## Checks

- `pnpm --filter @workspace/api-spec run codegen`
- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/nexora run typecheck`
- `pnpm run build`
