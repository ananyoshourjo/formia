# Formia

## Product direction

Formia is a desktop-first visual development environment for local React projects. Instead of replacing the project's runtime or converting it into a separate design document, Formia will load the real application, let the user select rendered React elements, show how they relate to the source, and eventually apply visual changes directly to the project's code.

The core principle is that the connected project remains the source of truth. Formia should preserve its framework, dependencies, application context, routing, state, and styles.

## What exists today

The current prototype is a minimal Next.js and shadcn/ui interface packaged as an Electron desktop application.

- The home screen contains a **Select project** action and a persistent list of up to five recently opened project folders.
- Selecting a folder opens a dedicated project workspace and displays its folder name.
- The workspace has a full-width application canvas, a back button, a development-server URL field, reload and external-open actions, and a full-height properties sidebar fixed to the right.
- Selecting a project starts its detected local `dev`, `start`, or `serve` script, chooses a free local port, and loads the discovered URL in the canvas.
- In a normal browser, the application is displayed in an iframe.
- In the Electron app, the application is displayed in a webview with an inspector preload script.
- Inspect mode can highlight and select a rendered DOM element in the Electron canvas.
- The properties sidebar displays the selected element's identity, dimensions, computed styles, HTML attributes, and—when React runtime information is discoverable—the component name and a compact view of its props.
- Selected properties can be edited as temporary preview overrides. The current preview editor supports class names, text content, and a constrained set of inline CSS properties, with per-property and full-preview reset actions.
- Preview overrides are tracked as staged changes without modifying the project source. The **Build** action sends the selected element, runtime context, and staged changes to Codex in the background.
- The Electron main process starts a local Codex app-server for the selected project, allows it to make source-level changes inside that project, reports working/applied/failed status, and refreshes the preview after a successful turn.
- The application preview sits on an infinite-style canvas with a 1440×900 artboard. The canvas supports panning, mouse-wheel zoom, trackpad scrolling, pinch zooming, and zoom from 10% through 400% with pointer-centered smoothing.
- The earlier component-folder scanner and component inventory have been removed because Formia is now centered on the whole running application rather than isolated component discovery.

## Current limitations

- Recent project entries are stored locally in the Formia renderer. They retain the folder path but are not synchronized across machines or users.
- Server startup supports common npm, pnpm, yarn, and bun projects with Next.js and Vite-specific host and port arguments; unusual project scripts may still require the manual URL field.
- Browser mode can render the app but cannot use the Electron-only element inspector.
- Preview overrides are runtime-only and disappear when the canvas is reloaded, the project is reopened, or the preview is reset. They become source changes only after the user invokes Build and Codex completes successfully.
- The background Codex bridge requires the local `codex` CLI to be installed and authenticated. Its current source edit is guided by runtime evidence and the staged diff; reliable AST-level source mapping and a user-facing source diff are not implemented yet.
- Codex is currently started with workspace-write access scoped to the selected project and no approval prompts. Formia does not yet create a dedicated backup, commit, or rollback point for each generated change.
- React component detection relies on private runtime Fiber fields. It is useful for a prototype but is not a stable public React API and may vary by React version, build mode, or renderer.
- Source locations are not consistently available, especially in production builds or without suitable source maps.
- The inspector does not yet map a selection reliably to an editable JSX node or CSS declaration; the Codex prompt provides context and asks Codex to choose the cleanest source implementation.
- Cross-origin behavior, authentication, nested iframes, portals, shadow DOM, canvas-rendered interfaces, and server-rendered boundaries may limit inspection.
- The desktop package has a focused startup and canvas interaction check, but broader project coverage and failure recovery still need testing.

## What we plan to build

### 1. Real project attachment

- Use Electron's native folder picker and retain the absolute project path.
- Validate the selected folder and read its package metadata without changing project files.
- Save and reopen recent projects.
- Detect likely development commands and ports, start and stop the project server, and save recent project folders for one-click reopening.

### 2. Reliable application canvas

- Connect a project to its running development server.
- Add clear loading, disconnected, and runtime-error states.
- Support common React environments such as Next.js and Vite without requiring permanent instrumentation in the target project.
- Verify navigation, reload, responsive viewport sizing, and development-server reconnection inside the desktop canvas.

### 3. Selection and inspection

- Make hover and selection stable across navigation and rerenders.
- Build a dependable bridge from DOM elements to React component boundaries.
- Show component hierarchy, props, DOM attributes, layout, typography, spacing, colors, and relevant source locations.
- Clearly distinguish values inherited from parents, computed by CSS, supplied as props, or produced at runtime.

### 4. Source mapping

- Resolve a selected runtime element to the correct local JSX/TSX and style source.
- Parse source code with an AST rather than editing strings.
- Handle composed shadcn components, Tailwind classes, CSS modules, inline styles, and repeated component instances.
- Detect ambiguous mappings and refuse unsafe changes instead of guessing.

### 5. Visual editing

- Continue expanding constrained, high-confidence preview edits such as text, spacing, dimensions, colors, typography, and simple props.
- Convert staged preview changes into a precise source diff before writing.
- Add stale-file checks, undo, recoverable backups, and an explicit review step around Codex-generated changes.
- Let the project's existing hot reload display the result immediately and verify that the intended rendered change survived the source edit.

### 6. IDE-grade workflow

- Add project files and component hierarchy only when they support the visual workflow.
- Surface build and runtime errors in context.
- Add responsive previews, selection breadcrumbs, history, and source opening.
- Keep the interface utilitarian and avoid unrelated design, document, or collaboration features until the visual code-editing loop is dependable.

## Current milestone

The current prototype supports a preview-first edit loop:

1. Attach a real local project path.
2. Connect to its running development server.
3. Render the full application in the Electron canvas.
4. Select an element reliably.
5. Show its React component, props, DOM and computed properties, and best available source location.
6. Apply temporary visual changes without touching source files.
7. Send staged changes to a background Codex task and refresh the preview after source edits are applied.

The next milestone is a guarded source-edit loop with reliable selection-to-source mapping, a reviewable diff, and rollback protection.

## Current stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Electron
- electron-builder

## Development commands

```bash
npm run dev
npm run lint
npm run build
npm run package:desktop
npm run build:desktop
```
