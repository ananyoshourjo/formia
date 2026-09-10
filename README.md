# Formia

Formia is a Windows desktop visual editor for local React projects. Open a project, select an element, make a focused visual change, and use **Build** to ask Codex to implement that change in the real source code.

The connected project remains the source of truth. Formia does not convert it into a proprietary design file or replace its framework, routing, state, dependencies, or component system.

## What Formia supports

- Local Next.js and Vite projects with a `dev`, `start`, or `serve` script.
- npm, pnpm, yarn, and Bun package managers.
- Live interaction, element selection, inline text editing, and a rendered Layers tree.
- Focused controls for layout, spacing, typography, color, borders, and simple structural edits.
- Temporary visual previews followed by Codex-backed source implementation.

Formia is intentionally focused on small visual changes to existing interfaces. Responsive breakpoint editing, broad component generation, deployment, and collaboration are planned after v1.

## Requirements

- A Windows desktop.
- A local React project whose dependencies are already installed.
- The Codex CLI installed, available on `PATH`, and signed in for Build.

Formia checks Codex availability when it starts. Projects can still be opened and edited visually when Codex is unavailable, but Build remains disabled until Codex is ready.

## Using Formia

1. Open Formia and choose **Open project**.
2. Select a local Next.js or Vite project.
3. Wait for its development server to appear in the canvas.
4. Use **Interact**, **Select**, or **Text** to work with the running application.
5. Make a visual change in Properties.
6. Press **Build** to have Codex apply the requested change to the project.

Use **Build → Reset design** to discard temporary preview changes. Server failures include retry and copyable diagnostics.

## Development

```powershell
npm install
npm run dev
```

Useful checks and packaging commands:

```powershell
npm run lint
npm run build
npm run package:desktop
npm run build:desktop
```

Desktop output is written to `release\win-unpacked\Formia.exe`; the installer is written to `release\Formia-<version>-Setup.exe`.

See [project.md](./project.md) for product scope and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the implementation map.
Stable publication requirements are documented in [docs/RELEASE.md](./docs/RELEASE.md), and notable changes are tracked in [CHANGELOG.md](./CHANGELOG.md).

## Security boundary

Formia starts the selected project's development server and gives Codex workspace-write access to that selected project when the user presses Build. Do not open an untrusted project. See [SECURITY.md](./SECURITY.md) for the full boundary and reporting guidance.

## License

Formia is available under the [MIT License](./LICENSE).
