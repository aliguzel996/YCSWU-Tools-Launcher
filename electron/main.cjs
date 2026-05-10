const path = require("path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { createLauncherService } = require("../src/main/launcher-service.cjs");

const rendererEntry = path.join(__dirname, "..", "src", "renderer", "index.html");
const appIcon = path.join(__dirname, "..", "build", "icon.ico");

let mainWindow;
let launcherService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1260,
    minHeight: 820,
    backgroundColor: "#d7d7d7",
    title: "YCSWU Tools",
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(rendererEntry);
}

function registerIpcHandlers() {
  ipcMain.handle("launcher:get-catalog", async () => launcherService.getCatalog());
  ipcMain.handle("launcher:refresh-catalog", async () => launcherService.refreshCatalog());
  ipcMain.handle("launcher:clear-cache", async () => launcherService.clearCache());
  ipcMain.handle("launcher:run-action", async (_event, payload) => launcherService.runAction(payload));
  ipcMain.handle("launcher:open-external", async (_event, url) => {
    if (!url) {
      return { ok: false, message: "Acilacak URL tanimlanmamis." };
    }

    await shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle("launcher:open-user-data", async () => {
    const userDataPath = app.getPath("userData");
    await shell.openPath(userDataPath);
    return { ok: true, path: userDataPath };
  });
  ipcMain.handle("launcher:open-path", async (_event, targetPath) => {
    if (!targetPath) {
      return { ok: false, message: "Path verilmedi." };
    }

    const result = await shell.openPath(targetPath);
    return { ok: result === "", path: targetPath, message: result };
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId("co.ycswu.launcher");

  launcherService = createLauncherService({
    workspaceRoot: path.join(__dirname, ".."),
    userDataPath: app.getPath("userData")
  });

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
