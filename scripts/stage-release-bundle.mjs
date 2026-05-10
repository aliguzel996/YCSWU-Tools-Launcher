import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadReleaseContext, parseCsvArg, selectApps } from "./lib/release-config.mjs";

const workspaceRoot = process.cwd();
const { localCatalog, remoteCatalog } = loadReleaseContext(workspaceRoot);
const includeIds = parseCsvArg(process.argv, "--apps");
const skipIds = parseCsvArg(process.argv, "--skip");
const strict = process.argv.includes("--strict");

const selectedApps = selectApps(localCatalog.apps, includeIds, skipIds);
const stagingRoot = path.join(workspaceRoot, "release-staging");

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function resetDir(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  ensureDir(targetDir);
}

function copyIfExists(sourcePath, targetPath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return false;
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function normalizeFileUrl(maybeUrl) {
  if (!maybeUrl) {
    return null;
  }

  if (maybeUrl.startsWith("file:///")) {
    return fileURLToPath(maybeUrl);
  }

  return maybeUrl;
}

resetDir(stagingRoot);

const summary = [];

for (const appEntry of selectedApps) {
  const targetDir = path.join(stagingRoot, appEntry.id, appEntry.version);
  ensureDir(targetDir);

  const localPortable = normalizeFileUrl(appEntry.install.portableUrl || appEntry.install.packageUrl);
  const localInstaller = normalizeFileUrl(appEntry.install.installerUrl);
  const sourcePortableName = localPortable ? path.basename(localPortable) : null;
  const sourceInstallerName = localInstaller ? path.basename(localInstaller) : null;

  const portableCopied = sourcePortableName
    ? copyIfExists(localPortable, path.join(targetDir, sourcePortableName))
    : false;
  const installerCopied = sourceInstallerName
    ? copyIfExists(localInstaller, path.join(targetDir, sourceInstallerName))
    : false;

  if (strict && !portableCopied && !installerCopied) {
    throw new Error(`${appEntry.id} icin staging artifact bulunamadi.`);
  }

  summary.push({
    id: appEntry.id,
    version: appEntry.version,
    strategy: appEntry.install.strategy,
    stagedPortable: portableCopied ? path.join(targetDir, sourcePortableName) : "",
    stagedInstaller: installerCopied ? path.join(targetDir, sourceInstallerName) : "",
    remoteTarget:
      remoteCatalog?.apps.find((item) => item.id === appEntry.id)?.source?.remoteBaseUrl || ""
  });
}

if (remoteCatalog) {
  fs.writeFileSync(path.join(stagingRoot, "catalog.json"), `${JSON.stringify(remoteCatalog, null, 2)}\n`, "utf8");
}

fs.writeFileSync(path.join(stagingRoot, "staging-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ stagingRoot, appCount: summary.length, apps: summary }, null, 2));
