// Run with: electron test/inserted-image.electron.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Electron main-process test */
const { app, BrowserWindow, webContents } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

app.whenReady().then(async () => {
  const preload = pathToFileURL(path.join(__dirname, '../electron/inspector-preload.cjs')).href;
  const fixture = '<style>body{margin:0}#target{position:absolute;left:40px;top:40px;width:180px;height:140px;background:#eee}</style><div id="target"></div>';
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
  const hostMarkup = `<webview id="canvas" style="display:block;width:900px;height:650px" preload="${preload}" src="data:text/html,${encodeURIComponent(fixture)}"></webview><script>window.layerMessages=[];window.canvasReady=false;const canvasElement=document.querySelector('#canvas');canvasElement.addEventListener('dom-ready',()=>{window.canvasReady=true});canvasElement.addEventListener('ipc-message',event=>window.layerMessages.push({channel:event.channel,args:event.args}));</script>`;

  try {
    await hostPage.loadURL('data:text/html,' + encodeURIComponent(hostMarkup));
    let canvasId = null;
    for (let attempt = 0; attempt < 30 && !canvasId; attempt += 1) {
      await settle();
      const canvasState = await hostEvaluate('({ id: document.querySelector("#canvas").getWebContentsId(), ready: window.canvasReady })');
      if (canvasState.ready) canvasId = canvasState.id;
    }
    assert.ok(canvasId, 'webview becomes available');
    const canvas = webContents.fromId(canvasId);
    assert.ok(canvas, 'canvas webContents is available');

    await hostEvaluate('document.querySelector("#canvas").send("formia:set-tool", "image")');
    await settle();
    assert.equal(await canvas.executeJavaScript('getComputedStyle(document.body).userSelect'), 'none', 'Image tool disables native canvas selection');
    assert.equal(await canvas.executeJavaScript('window.dispatchEvent(new Event("dragstart", { cancelable: true }))'), false, 'Image tool disables native HTML dragging');

    input(canvas, 'mouseDown', 300, 250);
    input(canvas, 'mouseUp', 300, 250);
    await settle();
    const defaultImage = JSON.parse(await canvas.executeJavaScript('JSON.stringify(document.querySelector("[data-formia-inserted-image]").getBoundingClientRect().toJSON())'));
    assert.equal(defaultImage.width, 240, 'click-created image uses the lightweight default width');
    assert.equal(defaultImage.height, 160, 'click-created image uses the lightweight default height');
    assert.match(await canvas.executeJavaScript('document.querySelector("[data-formia-inserted-image]").getAttribute("src")'), /^data:image\/svg\+xml/, 'click-created image uses an inline placeholder');

    input(canvas, 'mouseDown', 700, 480);
    input(canvas, 'mouseMove', 860, 560);
    input(canvas, 'mouseUp', 860, 560);
    await settle();
    const draggedImage = JSON.parse(await canvas.executeJavaScript('JSON.stringify(document.querySelectorAll("[data-formia-inserted-image]")[1].getBoundingClientRect().toJSON())'));
    assert.equal(draggedImage.width, 160, 'drag-created image uses the drawn width');
    assert.equal(draggedImage.height, 80, 'drag-created image uses the drawn height');

    const firstImageId = await canvas.executeJavaScript('document.querySelector("[data-formia-inserted-image]").getAttribute("data-formia-inserted-image")');
    await canvas.executeJavaScript(`document.querySelector('#target').appendChild(document.querySelector('[data-formia-inserted-image][data-formia-inserted-image="${firstImageId}"]'))`);
    await hostEvaluate('document.querySelector("#canvas").send("formia:get-layer-tree")');
    await settle();
    const messages = JSON.parse(await hostEvaluate('JSON.stringify(window.layerMessages)'));
    const latestTree = messages.filter((message) => message.channel === 'formia:layer-tree').at(-1)?.args?.[0];
    const findImage = (nodes, parent = null) => nodes.flatMap((node) => node.inserted === 'image' ? [{ node, parent }] : findImage(node.children, node));
    const imageLayer = findImage(latestTree.nodes).find(({ node }) => node.children.length === 0);
    assert.ok(imageLayer, 'layer tree includes the inserted image');
    assert.equal(imageLayer.parent?.tagName, 'div', 'inserted image remains visible under its reparented parent');

    const secondImageId = await canvas.executeJavaScript('document.querySelectorAll("[data-formia-inserted-image]")[1].getAttribute("data-formia-inserted-image")');
    const replacement = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"></svg>')}`;
    const samplePath = 'C:\\images\\sample.svg';
    await hostEvaluate(`document.querySelector("#canvas").send("formia:replace-image", { insertionId: ${JSON.stringify(firstImageId)}, src: ${JSON.stringify(replacement)}, sourcePath: ${JSON.stringify(samplePath)}, fileName: "sample.svg", mimeType: "image/svg+xml" })`);
    await settle();
    assert.equal(await canvas.executeJavaScript('document.querySelector("[data-formia-inserted-image]").getAttribute("src")'), replacement, 'Replace updates the preview image without opening an upload surface during insertion');
    const replacedSize = JSON.parse(await canvas.executeJavaScript('JSON.stringify(document.querySelector("[data-formia-inserted-image]").getBoundingClientRect().toJSON())'));
    assert.equal(replacedSize.width, 120, 'click-created image adopts the uploaded intrinsic width');
    assert.equal(replacedSize.height, 80, 'click-created image adopts the uploaded intrinsic height');
    const selectedMessages = JSON.parse(await hostEvaluate('JSON.stringify(window.layerMessages)')).filter((message) => message.channel === 'formia:element-updated');
    const latestSelection = selectedMessages.at(-1)?.args?.[0];
    const imageChange = latestSelection.previewChanges.flatMap((item) => item.changes || []).find((change) => change.elementType === 'image');
    assert.equal(imageChange.assetFileName, 'sample.svg', 'replacement metadata is staged for Build');
    assert.equal(imageChange.assetPath, 'C:\\images\\sample.svg', 'Build receives the selected asset path, not image bytes');
    assert.equal(imageChange.placeholderSrc, null, 'a replaced image no longer stages the placeholder source');
    assert.equal(imageChange.fitContents, true, 'click-created image records intrinsic-size behavior');

    const draggedPath = 'C:\\images\\dragged.svg';
    await hostEvaluate(`document.querySelector("#canvas").send("formia:replace-image", { insertionId: ${JSON.stringify(secondImageId)}, src: ${JSON.stringify(replacement)}, sourcePath: ${JSON.stringify(draggedPath)}, fileName: "dragged.svg", mimeType: "image/svg+xml" })`);
    await settle();
    const draggedSizeAfterUpload = JSON.parse(await canvas.executeJavaScript('JSON.stringify(document.querySelectorAll("[data-formia-inserted-image]")[1].getBoundingClientRect().toJSON())'));
    assert.equal(draggedSizeAfterUpload.width, 160, 'drag-created image keeps its drawn width after upload');
    assert.equal(draggedSizeAfterUpload.height, 80, 'drag-created image keeps its drawn height after upload');
    console.log('PASS: placeholder image insertion, drawing, layer visibility, reparenting, and replacement staging');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
