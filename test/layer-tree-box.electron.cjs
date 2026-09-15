// Run with: electron test/layer-tree-box.electron.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Electron main-process test */
const { app, BrowserWindow, webContents } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

app.whenReady().then(async () => {
  const preload = pathToFileURL(path.join(__dirname, '../electron/inspector-preload.cjs')).href;
  const fixture = '<style>body{margin:0}#shell{position:absolute;left:40px;top:40px;width:80px;height:80px}#source{width:100%;height:80px;background:#ddd;white-space:nowrap}</style><div id="shell"><div id="source">Source content that should determine the inserted Box width</div></div>';
  const host = new BrowserWindow({
    show: false,
    width: 900,
    height: 650,
    webPreferences: { webviewTag: true, contextIsolation: false, nodeIntegration: false },
  });
  const hostPage = host.webContents;
  const input = (canvas, type, x, y) => canvas.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
  const hostEvaluate = (code) => hostPage.executeJavaScript(code);
  const hostMarkup = `<webview id="canvas" style="display:block;width:900px;height:650px" preload="${preload}" src="data:text/html,${encodeURIComponent(fixture)}"></webview><script>window.layerMessages=[];document.querySelector('#canvas').addEventListener('ipc-message',event=>window.layerMessages.push({channel:event.channel,args:event.args}));</script>`;

  try {
    await hostPage.loadURL('data:text/html,' + encodeURIComponent(hostMarkup));
    let canvasId = null;
    for (let attempt = 0; attempt < 30 && !canvasId; attempt += 1) {
      await settle();
      canvasId = await hostEvaluate('document.querySelector("#canvas").getWebContentsId()');
    }
    assert.ok(canvasId, 'webview becomes available');
    const canvas = webContents.fromId(canvasId);
    assert.ok(canvas, 'canvas webContents is available');

    await hostEvaluate('document.querySelector("#canvas").send("formia:set-tool", "box")');
    await settle();
    input(canvas, 'mouseDown', 250, 250);
    input(canvas, 'mouseUp', 250, 250);
    await settle();
    await canvas.executeJavaScript('document.querySelector("[data-formia-inserted-box]").appendChild(document.querySelector("#source"))');
    await settle();
    await hostEvaluate('document.querySelector("#canvas").send("formia:get-layer-tree")');
    await settle();

    const dimensions = JSON.parse(await canvas.executeJavaScript('JSON.stringify(document.querySelector("[data-formia-inserted-box]").getBoundingClientRect().toJSON())'));
    assert.ok(dimensions.width > 100, 'Box width expands past its default when the child is width-constrained');
    const messages = JSON.parse(await hostEvaluate('JSON.stringify(window.layerMessages)'));
    const trees = messages.filter((message) => message.channel === 'formia:layer-tree');
    const latest = trees.at(-1)?.args?.[0];
    const findBox = (nodes) => nodes.flatMap((node) => node.inserted === 'box' ? [node] : findBox(node.children));
    const box = findBox(latest.nodes).find((node) => node.children.length > 0);
    assert.ok(box, 'layer tree includes inserted Box children');
    console.log('PASS: layer tree includes inserted Box children');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
