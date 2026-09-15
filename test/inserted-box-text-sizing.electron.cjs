// Run with: electron test/inserted-box-text-sizing.electron.cjs
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
  const input = (type, x, y) => page.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
  const evaluate = (code) => page.executeJavaScript(code);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

  try {
    await page.loadURL('data:text/html,' + encodeURIComponent('<style>body{margin:0}</style><main id="root"></main>'));
    page.send('formia:set-tool', 'div');
    await settle();
    input('mouseDown', 250, 250);
    input('mouseUp', 250, 250);
    await settle();

    page.send('formia:set-tool', 'text');
    await settle();
    input('mouseDown', 280, 280);
    input('mouseUp', 280, 280);
    await settle();

    page.send('formia:set-tool', 'select');
    await settle();
    input('mouseDown', 280, 280);
    input('mouseUp', 280, 280);
    await settle();
    input('mouseDown', 280, 280);
    input('mouseMove', 300, 300);
    input('mouseUp', 300, 300);
    await settle();

    const state = await evaluate('JSON.stringify({box: document.querySelector("[data-formia-inserted-box]")?.getBoundingClientRect().toJSON(), child: document.querySelector("[data-formia-inserted-box]")?.firstElementChild?.getBoundingClientRect().toJSON(), childStyle: document.querySelector("[data-formia-inserted-box]")?.firstElementChild?.getAttribute("style"), childCount: document.querySelector("[data-formia-inserted-box]")?.children.length})');
    console.log(state);
    const parsed = JSON.parse(state);
    assert.equal(parsed.childCount, 1, 'Inserted text becomes a child of the Box');
    assert.ok(parsed.box.right >= parsed.child.right, 'Box width encloses inserted text');
    assert.ok(parsed.box.bottom >= parsed.child.bottom, 'Box height encloses inserted text');
    console.log('PASS: inserted text is enclosed by Box in both dimensions');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
