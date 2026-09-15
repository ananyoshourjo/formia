// Run with: electron test/inserted-div-drag.electron.cjs
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
  const fixture = '<style>body{margin:0}</style><main id="root"></main>';
  const input = (type, x, y) => page.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
  const evaluate = (code) => page.executeJavaScript(code);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

  try {
    await page.loadURL('data:text/html,' + encodeURIComponent(fixture));
    page.send('formia:set-tool', 'div');
    assert.equal(await evaluate('getComputedStyle(document.body).userSelect'), 'none', 'Div tool disables native canvas selection');
    assert.equal(await evaluate('window.dispatchEvent(new Event("dragstart", { cancelable: true }))'), false, 'Div tool disables native HTML dragging');
    await settle();

    input('mouseDown', 150, 150);
    input('mouseUp', 150, 150);
    await settle();
    const defaultSize = JSON.parse(await evaluate('JSON.stringify(document.querySelector("[data-formia-inserted-box]").getBoundingClientRect().toJSON())'));
    assert.equal(defaultSize.width, 100, 'click-created Div starts at 100px wide');
    assert.equal(defaultSize.height, 100, 'click-created Div starts at 100px tall');

    await evaluate(`(() => {
      const parent = document.querySelector('[data-formia-inserted-box]');
      const child = document.createElement('span');
      child.setAttribute('style', 'position:absolute!important;left:0!important;top:0!important;width:180px!important;height:60px!important');
      parent.appendChild(child);
    })()`);
    page.send('formia:get-layer-tree');
    await settle();
    const fittedSize = JSON.parse(await evaluate('JSON.stringify(document.querySelector("[data-formia-inserted-box]").getBoundingClientRect().toJSON())'));
    assert.ok(fittedSize.width >= 180, 'click-created Div inherits the child width');

    input('mouseDown', 450, 350);
    input('mouseMove', 610, 430);
    input('mouseUp', 610, 430);
    await settle();
    const draggedSize = JSON.parse(await evaluate('JSON.stringify(document.querySelectorAll("[data-formia-inserted-box]")[1].getBoundingClientRect().toJSON())'));
    assert.equal(draggedSize.width, 160, 'drag-created Div uses the drawn width');
    assert.equal(draggedSize.height, 80, 'drag-created Div uses the drawn height');

    await evaluate(`(() => {
      const parent = document.querySelectorAll('[data-formia-inserted-box]')[1];
      const child = document.createElement('span');
      child.setAttribute('style', 'position:absolute!important;left:0!important;top:0!important;width:500px!important;height:500px!important');
      parent.appendChild(child);
    })()`);
    page.send('formia:get-layer-tree');
    await settle();
    const fixedSize = JSON.parse(await evaluate('JSON.stringify(document.querySelectorAll("[data-formia-inserted-box]")[1].getBoundingClientRect().toJSON())'));
    assert.equal(fixedSize.width, 160, 'drag-created Div does not inherit child width');
    assert.equal(fixedSize.height, 80, 'drag-created Div does not inherit child height');
    page.send('formia:set-tool', 'text');
    await settle();
    assert.equal(await evaluate('getComputedStyle(document.body).userSelect'), 'none', 'Text tool disables native canvas selection');
    assert.equal(await evaluate('window.dispatchEvent(new Event("dragstart", { cancelable: true }))'), false, 'Text tool disables native HTML dragging');
    page.send('formia:set-tool', 'select');
    await settle();
    assert.equal(await evaluate('getComputedStyle(document.body).userSelect'), 'none', 'Select tool disables native canvas selection');
    assert.equal(await evaluate('window.dispatchEvent(new Event("dragstart", { cancelable: true }))'), false, 'Select tool disables native HTML dragging');
    page.send('formia:set-tool', 'interact');
    await settle();
    assert.notEqual(await evaluate('getComputedStyle(document.body).userSelect'), 'none', 'Interact keeps native canvas selection available');
    assert.equal(await evaluate('window.dispatchEvent(new Event("dragstart", { cancelable: true }))'), true, 'Interact keeps native HTML dragging available');
    console.log('PASS: click-created and drag-created Div sizing modes');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
