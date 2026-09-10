# Architecture

Formia has three runtime surfaces.

## Renderer

The Next.js renderer owns the home screen and editor shell. `FormiaApp` coordinates the selected project and Codex availability. `ProjectWorkspace` owns the canvas, Layers, Properties, and visual preview state.

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

## Packaging

Next.js produces a static export for Electron. `scripts/stage-desktop.cjs` assembles only the renderer export, Electron files, application metadata, and icon before electron-builder creates the unpacked application and NSIS installer. The release script also writes a SHA-256 checksum beside the installer.
