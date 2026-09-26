# Release checklist

## Versioning

Formia uses Semantic Versioning in `MAJOR.MINOR.PATCH` order and publishes tags as `vMAJOR.MINOR.PATCH`.

- Increment `PATCH` for backward-compatible fixes.
- Increment `MINOR` for backward-compatible features.
- Increment `MAJOR` for incompatible stable contracts.

Keep `package.json`, `package-lock.json`, the changelog heading, `src/lib/release.ts`, the Git tag, and the GitHub Release on the same version.

A release is complete only when every item below is verified against the exact commit being published.

1. Confirm the intended source diff and version scope.
2. Update `package.json`, `package-lock.json`, and `CHANGELOG.md` together.
3. Run `npm run lint`, `npm run build`, and `npm audit`.
4. Run `npm run build:desktop`.
5. Launch `release/win-unpacked/Formia.exe` and verify project opening, inspector selection, a reversible preview change, Build cancellation, and clean shutdown.
6. Install and uninstall the NSIS package on a clean Windows profile.
7. If a trusted Windows code-signing certificate is configured, verify `Get-AuthenticodeSignature` reports `Valid` for both the application executable and installer.
8. Verify the generated `.sha256` file matches the installer.
9. Tag the verified merge commit and attach both the installer and checksum to the GitHub Release.
10. Download the published assets and verify them once more before announcing the release.

electron-builder uses the standard Windows code-signing environment variables. Signing requires a trusted certificate supplied outside the repository; certificates and passwords must never be committed.
