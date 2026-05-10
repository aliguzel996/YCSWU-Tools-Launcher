const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {
  getCatalog: () => ipcRenderer.invoke("launcher:get-catalog"),
  refreshCatalog: () => ipcRenderer.invoke("launcher:refresh-catalog"),
  runAction: (payload) => ipcRenderer.invoke("launcher:run-action", payload),
  openExternal: (url) => ipcRenderer.invoke("launcher:open-external", url),
  openPath: (targetPath) => ipcRenderer.invoke("launcher:open-path", targetPath),
  clearCache: () => ipcRenderer.invoke("launcher:clear-cache")
});
