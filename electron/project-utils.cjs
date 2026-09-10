const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const supportedPackageManagers = new Set(["npm", "pnpm", "yarn", "bun"]);
const loopbackHostnames = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function normalizeProjectUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.hostname === "") return null;
    if (["0.0.0.0", "[::]", "::"].includes(url.hostname)) url.hostname = "localhost";
    if (!loopbackHostnames.has(url.hostname) && !(net.isIP(url.hostname) === 4 && url.hostname.startsWith("127."))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function packageManagerFromLockfiles(projectPath) {
  if (fs.existsSync(path.join(projectPath, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectPath, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(projectPath, "bun.lockb")) || fs.existsSync(path.join(projectPath, "bun.lock"))) return "bun";
  return "npm";
}

function normalizePackageManager(value, projectPath) {
  const declared = typeof value === "string" ? value.trim().split("@")[0] : "";
  return supportedPackageManagers.has(declared) ? declared : packageManagerFromLockfiles(projectPath);
}

function packageManagerSpawnConfig(packageManager, platform = process.platform) {
  if (!supportedPackageManagers.has(packageManager)) throw new Error("Unsupported package manager.");
  return { command: packageManager, shell: platform === "win32" };
}

function canonicalizeProjectPath(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Project path is required.");
  const resolved = path.resolve(value.trim());
  let stats;
  try {
    stats = fs.statSync(resolved);
  } catch {
    throw new Error("The selected project folder is unavailable.");
  }
  if (!stats.isDirectory()) throw new Error("The selected project folder is unavailable.");

  try {
    return fs.realpathSync.native(resolved);
  } catch {
    throw new Error("The selected project folder could not be resolved.");
  }
}

module.exports = {
  canonicalizeProjectPath,
  normalizePackageManager,
  packageManagerSpawnConfig,
  normalizeProjectUrl,
  packageManagerFromLockfiles,
  supportedPackageManagers,
};
