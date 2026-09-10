const { cpSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const projectRoot = join(__dirname, "..");
const stagingRoot = join(projectRoot, ".desktop-build");
const sourcePackage = require(join(projectRoot, "package.json"));

async function stageDesktopApp() {
  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(stagingRoot, { recursive: true });
  cpSync(join(projectRoot, "electron"), join(stagingRoot, "electron"), {
    recursive: true,
  });
  cpSync(join(projectRoot, "out"), join(stagingRoot, "out"), {
    recursive: true,
  });
  mkdirSync(join(stagingRoot, "build"), { recursive: true });
  cpSync(
    join(projectRoot, "assets", "formia-icon.ico"),
    join(stagingRoot, "build", "icon.ico"),
  );

  writeFileSync(
    join(stagingRoot, "package.json"),
    JSON.stringify(
      {
        name: sourcePackage.name,
        version: sourcePackage.version,
        description: sourcePackage.description,
        author: sourcePackage.author,
        license: sourcePackage.license,
        private: true,
        main: sourcePackage.main,
      },
      null,
      2,
    ),
  );
}

stageDesktopApp().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
