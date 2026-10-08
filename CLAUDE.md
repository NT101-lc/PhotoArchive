@AGENTS.md

# thesix — the crew's photo archive

Private photo/video archive for a group of six friends, organised by trip, plus a trip planner. Next.js 16 App Router (React 19.3), Drizzle ORM on Neon Postgres, files on Cloudflare R2, deployed on Vercel.

## Commands

```bash
npm run dev          # dev server (port 3000)
npm run typecheck    # next typegen && tsc — run after touching routes (typed routes / PageProps / RouteContext)
npm run lint
npm test             # node:test via tsx, files src/**/*.test.ts
npm run build
npx drizzle-kit generate --name <what>   # new migration in drizzle/
npm run db:migrate                       # applies to the SHARED production Neon DB — see below
```

There is no Prettier config: don't run Prettier (it would rewrap files to 80 columns). Match the existing style by hand (wide lines, ~130 cols).

## Rules for working here

- **The user pushes.** Commit only when asked ("commit"); never `git push`. A settings.json deny rule and a PreToolUse hook (`../.claude/hooks/block-dangerous.mjs`) enforce this.
- **Never read or write `.env*` files** (also blocked). Scripts get env via `loadEnvConfig` from `@next/env`.
- **There is only one database, and it's production.** Ask before `npm run db:migrate`, and before any write or delete of real data. Test rows you create, clean them up afterwards.
- The hook also blocks any Bash command containing words like `truncate` or `drop`, including Tailwind's `truncate` class in a heredoc. Write such files with the Write tool.
- Don't run `npm run build` while `npm run dev` is running. Both write `.next/dev/types/routes.d.ts`, the file gets corrupted, and nested API routes (e.g. `/api/photos/[id]/*`) then 404 in dev. Fix: stop the dev server, run the build, start dev again.
- Windows + `core.autocrlf`: files may be CRLF. If an exact-string edit fails, normalise `\r\n` first.
- The user writes in Vietnamese; reply in Vietnamese, concisely. **UI copy is English.** Code comments are Vietnamese (match the file).
- Before writing Next.js code, check `node_modules/next/dist/docs/` (see AGENTS.md). Next 16 specifics in use: `after()`, `connection()`, typed `PageProps<"/route">` / `RouteContext<"/api/route">`, `<Link prefetch>`, React `<ViewTransition>`, `next/image` `preload` prop.

## Layout

- `src/app/`: pages: `/` (latest trip + timeline), `/albums`, `/albums/[id]`, `/plans`, `/plans/[slug]`, `/dashboard`, `/about`, `/login`, `/profile`. REST handlers live in `src/app/api/**`.
- `src/db/schema.ts`: tables `members`, `albums`, `photos` (photos and videos), `site_content` (key → JSON, e.g. the About text), `plans` (trip planner). Columns are camelCase in TS and snake_case in the DB.
- `src/lib/`:
  - `data.ts`: the read layer for UI (DTOs). Server only.
  - `mutations.ts`: album, photo and upload writes, with zod inputs.
  - `plans.ts`, `about.ts`: planner and About reads and writes.
  - `permissions.ts`: pure rules shared by server checks and UI.
  - `api.ts`: `handle()`, `json()`, `readJson()` for route handlers.
  - `api-client.ts`: browser fetch helpers.
  - `auth.ts`: `getCurrentMember`, `requireMember`, `requireAdmin`.
  - `storage.ts`: R2 via aws4fetch (presign, multipart, delete, list).
  - `format.ts`: dates (dd/mm/yyyy input, `Asia/Ho_Chi_Minh`), bytes, plurals.
  - Pure helpers that the client can import too: `plan-utils.ts`, `about-text.ts`, `transcode-plan.ts`, `media.ts`.
- `scripts/transcode-worker.ts` + `.github/workflows/transcode.yml`: the video pipeline (below).
- `docs/plans/next-features.md`: feature plan notes.

Pattern for a new feature: schema + migration → `src/lib/<feature>.ts` (server-only, zod input, permission check, throws `ForbiddenError` / `NotFoundError` / `BadRequestError`) → `src/app/api/...` route using `handle()` → client helper in `api-client.ts` → page / client component. Put pure logic in a separate file with a `*.test.ts`.

## Auth & permissions

No passwords for the crew. A user (role 1) picks their name, which sets a cookie. The admin (role 0) logs in with a password. Most edits only need a picked name. Admin only: renaming an album, changing its place, deleting it. Cover photo: admin or the album's creator. Deleting a photo: admin or its uploader. Deleting a plan: admin or its creator. See `permissions.ts` and keep the UI and server using the same function.

## Media pipeline

- **Uploads.** The browser uploads straight to R2 with presigned URLs; videos use S3 multipart. `UploadManager` keeps uploads running in the background while you browse, and `UploadDock` shows their progress.
- **Video rows.** A video is inserted as `status='queued'`, and the app sends a `repository_dispatch` to GitHub (env `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPOSITORY`). A cron job every 3 h is the fallback.
- **The worker.** The GitHub Actions worker runs a matrix of up to 4 runners. Each claims jobs with `FOR UPDATE SKIP LOCKED` and makes a single 720p H.264 MP4 plus a poster (HDR is tone-mapped). It points `storage_key` at the 720p file and **deletes the original**. Max 3 attempts; a lock older than 3 h counts as stale.
- **Deletes.** Deleting an album or photo also deletes its R2 objects (`deleteObjects`). A failed delete is only logged.

## Design system ("light table / darkroom")

- **Tokens.** Defined in `src/app/globals.css` (`--bg`, `--surface`, `--ink`, `--accent` green, `--edge` amber, `--film`, `--chart`, `--backlight`, …) with light and dark themes via `[data-theme]`. Don't hard-code colours.
- **Fonts.** Archivo (wide `font-stretch` for display) and Be Vietnam Pro for body text.
- **Icons.** Only through the wrappers in `src/components/Icons.tsx` (react-icons/md).
- **Building blocks.**
  - `.print`: a photo print with a white border.
  - `.frame-no`: amber film-edge numbers.
  - `.sprockets`: film holes, on `bg-film`.
  - `.unexposed` / `.safelight`: empty frames.
  - `.sheet`: the planner table.
  - `.justified`: photo rows.
  - Also `PageHero`, `EmptyState`, `Modal`, `ConfirmDialog`, `Toast`.
- **Cover morph.** `CoverPrint` makes the album cover morph between pages with a `<ViewTransition name="cover-<id>">`. It only plays when the target page is already prefetched, so album links use `prefetch` (full prefetch, production only). It never shows in `npm run dev`; check it with `npm run build && npm start`.
- **Phones.** The layout must work at 375 px with no horizontal scroll. The top nav is tight: check it whenever you add a link (icons replace labels below `sm`, and "Home" is hidden).

## Verifying UI

- Use the preview server `b6-dev` (`../.claude/launch.json`). The browser pane often stops rendering while hidden, so take a screenshot to force a frame, or measure with JS.
- At 375 px, check `document.documentElement.scrollWidth === innerWidth`.
