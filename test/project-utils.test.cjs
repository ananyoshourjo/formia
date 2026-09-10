/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  canonicalizeProjectPath,
  normalizePackageManager,
  packageManagerSpawnConfig,
  normalizeProjectUrl,
} = require("../electron/project-utils.cjs");
const { normalizeCodexBuildRequest } = require("../electron/ipc-contracts.cjs");

test("normalizeProjectUrl only accepts local HTTP(S) URLs", () => {
  assert.equal(normalizeProjectUrl("http://127.0.0.1:3000/"), "http://127.0.0.1:3000/");
  assert.equal(normalizeProjectUrl("http://0.0.0.0:3000"), "http://localhost:3000/");
  assert.equal(normalizeProjectUrl("https://[::1]:3443/preview"), "https://[::1]:3443/preview");
  assert.equal(normalizeProjectUrl("https://example.com"), null);
  assert.equal(normalizeProjectUrl("http://user:pass@127.0.0.1:3000"), null);
  assert.equal(normalizeProjectUrl("file:///etc/passwd"), null);
});

test("normalizePackageManager falls back to known lockfiles", () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "formia-manager-"));
  try {
    assert.equal(normalizePackageManager("evil-command", projectPath), "npm");
    fs.writeFileSync(path.join(projectPath, "pnpm-lock.yaml"), "lockfileVersion: 9");
    assert.equal(normalizePackageManager("evil-command", projectPath), "pnpm");
    assert.equal(normalizePackageManager("pnpm@10.0.0", projectPath), "pnpm");
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});

test("package manager launch uses the Windows shell for command shims", () => {
  assert.deepEqual(packageManagerSpawnConfig("npm", "win32"), { command: "npm", shell: true });
  assert.deepEqual(packageManagerSpawnConfig("pnpm", "linux"), { command: "pnpm", shell: false });
  assert.throws(() => packageManagerSpawnConfig("not-a-package-manager", "win32"), /Unsupported package manager/);
});

test("canonicalizeProjectPath resolves an existing directory", () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "formia-project-"));
  try {
    assert.equal(canonicalizeProjectPath(projectPath), fs.realpathSync.native(projectPath));
    assert.throws(() => canonicalizeProjectPath(path.join(projectPath, "missing")), /unavailable/);
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});

test("normalizeCodexBuildRequest rejects an empty or oversized visual change list", () => {
  assert.throws(() => normalizeCodexBuildRequest({ projectPath: "C:\\project", projectName: "Project", previewChanges: [] }), /at least one/);
  assert.throws(() => normalizeCodexBuildRequest({ projectPath: "C:\\project", projectName: "Project", previewChanges: Array.from({ length: 101 }, () => ({})) }), /too many/);
});
