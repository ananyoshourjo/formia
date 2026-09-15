// Run with: electron test/inserted-box-drop-existing.electron.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Electron main-process test */
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 900,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, '../electron/inspector-preload.cjs'),
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });
  const page = window.webContents;
  const fixture = '<style>body{margin:0}#source{position:absolute;left:40px;top:40px;width:80px;height:80px;background:#ddd}</style><div id="source">Source</div>';
  const evaluate = (code) => page.executeJavaScript(code);
  const input = (type, x, y) => page.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

  try {
    await page.loadURL('data:text/html,' + encodeURIComponent(fixture));
    page.send('formia:set-tool', 'div');
    await settle();
    input('mouseDown', 250, 250);
    input('mouseUp', 250, 250);
    await settle();

    const boxExists = await evaluate('Boolean(document.querySelector("[data-formia-inserted-box]"))');
    assert.equal(boxExists, true, 'Div tool inserts a target div');

    page.send('formia:set-tool', 'select');
    await settle();
    input('mouseDown', 70, 70);
    input('mouseUp', 70, 70);
    await settle();
    input('mouseDown', 70, 70);
    input('mouseMove', 280, 280);
    input('mouseUp', 280, 280);
    await settle();

    const parentId = await evaluate('document.querySelector("#source").parentElement?.getAttribute("data-formia-inserted-box")');
    assert.ok(parentId, 'Existing element can be dropped inside an inserted Box');
    console.log('PASS: existing element drops inside inserted Box');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
