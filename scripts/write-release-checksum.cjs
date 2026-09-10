const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const { basename, join } = require("node:path");

const projectRoot = join(__dirname, "..");
const { version } = require(join(projectRoot, "package.json"));
const installerPath = join(projectRoot, "release", `Formia-${version}-Setup.exe`);
const checksumPath = `${installerPath}.sha256`;
const checksum = createHash("sha256").update(readFileSync(installerPath)).digest("hex").toUpperCase();

writeFileSync(checksumPath, `${checksum}  ${basename(installerPath)}\n`);
console.log(`SHA-256 ${checksum}`);
