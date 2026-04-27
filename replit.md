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

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **api-server** (`artifacts/api-server`) — Express API exposing `/api/*` endpoints for projects, members, issues, activities, and dashboard aggregates. Validated against the OpenAPI spec via Zod.
- **command-center** (`artifacts/command-center`) — Manager Command Center web app at `/`. React + Vite, dark "morning briefing" theme, persistent sidebar layout. Pages: Dashboard, Projects, Project detail, Issues, Team, Activity log. Uses generated React Query hooks from `@workspace/api-client-react`.
- **mockup-sandbox** (`artifacts/mockup-sandbox`) — Canvas previews (not currently in use).

## Domain Model

- **Project**: `name`, `client`, `description`, `status` (active|on_hold|completed), `color`
- **Member**: `name`, `role`, `email`, `avatarColor`
- **Issue**: `projectId`, `title`, `description`, `priority` (critical|high|medium|low), `status` (open|in_progress|blocked|resolved), `assigneeId`, `reportedBy`, `dueDate`
- **Activity**: `projectId` (nullable), `category` (client_call|code_review|planning|one_on_one|support|deployment|documentation|other), `title`, `notes`, `durationMinutes`, `activityDate`
