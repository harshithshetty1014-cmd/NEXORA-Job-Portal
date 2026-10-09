# NEXORA — The Next-Gen Job Portal

NEXORA is a career marketplace where applicants discover and track roles while recruiters publish jobs and review candidates.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Express API
- `pnpm --filter @workspace/nexora run dev` — run the React/Vite app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required secrets: `MONGODB_URI`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: MongoDB Atlas + Mongoose
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/nexora/` — frontend app
- `artifacts/api-server/` — shared Express API and MongoDB models
- `lib/api-spec/openapi.yaml` — API source of truth

## Architecture decisions

- API sessions use an HTTP-only cookie; the user explicitly requested JWT/bcrypt authentication.
- MongoDB is required for account and job persistence; absent or unreachable Atlas is reported as a service-unavailable state, never replaced with fake data.

## Product

Applicants can find jobs, apply, save listings, and track application status. Recruiters can manage a company profile and their jobs, then review and update applicants.

## User preferences

The user specified MongoDB Atlas, JWT/bcrypt authentication, and a premium motion-rich NEXORA career portal.

## Gotchas

- Regenerate API hooks and schemas after changes to the OpenAPI file.
- Job listings with existing applications cannot be deleted; close them instead to preserve candidate records.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
