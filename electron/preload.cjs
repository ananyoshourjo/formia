const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { contextBridge, ipcRenderer } = require("electron");

const inspectorPreloadUrl = pathToFileURL(path.join(__dirname, "inspector-preload.cjs")).href;

contextBridge.exposeInMainWorld("formiaDesktop", {
  isDesktop: true,
  platform: process.platform,
  inspectorPreloadUrl,
  selectProject: () => ipcRenderer.invoke("formia:select-project"),
  openProject: (projectPath) => ipcRenderer.invoke("formia:open-project", projectPath),
  stopProjectServer: () => ipcRenderer.invoke("formia:stop-project-server"),
  buildWithCodex: (payload) => ipcRenderer.invoke("formia:codex-build", payload),
  onProjectServerStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("formia:project-server-status", listener);
    return () => ipcRenderer.removeListener("formia:project-server-status", listener);
  },
  onCodexStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("formia:codex-status", listener);
    return () => ipcRenderer.removeListener("formia:codex-status", listener);
  },
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  }),
});
