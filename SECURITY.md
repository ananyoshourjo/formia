# Security

## Supported version

Security fixes are applied to the latest published Formia release.

## Trust boundary

Formia runs local React development servers and displays their output inside an Electron webview. Pressing Build starts Codex with workspace-write access limited to the project currently selected in Formia.

Only open projects you trust. A project can execute its own development scripts, and Build can modify files inside that project.

Formia does not require its own hosted account. Build uses the locally installed Codex CLI, which sends the context needed for the requested change to the configured Codex service under that service's terms and privacy controls.

## Reporting a vulnerability

Please report security issues privately through GitHub's security advisory feature for this repository. Include reproduction steps, affected versions, and any relevant logs. Do not publish an exploit before a fix is available.
