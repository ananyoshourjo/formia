# Formia

Formia is a Windows desktop visual editor for local React applications.

Open a running project, select an element, adjust it visually, and use **Build** to ask Codex to apply the change to the real source code. Formia is designed to make small interface changes feel direct: see the result first, then let your coding agent handle the implementation.

The connected project remains the source of truth. Formia does not turn your project into a proprietary design file or replace its framework, routing, state, dependencies, or component system.

## What you can do

- Open local Next.js and Vite projects from the desktop app.
- Inspect the rendered page and its Layers tree.
- Switch between Interact, Select, and Text tools.
- Edit layout, sizing, spacing, typography, colors, borders, positioning, and transforms.
- Scrub numeric properties with the mouse while keeping their values editable.
- Make temporary preview changes, reset them, or keep refining them before Build.
- Reorder, duplicate, and delete layers in the visual preview.
- Ask Codex to implement the staged visual changes in the selected project.
- Restart a project server and copy actionable diagnostics when something goes wrong.

## How it works

1. Choose **Open project** and select a local React project.
2. Formia starts or reconnects to the project’s development server.
3. Select an element in the canvas or Layers panel.
4. Adjust its properties and review the temporary preview.
5. Press **Build** to send the requested visual intent to Codex.
6. Formia refreshes the project so the source implementation becomes the new baseline.

Preview changes are intentionally temporary. Use **Build → Reset design** to discard them without modifying the project source.

## Requirements

- Windows.
- A local React project with its dependencies installed.
- A `dev`, `start`, or `serve` script in the project’s `package.json`.
- npm, pnpm, yarn, or Bun for the project’s package manager.
- The Codex CLI installed, available on `PATH`, and signed in if you want to use Build.

Projects can be opened and edited visually when Codex is unavailable. Build becomes available after Formia confirms that Codex is ready.

## Desktop first, web later

The desktop app is the primary product and the place where new features are built and validated first. The browser demo is a separate, limited preview using a bundled example project. It does not open local projects, modify source files, or provide Build. Web-demo versions of desktop features are optional follow-up work, not a parity requirement.

## Safety and project boundary

Formia is intended for projects you trust. It starts the selected project’s development server locally. When you press Build, Codex receives workspace-write access to that selected project so it can implement the requested change.

Formia does not upload your project as part of the editor workflow. Do not open an untrusted project. Read [SECURITY.md](./SECURITY.md) for the complete security boundary and reporting guidance.

## Development

Install dependencies and start the renderer and desktop shell:

```powershell
npm ci
npm run dev
```

Run the main checks:

```powershell
npm run lint
npm test
npm run build
npm audit --audit-level=high
```

Build the Windows desktop artifacts:

```powershell
npm run build:desktop
```

The unpacked application is written to `release\win-unpacked\Formia.exe`. The installer and checksum are written to `release\`.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the implementation map, [project.md](./project.md) for product scope, and [docs/RELEASE.md](./docs/RELEASE.md) for the stable release checklist.

## Current focus

Formia is focused on precise, local visual edits to existing interfaces. Responsive breakpoint editing, broad component generation, deployment, and collaboration are outside the current product surface and may be explored later.

## License

Formia is available under the [MIT License](./LICENSE).
