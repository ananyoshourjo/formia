# Changelog

## Unreleased

## [1.6.0] - 2026-09-15

### Added

- Added a desktop Div tool that inserts transparent, grey-bordered containers by clicking for a 100×100 starting size or dragging to draw an explicit size.
- Added Select-tool support for moving existing elements into inserted Divs.
- Added persistent layer ancestry expansion so selecting a nested element reveals it without collapsing previously opened branches.

### Changed

- Renamed the desktop Box insertion tool to Div and added a plus cursor while creating one.
- Disabled native canvas selection and HTML dragging for editing tools while preserving them for Interact.

## [1.5.0] - 2026-09-15

### Added

- Added a desktop Box tool for inserting transparent, grey-bordered containers that start at 100×100 and resize around their contents.
- Added Box layers to the Layers panel with nesting, reparenting, and expandable child branches.

### Fixed

- Fixed Select-tool drops into inserted Boxes and improved sizing for width-constrained children.

## [1.4.0] - 2026-09-15

### Added

- Added Select-tool canvas drop support for inserted text layers, allowing new paragraphs to be reparented into suitable rendered containers while preserving free movement.

### Changed

- Kept inserted text position-aware when its parent changes so the paragraph remains at the drop location.

## [1.3.0] - 2026-09-15

### Added

- Added desktop text insertion that creates new `<p>` layers at the chosen canvas position and keeps them freely movable with the Select tool.
- Added inserted text layers to the Layers panel, including structural reparenting support.

### Changed

- Separated the primary desktop editor shell from the intentionally limited browser demo.
- Refined positioning inset controls with directional arrow icons and removed the non-editable anchor summary.

## [1.2.1] - 2026-09-13

### Fixed

- Added the hand cursor to the landing-page action buttons so their clickability is clear on hover.

## [1.2.0] - 2026-09-13

### Added

- Added direct text editing in the browser workspace with staged preview changes.
- Added collapsible layer ancestry controls so selected content can remain visible while exploring the layer tree.

### Changed

- Updated the landing-page View Demo action to open the browser workspace in a new tab.

## [1.1.1] - 2026-09-12

### Fixed

- Hid native scrollbar visuals across the workspace while preserving panel and menu scrolling.

## [1.1.0] - 2026-09-12

### Added

- Added a public Formia landing page with direct browser-demo and Windows download actions.
- Added a browser version of the Formia workspace with an inspectable built-in dashboard demo.

### Changed

- Preserved the native project workflow for Electron builds while adapting canvas inspection and editing controls for the browser demo.

## [1.0.1] - 2026-09-11

### Fixed

- Fixed Windows project-server startup by launching allowlisted package-manager commands through the Windows command shell.
- Added regression coverage for platform-specific package-manager launch behavior.

## [1.0.0] - 2026-09-10

### Added

- Added a safer, more resilient desktop workflow for opening local React projects and running their development servers.
- Added first-run guidance, Codex readiness feedback, actionable server diagnostics, Build cancellation, and a ten-minute Build safety timeout.
- Added temporary visual previews with reset support, persistent layer operations, and typed renderer-to-inspector contracts.
- Added a Windows application icon, installer metadata, checksum generation, project documentation, security guidance, and CI checks.

### Changed

- Refined the Properties panel across layout, spacing, typography, color, border, positioning, transform, and sizing controls.
- Improved numeric scrubbing, font discovery and fallback preservation, preview recovery after rerenders, and project session isolation.
- Hardened desktop IPC, local project path handling, process shutdown, navigation, permissions, and error recovery.
- Reworked the README and GitHub project description around Formia’s visual-editing workflow.

### Fixed

- Fixed stale preview selections and staged changes after project rerenders.
- Removed obsolete starter UI and the previous application icon asset.

## [0.11.0] - 2026-09-10

### Added

- Added first-run guidance and Codex readiness feedback.
- Added actionable project-server errors with retry and copyable diagnostics.
- Added Build cancellation and a ten-minute safety timeout.
- Added complete Windows product metadata, a release-resolution application icon, an assisted installer, and SHA-256 checksum generation.
- Added project documentation, security guidance, and an MIT license.

### Changed

- Hardened desktop IPC validation, process shutdown, navigation, permissions, and project session isolation.
- Removed unused production dependencies, starter assets, and obsolete UI components.

## [0.10.0] - 2026-09-09

### Added

- Added linked spacing controls for paired margin and padding edges.
- Added responsive Build button feedback while Codex is working.

### Changed

- Improved numeric scrubbing across spacing controls and preserved CSS units when committing values.
- Improved the font picker with accurate installed font-family discovery, faster loading, and better font previews.
- Refined the Properties panel controls, typography fields, color picker, and layout editing interactions.

## [0.9.0] - 2026-09-08

### Added

- Added Figma-style numeric scrubbing across numeric Properties panel controls, including icon-led typography fields.
- Added semantic font-family intent for Codex so primary-font changes preserve existing fallback stacks.

### Changed

- Updated the application-wide font stack to use Inter first while retaining system fallbacks.
- Restyled inset controls to match the integrated labeled size fields.
- Removed the redundant File, Edit, View, and Help menu from the workspace top bar.

## [0.8.0] - 2026-09-07

### Added

- Added contextual Flex and Grid layout controls, including display mode, direction, wrapping, alignment, spacing, and grid item placement.
- Added dropdown-backed value selection for CSS sizing, spacing, stacking, and Grid placement controls.

### Changed

- Reorganized the Layout inspector with a compact alignment matrix and consistent labeled controls.
- Refined the Properties panel controls, dropdowns, color fields, and canvas page settings for a more consistent editing workflow.

### Fixed

- Preserved authored CSS values such as `auto`, numeric sizing, gaps, and z-index values when inspecting and editing elements.

## [0.7.0] - 2026-09-04

### Added

- Added Interact, Select, and Text tools for switching between normal canvas use, element inspection, and inline text editing.
- Added live hover feedback and text editing support for selected rendered elements.

### Changed

- Refined the canvas, Layers panel, and workspace tool presentation around the new editing modes.

## [0.6.0] - 2026-09-04

### Added

- Added manual Refresh app and Restart server actions to the Build menu.
- Added a custom desktop title bar with window controls, workspace navigation, and collapsible sidebars.

### Changed

- Refined the desktop workspace shell and canvas presentation around the Layers, canvas, and Properties surfaces.

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
