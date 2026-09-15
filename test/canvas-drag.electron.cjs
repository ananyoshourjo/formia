// Run with: electron test/canvas-drag.electron.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Electron main-process test */
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 900, height: 650,
    webPreferences: { preload: path.join(__dirname, '../electron/inspector-preload.cjs'), contextIsolation: true, backgroundThrottling: false } });
  const page = window.webContents;
  const fixture = '<style>body{margin:0}#row{display:flex;gap:20px;padding:40px}article{width:180px;height:160px;background:#eee}span{display:block;padding:30px}</style><main id="row"><article id="a"><span>A</span></article><article id="b"><span>B</span></article><article id="c"><span>C</span></article></main>';
  const evaluate = (code) => page.executeJavaScript(code);
  const order = () => evaluate('Array.from(document.querySelector("#row").children, el => el.id).join("")');
  const input = (type, x, y) => page.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
  const settle = () => new Promise(resolve => setTimeout(resolve, 80));
  async function reset() {
    await page.loadURL('data:text/html,' + encodeURIComponent(fixture));
    page.send('formia:set-tool', 'select');
    await settle();
  }
  async function start() {
    // Select the card, then start over its nested label.
    input('mouseDown', 100, 170); input('mouseUp', 100, 170);
    await settle();
    input('mouseDown', 100, 80);
    input('mouseMove', 416, 100);
    await settle();
  }
  try {
    await reset();
    await start();
    input('mouseUp', 416, 100);
    await settle();
    assert.equal(await order(), 'bac', 'horizontal drag moves the selected card, not its label');
    assert.equal(await evaluate('document.querySelector("#a > span").textContent'), 'A');

    await reset(); await start();
    page.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    input('mouseUp', 416, 100); await settle();
    assert.equal(await order(), 'abc', 'Escape cancels without moving');

    await reset(); await start();
    await evaluate('window.dispatchEvent(new Event("blur"))');
    input('mouseUp', 416, 100); await settle();
    assert.equal(await order(), 'abc', 'blur cancels without moving');

    await reset(); await start();
    // Release at a different destination without an intervening animation frame.
    input('mouseMove', 616, 100); input('mouseUp', 616, 100);
    await settle();
    assert.equal(await order(), 'bca', 'release resolves the final pointer position');

    await reset();
    await evaluate('document.querySelector("#row").style.flexDirection = "column"');
    input('mouseDown', 100, 170); input('mouseUp', 100, 170); await settle();
    input('mouseDown', 100, 80); input('mouseMove', 100, 376); await settle();
    input('mouseUp', 100, 376); await settle();
    assert.equal(await order(), 'bac', 'vertical reorder remains functional');

    await reset(); await start();
    page.send('formia:set-tool', 'interact'); await settle();
    input('mouseUp', 416, 100); await settle();
    assert.equal(await order(), 'abc', 'changing tools cancels the pending move');
    console.log('PASS: horizontal and vertical reorder, nested selection, Escape, blur, final release position, tool switch');
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
