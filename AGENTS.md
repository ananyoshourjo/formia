<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Formia product workflow

- Treat the Windows desktop app as the primary Formia product and the source of product truth.
- Implement and validate new product features in the desktop app first.
- Treat the browser experience as a separate, intentionally limited demo. Add a web version of a desktop feature only as a later, explicit decision.
- When a feature request does not name a surface, default it to desktop. Ask only when the intended web behavior would materially change the work.
- Do not make the web demo a parity target or allow its limitations to constrain desktop functionality.
