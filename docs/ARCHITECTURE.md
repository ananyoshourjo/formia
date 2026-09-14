# Architecture

Formia is one repository with two separate product surfaces. The desktop app is the primary product; the browser app is a deliberately limited demonstration that is developed only after the desktop behavior is working.

## Product surfaces

### Desktop app

The packaged desktop app loads the root route from the Electron static export. `DesktopApp` coordinates the selected local project and Codex availability. `DesktopProjectSelector` owns recent projects and the native project-opening flow. `DesktopWorkspace` supplies the desktop runtime to the shared visual workspace.

The desktop app owns local project access, project-server lifecycle, the Electron inspector, installed-font discovery, native window actions, and the Codex Build flow.

### Web demo

The browser demo lives at `/demo` and mounts `WebDemoApp`. It opens only the bundled Shadcn Admin example through `WebDemoWorkspace`. It can demonstrate temporary visual changes in the browser, but it has no local project picker, project server, Codex connection, or source-writing Build action. Its job is to explain the product, not to mirror desktop feature-for-feature.

## Shared visual workspace

`ProjectWorkspace` is the shared visual editing surface. The desktop and web shells choose its runtime explicitly (`desktop` or `web-demo`); the workspace does not infer the product from the presence of a global bridge. The workspace shares visual editing mechanics while selecting the appropriate canvas host and action controls for each surface.

## Electron main process

The main process owns native folder selection, project validation, development-server lifecycle, window actions, installed-font discovery, and the Codex app-server connection. Renderer access is limited to the APIs exposed by `electron/preload.cjs`; incoming Build and project-path payloads are validated before use.

## Inspector preload

The inspector preload runs inside the project webview. It observes the rendered DOM, supplies Layers and selection details, applies temporary visual overrides, and sends staged visual changes back to the Formia renderer.

## Build flow

1. The inspector collects the current visual changes.
2. The renderer submits the selected project, selected element context, and changes through the desktop bridge.
3. The main process validates that the requested root is the active project.
4. Codex runs with workspace-write access limited to that root.
5. Formia reports progress and refreshes the preview when the Codex turn completes. A running Build can be cancelled and is stopped after ten minutes if it does not complete.

The Build interface is intentionally one action. Internal implementation details are not exposed to designers.

The host renderer is sandboxed. Project webviews can navigate only to loopback development-server URLs, have permission requests denied, and use a project-specific persistent session so cookies are not shared across projects.

## Packaging and development

Next.js produces a static export for Electron. `scripts/stage-desktop.cjs` assembles only the renderer export, Electron files, application metadata, and icon before electron-builder creates the unpacked application and NSIS installer. The release script also writes a SHA-256 checksum beside the installer.

The normal web build keeps the landing page at `/` and the browser demo at `/demo`. The desktop build sets `FORMIA_ELECTRON_BUILD=1`, makes the root route `DesktopApp`, and packages the exported renderer with Electron. `npm run dev` follows the desktop-first path by starting the renderer with the same flag; use `npm run dev:web` when working on the browser surface.
