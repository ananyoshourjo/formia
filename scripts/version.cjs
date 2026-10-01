const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const writeJson = (file, value) => fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);
const manifest = readJson("package.json");
const lock = readJson("package-lock.json");
const requested = process.argv[2];
const version = requested === "--check" ? manifest.version : requested;
if (!/^\d+\.\d+\.\d+$/.test(version || "")) throw new Error("Use node scripts/version.cjs PHASE.MAJOR.MINOR or --check.");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const changelogVersion = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
if (changelogVersion !== version) throw new Error(`Latest changelog version ${changelogVersion} does not match ${version}.`);
const releaseFile = path.join(root, "src/lib/release.ts");
const releaseSource = `export const windowsInstallerUrl = "https://github.com/ananyoshourjo/formia/releases/download/v${version}/Formia-${version}-Setup.exe";\n`;
if (requested !== "--check") {
  manifest.version = version;
  lock.version = version;
  lock.packages[""].version = version;
  writeJson("package.json", manifest);
  writeJson("package-lock.json", lock);
  fs.writeFileSync(releaseFile, releaseSource);
}
if ([manifest.version, lock.version, lock.packages[""].version].some((value) => value !== version)
  || fs.readFileSync(releaseFile, "utf8").trim() !== releaseSource.trim()) throw new Error("Release version surfaces are inconsistent.");
console.log(`Release version verified: v${version}`);
