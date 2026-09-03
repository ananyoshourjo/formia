# Changelog

## [0.5.0] - 2026-09-04

### Added

- Added a desktop-only Layers panel that exposes the rendered structure with React component names where available.
- Added temporary drag-and-drop reordering and reparenting from the Layers panel and the canvas.

### Changed

- Structural preview moves now persist across runtime refreshes, can be reset with the other preview overrides, and are sent to Codex as JSX reorder or reparent requests during Build.
- Improved desktop canvas sizing for tall rendered pages.

## [0.4.0] - 2026-09-03

### Added

- Added focused border controls for style, width, color, and radius to the visual inspector.
- Added a Box Sizing selector to Layout with Content-box and Border-box options.

### Changed

- Reorganized editable properties by purpose and removed the separate Computed styles section.

## [0.3.0] - 2026-09-03

### Added

- Added a functional Foreground and Background color picker with saturation/value, hue, transparency, HEX/RGB/HSL formats, eyedropper support, and swatches.
- Expanded the inspector with richer computed typography, spacing, and layout controls.
- Added installed-font discovery to the desktop inspector.

### Changed

- Standardized inspector labels and field layout for a clearer visual editing workflow.
