const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const electron = require("electron");

const root = path.join(__dirname, "..");
for (const name of fs.readdirSync(path.join(root, "test")).filter((file) => file.endsWith(".electron.cjs")).sort()) {
  console.log(`Desktop test: ${name}`);
  const result = spawnSync(electron, [path.join(root, "test", name)], { cwd: root, stdio: "inherit", windowsHide: true, timeout: 60000 });
  if (result.error || result.status !== 0) {
    if (result.error) console.error(result.error.message);
    process.exit(result.status || 1);
  }
}
