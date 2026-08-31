const { cpSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const projectRoot = join(__dirname, "..");
const stagingRoot = join(projectRoot, ".desktop-build");
const sourcePackage = require(join(projectRoot, "package.json"));

rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(stagingRoot, { recursive: true });
cpSync(join(projectRoot, "electron"), join(stagingRoot, "electron"), {
  recursive: true,
});
cpSync(join(projectRoot, "out"), join(stagingRoot, "out"), {
  recursive: true,
});

writeFileSync(
  join(stagingRoot, "package.json"),
  JSON.stringify(
    {
      name: sourcePackage.name,
      version: sourcePackage.version,
      private: true,
      main: sourcePackage.main,
    },
    null,
    2,
  ),
);
