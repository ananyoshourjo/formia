// Run with: electron test/undo-redo.electron.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Electron integration test */
const { app, BrowserWindow, webContents } = require("electron");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

app.whenReady().then(async () => {
  const preload = pathToFileURL(path.join(__dirname, "../electron/inspector-preload.cjs")).href;
  const fixture = '<style>body{margin:0}#row{display:flex;gap:20px;padding:40px}article{width:180px;height:140px;background:#eee}</style><main id="row"><article id="a"><p id="label">Original</p></article><article id="b">B</article><article id="c">C</article></main><input id="input" value="Native">';
  const host = new BrowserWindow({ show: false, width: 1000, height: 700, webPreferences: { webviewTag: true, contextIsolation: false, nodeIntegration: false } });
  const hostPage = host.webContents;
  const markup = `<webview id="canvas" style="width:1000px;height:700px" preload="${preload}" src="data:text/html,${encodeURIComponent(fixture)}"></webview><script>window.messages=[];window.ready=false;const canvas=document.querySelector('#canvas');canvas.addEventListener('dom-ready',()=>window.ready=true);canvas.addEventListener('ipc-message',event=>{window.messages.push({channel:event.channel,args:event.args});if(event.channel==='formia:canvas-keydown'&&event.args[0].code==='KeyZ')canvas.send(event.args[0].shiftKey?'formia:redo':'formia:undo')});</script>`;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
  let canvas;
  const evaluate = async (code) => {
    try { return await canvas.executeJavaScript(code); }
    catch (error) { throw new Error(`Canvas evaluation failed: ${code}`, { cause: error }); }
  };
  const send = async (channel, ...args) => { await hostPage.executeJavaScript(`document.querySelector('#canvas').send(${JSON.stringify(channel)}, ...${JSON.stringify(args)})`); await settle(); };
  const select = async (id) => { const selectionId = await evaluate(`document.querySelector(${JSON.stringify(id)}).getAttribute('data-formia-selection-id')`); assert.ok(selectionId); await send("formia:select-layer", selectionId); return selectionId; };
  const order = () => evaluate('Array.from(document.querySelector("#row").children,element=>element.id).join("")');
  const undo = () => send("formia:undo");
  const redo = () => send("formia:redo");
  const reset = () => send("formia:reset-overrides");
  const style = (property, value) => send("formia:apply-style", { property, value });
  try {
    await hostPage.loadURL("data:text/html," + encodeURIComponent(markup));
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await hostPage.executeJavaScript("window.ready")) break;
      await settle();
    }
    canvas = webContents.fromId(await hostPage.executeJavaScript("document.querySelector('#canvas').getWebContentsId()"));
    assert.ok(canvas);
    await send("formia:set-tool", "select");
    await send("formia:get-layer-tree");
    await evaluate('window.originalA=document.querySelector("#a");window.clicks=0;window.originalA.addEventListener("custom",()=>window.clicks++)');

    await select("#a");
    await style("width", "200px");
    await style("width", "220px");
    await style("height", "170px");
    await undo();
    assert.equal(await evaluate('document.querySelector("#a").style.height'), "", "different properties undo separately");
    assert.equal(await evaluate('document.querySelector("#a").style.width'), "220px");
    await undo();
    assert.equal(await evaluate('document.querySelector("#a").style.width'), "", "continuous same-property edits are grouped");
    await redo(); await redo();
    assert.equal(await evaluate('document.querySelector("#a").style.height'), "170px");
    await undo(); await style("height", "190px"); await redo();
    assert.equal(await evaluate('document.querySelector("#a").style.height'), "190px", "new edits clear redo");
    await reset(); await undo();
    assert.equal(await evaluate('document.querySelector("#a").style.width'), "", "reset clears history");

    await select("#label"); await send("formia:apply-text", "Edited"); await undo();
    assert.equal(await evaluate('document.querySelector("#label").textContent'), "Original");
    await redo(); assert.equal(await evaluate('document.querySelector("#label").textContent'), "Edited");
    await reset();
    const aId = await select("#a");
    await send("formia:delete-selected-layer");
    assert.equal(await order(), "bc"); await undo(); assert.equal(await order(), "abc");
    assert.equal(await evaluate('document.querySelector("#a")===window.originalA'), true, "undo retains actual nodes");
    await evaluate('document.querySelector("#a").dispatchEvent(new Event("custom"))');
    assert.equal(await evaluate("window.clicks"), 1, "listeners survive undo");
    await redo(); assert.equal(await order(), "bc"); await undo();
    await select("#a"); await send("formia:duplicate-selected-layer");
    assert.equal(await evaluate('document.querySelector("#row").children.length'), 4);
    await undo(); assert.equal(await evaluate('document.querySelector("#row").children.length'), 3);
    await redo(); assert.equal(await evaluate('document.querySelector("#row").children.length'), 4);
    await reset();
    const cId = await select("#c");
    const rowId = await evaluate('document.querySelector("#row").getAttribute("data-formia-selection-id")');
    await send("formia:move-layer", { sourceSelectionId: cId, targetParentId: rowId, beforeSelectionId: aId });
    assert.equal(await order(), "cab"); await undo(); assert.equal(await order(), "abc"); await redo(); assert.equal(await order(), "cab");
    await reset();

    await select("#a"); await style("width", "260px");
    canvas.sendInputEvent({ type: "keyDown", keyCode: "Z", modifiers: ["control"] });
    canvas.sendInputEvent({ type: "keyUp", keyCode: "Z", modifiers: ["control"] });
    await settle(); await settle();
    assert.equal(await evaluate('document.querySelector("#a").style.width'), "", "canvas Ctrl+Z routes undo");
    canvas.sendInputEvent({ type: "keyDown", keyCode: "Z", modifiers: ["control", "shift"] });
    canvas.sendInputEvent({ type: "keyUp", keyCode: "Z", modifiers: ["control", "shift"] });
    await settle(); await settle();
    assert.equal(await evaluate('document.querySelector("#a").style.width'), "260px", "canvas Ctrl+Shift+Z routes redo");
    await evaluate('document.querySelector("#input").focus()');
    const before = await hostPage.executeJavaScript("window.messages.filter(item=>item.channel==='formia:canvas-keydown').length");
    canvas.sendInputEvent({ type: "keyDown", keyCode: "Z", modifiers: ["control"] });
    await settle();
    assert.equal(await hostPage.executeJavaScript("window.messages.filter(item=>item.channel==='formia:canvas-keydown').length"), before, "inputs retain native undo");
    await reset();
    await send("formia:set-tool", "div");
    canvas.sendInputEvent({ type: "mouseDown", x: 700, y: 300, button: "left", clickCount: 1 });
    canvas.sendInputEvent({ type: "mouseMove", x: 850, y: 420, button: "left" });
    canvas.sendInputEvent({ type: "mouseUp", x: 850, y: 420, button: "left", clickCount: 1 });
    await settle();
    assert.equal(await evaluate('document.querySelectorAll("[data-formia-inserted-box]").length'), 1);
    await undo(); assert.equal(await evaluate('document.querySelectorAll("[data-formia-inserted-box]").length'), 0, "drawn insertion undoes in one step");
    await redo(); assert.equal(await evaluate('document.querySelector("[data-formia-inserted-box]").style.width'), "150px");
    const boxId = await evaluate('document.querySelector("[data-formia-inserted-box]").getAttribute("data-formia-selection-id")');
    await send("formia:move-layer", { sourceSelectionId: aId, targetParentId: boxId, beforeSelectionId: null });
    assert.equal(await evaluate('document.querySelector("#a").parentElement.hasAttribute("data-formia-inserted-box")'), true);
    await send("formia:select-layer", boxId); await send("formia:delete-selected-layer");
    await undo();
    assert.equal(await evaluate('document.querySelector("[data-formia-inserted-box]").contains(window.originalA)'), true, "deleted inserted parent restores its existing children");
    await undo(); assert.equal(await order(), "abc", "nested reparenting restores original sibling order");
    await redo(); await redo();
    assert.equal(await evaluate('document.querySelectorAll("[data-formia-inserted-box]").length'), 0);
    await reset();
    await send("formia:set-tool", "image");
    canvas.sendInputEvent({ type: "mouseDown", x: 700, y: 300, button: "left", clickCount: 1 });
    canvas.sendInputEvent({ type: "mouseUp", x: 700, y: 300, button: "left", clickCount: 1 });
    await settle();
    const imageId = await evaluate('document.querySelector("[data-formia-inserted-image]").getAttribute("data-formia-inserted-image")');
    const originalImage = await evaluate('document.querySelector("[data-formia-inserted-image]").getAttribute("src")');
    const replacement = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"/>');
    await send("formia:replace-image", { insertionId: imageId, src: replacement, sourcePath: "C:/fixture.svg", fileName: "fixture.svg", mimeType: "image/svg+xml" });
    await undo(); assert.equal(await evaluate('document.querySelector("[data-formia-inserted-image]").getAttribute("src")'), originalImage, "image replacement undo restores asset");
    await redo(); assert.equal(await evaluate('document.querySelector("[data-formia-inserted-image]").getAttribute("src")'), replacement);
    await undo(); await undo(); assert.equal(await evaluate('document.querySelectorAll("[data-formia-inserted-image]").length'), 0, "image insertion undo removes image");
    await redo(); await redo(); assert.equal(await evaluate('document.querySelector("[data-formia-inserted-image]").getAttribute("src")'), replacement);
    await reset();
    await send("formia:set-tool", "select"); await select("#label"); await send("formia:set-tool", "text");
    await evaluate('const label=document.querySelector("#label");label.textContent="Typed text";label.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:"Typed text"}))');
    await send("formia:set-tool", "select"); await undo();
    assert.equal(await evaluate('document.querySelector("#label").textContent'), "Original", "inline typing commits as one edit");
    await redo(); assert.equal(await evaluate('document.querySelector("#label").textContent'), "Typed text");
    await reset();
    await select("#a"); await style("width", "240px"); await send("formia:reset-style", "width");
    await undo(); assert.equal(await evaluate('document.querySelector("#a").style.width'), "240px", "property reset is undoable");
    await redo(); assert.equal(await evaluate('document.querySelector("#a").style.width'), "");
    console.log("PASS: grouped styles, text, delete, duplicate, reorder, node identity, shortcut forwarding, input isolation, drag insertion, redo branching, reset");
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
