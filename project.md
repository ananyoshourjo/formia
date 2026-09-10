# Formia product scope

## Product promise

Formia is a designer-first visual prompt surface for existing React applications:

> Open the real local project, select something, change it visually, and press Build to have Codex implement the change.

The connected project remains the source of truth. Source details, prompt construction, and implementation work stay behind the interface.

## Version 1 scope

- Windows desktop application.
- Local Next.js and Vite projects.
- npm, pnpm, yarn, and Bun development commands.
- Interact, Select, and Text tools.
- Runtime Layers tree with selection and focused structural editing.
- Layout, spacing, typography, color, border, and content controls.
- Temporary visual preview and reset.
- Codex-backed Build for focused visual changes.
- Clear first-run, Codex availability, project validation, and server recovery states.

Formia v1 is deliberately not a general site builder, IDE, design document, deployment platform, or collaboration suite.

## Post-v1 roadmap

- Responsive viewport and breakpoint-aware editing.
- Browser-based interactive demos using bundled example applications. Browser demos will not edit local files or expose Build; they will point users to the desktop download.
- Additional visual controls and direct manipulation where they simplify common refinements.
- Broader framework and project coverage based on real usage.

## Known boundaries

- Build requires the Codex CLI to be installed and signed in.
- Runtime inspection works best with ordinary DOM-based React interfaces. Cross-origin frames, portals, shadow DOM, canvas-rendered interfaces, and unusual renderers can limit inspection.
- React component names and source hints depend on runtime information exposed by the connected project.
- Preview changes exist in the running page until they are reset, refreshed, or sent to Build.
- Structural previews directly rearrange rendered DOM and are intended as visual instructions for Codex.
- Responsive breakpoint editing is not part of v1.

## Design principles

1. Keep the interface visual and compact.
2. Do not ask designers to manage source diffs or developer workflows.
3. Prefer focused, understandable controls over feature breadth.
4. Keep the connected project and its conventions intact.
5. Make setup and failure states clear without turning Formia into an IDE.
