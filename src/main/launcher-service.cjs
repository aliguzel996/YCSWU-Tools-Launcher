const fs = require("fs");
const os = require("os");
const path = require("path");
const { fileURLToPath } = require("url");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");
const { spawn } = require("child_process");

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compareVersions(left = "0.0.0", right = "0.0.0") {
  const safeLeft = left || "0.0.0";
  const safeRight = right || "0.0.0";
  const leftParts = safeLeft.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = safeRight.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createTemplateRegex(template) {
  if (!template) {
    return null;
  }

  const fileName = path.basename(template);
  const pattern = `^${escapeRegex(fileName).replace("\\{version\\}", "(.+)")}$`;
  return new RegExp(pattern, "i");
}

function extractVersionFromTag(tagName, tagPrefix) {
  if (!tagName || !tagPrefix || !tagName.startsWith(tagPrefix)) {
    return null;
  }

  return tagName.slice(tagPrefix.length);
}

function normalizeFileSource(source) {
  if (!source) {
    return null;
  }

  if (source.startsWith("file:///")) {
    return new URL(source);
  }

  return source;
}

function isPlaceholderReleaseValue(value = "") {
  return value.includes("YOUR_GITHUB_OWNER") || value.includes("YOUR_LAUNCHER_REPO");
}

function getPackageSource(appEntry) {
  return appEntry.install.packageUrl || appEntry.install.portableUrl || appEntry.install.installerUrl || "";
}

function inspectReleaseSource(packageSource) {
  if (!packageSource || isPlaceholderReleaseValue(packageSource)) {
    return {
      configured: false,
      ok: false,
      type: "unknown",
      label: "unknown",
      value: ""
    };
  }

  const normalized = normalizeFileSource(packageSource);

  if (normalized instanceof URL) {
    const filePath = fileURLToPath(normalized);
    const exists = fs.existsSync(filePath);

    return {
      configured: true,
      ok: exists,
      type: "local-file",
      label: exists ? "local file" : "broken link",
      value: normalized.href
    };
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return {
      configured: true,
      ok: true,
      type: "remote",
      label: normalized.includes("github.com") ? "github release" : "remote release",
      value: normalized
    };
  }

  const localPath = path.resolve(normalized);
  const exists = fs.existsSync(localPath);

  return {
    configured: true,
    ok: exists,
    type: "local-file",
    label: exists ? "local file" : "broken link",
    value: localPath
  };
}

function resolveGithubUrl(appEntry, manifest) {
  if (appEntry.links?.repoUrl) {
    return appEntry.links.repoUrl;
  }

  if (appEntry.source?.githubReleasePage && !isPlaceholderReleaseValue(appEntry.source.githubReleasePage)) {
    return appEntry.source.githubReleasePage;
  }

  const owner = manifest?.suite?.distribution?.owner;
  const repo = manifest?.suite?.distribution?.repo;

  if (owner && repo && !isPlaceholderReleaseValue(owner) && !isPlaceholderReleaseValue(repo)) {
    return `https://github.com/${owner}/${repo}`;
  }

  return "";
}

async function downloadToFile(url, targetPath) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Manifest package indirilemedi (${response.status}).`);
  }

  if (!response.body) {
    throw new Error("Manifest package body bos geldi.");
  }

  ensureDir(path.dirname(targetPath));
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(targetPath));
  return targetPath;
}

function resolveRuntimeConfig(workspaceRoot, userDataPath, manifestOverride) {
  const envCandidates = [
    process.env.YCSWU_LAUNCHER_MANIFEST_URL,
    process.env.LAUNCHER_MANIFEST_URL
  ].filter(Boolean);

  const localManifestPath = path.join(workspaceRoot, "config", "catalog.local.json");

  return {
    userDataPath,
    registryPath: path.join(userDataPath, "registry.json"),
    cacheRoot: path.join(userDataPath, "cache"),
    managedAppsRoot: path.join(userDataPath, "managed-apps"),
    manifestCandidates: [manifestOverride, ...envCandidates, localManifestPath].filter(Boolean)
  };
}

class CatalogStore {
  constructor(workspaceRoot, userDataPath) {
    this.workspaceRoot = workspaceRoot;
    this.userDataPath = userDataPath;
    this.manifestOverride = null;
  }

  setManifestOverride(manifestPath) {
    this.manifestOverride = manifestPath;
  }

  async loadManifest() {
    const runtime = resolveRuntimeConfig(this.workspaceRoot, this.userDataPath, this.manifestOverride);
    const bundledManifest = readJson(runtime.manifestCandidates.at(-1), null);
    const bundledRemoteUrl =
      bundledManifest?.suite?.manifestUrl || bundledManifest?.suite?.distribution?.rawManifestUrl || "";
    const manifestCandidates = [...runtime.manifestCandidates.slice(0, -1), bundledRemoteUrl, runtime.manifestCandidates.at(-1)]
      .filter(Boolean)
      .filter((candidate, index, array) => array.indexOf(candidate) === index);

    for (const candidate of manifestCandidates) {
      try {
        const manifest = await this.readCandidate(candidate);
        const enrichedManifest = await this.mergeGithubReleaseState(manifest);

        return {
          manifest: enrichedManifest,
          source: candidate,
          runtime
        };
      } catch (error) {
        continue;
      }
    }

    throw new Error("Launcher manifest bulunamadi.");
  }

  async readCandidate(candidate) {
    let manifest = null;

    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      const response = await fetch(candidate, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Manifest okunamadi (${response.status}).`);
      }

      manifest = await response.json();
    } else {
      const normalized = normalizeFileSource(candidate);

      if (normalized instanceof URL) {
        manifest = readJson(normalized, null);
      } else {
        manifest = readJson(path.resolve(normalized), null);
      }
    }

    if (!manifest || !Array.isArray(manifest.apps)) {
      throw new Error("Manifest yapisi gecersiz.");
    }

    return manifest;
  }

  async mergeGithubReleaseState(manifest) {
    const distribution = manifest?.suite?.distribution;

    if (
      !distribution ||
      distribution.type !== "github-releases" ||
      !distribution.owner ||
      !distribution.repo ||
      distribution.owner === "YOUR_GITHUB_OWNER" ||
      distribution.repo === "YOUR_LAUNCHER_REPO"
    ) {
      return manifest;
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${distribution.owner}/${distribution.repo}/releases?per_page=100`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "ycswu-launcher"
          }
        }
      );

      if (!response.ok) {
        return manifest;
      }

      const releases = await response.json();
      const nextApps = manifest.apps.map((appEntry) => this.mergeGithubReleaseForApp(appEntry, releases));

      return {
        ...manifest,
        suite: {
          ...manifest.suite,
          githubReleaseSyncAt: new Date().toISOString()
        },
        apps: nextApps
      };
    } catch {
      return manifest;
    }
  }

  mergeGithubReleaseForApp(appEntry, releases) {
    const tagPrefix = appEntry?.source?.releaseTagPrefix;

    if (!tagPrefix) {
      return appEntry;
    }

    const matching = releases
      .filter((release) => !release.draft && release.tag_name?.startsWith(tagPrefix))
      .map((release) => ({
        release,
        version: extractVersionFromTag(release.tag_name, tagPrefix)
      }))
      .filter((entry) => entry.version);

    if (matching.length === 0) {
      return appEntry;
    }

    matching.sort((left, right) => compareVersions(right.version, left.version));
    const latest = matching[0];
    const portablePattern = createTemplateRegex(appEntry?.source?.assetPatterns?.portable || "");
    const installerPattern = createTemplateRegex(appEntry?.source?.assetPatterns?.installer || "");
    const portableAsset =
      latest.release.assets?.find((asset) => portablePattern && portablePattern.test(asset.name)) || null;
    const installerAsset =
      latest.release.assets?.find((asset) => installerPattern && installerPattern.test(asset.name)) || null;

    const nextEntry = {
      ...appEntry,
      version: latest.version,
      source: {
        ...appEntry.source,
        releaseTag: latest.release.tag_name,
        githubReleasePage: latest.release.html_url,
        githubPublishedAt: latest.release.published_at
      }
    };

    if (nextEntry.install.strategy === "portable" && portableAsset?.browser_download_url) {
      nextEntry.install = {
        ...nextEntry.install,
        packageUrl: portableAsset.browser_download_url,
        portableUrl: portableAsset.browser_download_url
      };
    }

    if (nextEntry.install.strategy === "nsis" && installerAsset?.browser_download_url) {
      nextEntry.install = {
        ...nextEntry.install,
        installerUrl: installerAsset.browser_download_url
      };
    }

    return nextEntry;
  }
}

class RegistryStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  read() {
    return readJson(this.filePath, { apps: {} });
  }

  write(value) {
    writeJson(this.filePath, value);
  }

  updateApp(appId, updater) {
    const current = this.read();
    current.apps[appId] = updater(current.apps[appId] || {});
    this.write(current);
    return current.apps[appId];
  }
}

class PackageManager {
  constructor(runtime) {
    this.runtime = runtime;
  }

  async materializePackage(appEntry, packageSource) {
    const normalized = normalizeFileSource(packageSource);

    if (!normalized) {
      throw new Error(`${appEntry.name} icin package URL tanimli degil.`);
    }

    if (normalized instanceof URL) {
      if (normalized.protocol !== "file:") {
        throw new Error("file URL disinda sadece http/https kullanin.");
      }

      return fileURLToPath(normalized);
    }

    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      const fileName = path.basename(new URL(normalized).pathname);
      const targetPath = path.join(this.runtime.cacheRoot, appEntry.id, appEntry.version, fileName);
      return downloadToFile(normalized, targetPath);
    }

    const localPath = path.resolve(normalized);

    if (!fs.existsSync(localPath)) {
      throw new Error(`Package kaynagi bulunamadi: ${localPath}`);
    }

    return localPath;
  }

  getManagedExecutablePath(appEntry) {
    return path.join(
      this.runtime.managedAppsRoot,
      appEntry.id,
      appEntry.version,
      appEntry.install.launchExecutable
    );
  }

  async installPortable(appEntry, packageSource) {
    const sourcePath = await this.materializePackage(appEntry, packageSource);
    const targetPath = this.getManagedExecutablePath(appEntry);
    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
    return targetPath;
  }

  async downloadInstaller(appEntry, packageSource) {
    return this.materializePackage(appEntry, packageSource);
  }

  launchDetached(executablePath, args = []) {
    const child = spawn(executablePath, args, {
      detached: true,
      stdio: "ignore"
    });

    child.unref();
  }
}

function expandVariables(targetPath) {
  return targetPath
    .replaceAll("%LOCALAPPDATA%", process.env.LOCALAPPDATA || "")
    .replaceAll("%PROGRAMFILES%", process.env.PROGRAMFILES || "")
    .replaceAll("%PROGRAMFILES(X86)%", process.env["PROGRAMFILES(X86)"] || "")
    .replaceAll("%USERPROFILE%", os.homedir());
}

function defaultDiscoveryPaths(appEntry) {
  const installDirName = appEntry.install.installDirName || appEntry.id;
  const executableName = appEntry.install.launchExecutable;

  return [
    `%LOCALAPPDATA%\\Programs\\${installDirName}\\${executableName}`,
    `%PROGRAMFILES%\\${installDirName}\\${executableName}`,
    `%PROGRAMFILES(X86)%\\${installDirName}\\${executableName}`
  ];
}

function buildState(appEntry, registryEntry, managedExecutablePath, releaseSource) {
  const installedVersion = registryEntry?.version || null;
  const executablePath = registryEntry?.executablePath || null;
  const hasManagedInstall = fs.existsSync(managedExecutablePath);
  const hasExecutable = executablePath && fs.existsSync(executablePath);
  const isInstalled = hasExecutable || hasManagedInstall;
  const currentVersion = installedVersion || (hasManagedInstall ? appEntry.version : null);

  if (!isInstalled && releaseSource.configured && !releaseSource.ok) {
    return {
      status: "broken-link",
      label: "BROKEN LINK"
    };
  }

  if (!isInstalled) {
    if (!releaseSource.configured) {
      return {
        status: "unknown",
        label: "UNKNOWN"
      };
    }

    return {
      status: "not-installed",
      label: "READY TO INSTALL"
    };
  }

  if (!currentVersion) {
    return {
      status: "installed",
      label: "INSTALLED"
    };
  }

  if (compareVersions(currentVersion, appEntry.version) < 0) {
    return {
      status: "update-available",
      label: "UPDATE AVAILABLE"
    };
  }

  if (compareVersions(currentVersion, appEntry.version) > 0) {
    return {
      status: "installed",
      label: "INSTALLED"
    };
  }

  return {
    status: "up-to-date",
    label: "UP TO DATE"
  };
}

function resolvePrimaryAction(status) {
  if (status === "installed" || status === "up-to-date") {
    return "launch";
  }

  if (status === "update-available") {
    return "update";
  }

  if (status === "broken-link" || status === "unknown") {
    return "refresh";
  }

  return "install";
}

function getActionLabel(action) {
  switch (action) {
    case "launch":
      return "open";
    case "update":
      return "update";
    case "refresh":
      return "refresh";
    default:
      return "install";
  }
}

function summarizeChangelog(appEntry) {
  if (appEntry.source?.releaseTag) {
    return `Latest release tag: ${appEntry.source.releaseTag}`;
  }

  if (appEntry.source?.githubPublishedAt) {
    return `Published: ${appEntry.source.githubPublishedAt}`;
  }

  return "";
}

function resolveAvailableActions(state, githubUrl) {
  return {
    install: state.status === "not-installed",
    open: ["installed", "up-to-date", "update-available"].includes(state.status),
    update: state.status === "update-available",
    github: Boolean(githubUrl),
    info: true
  };
}

function getSuiteGithubUrl(manifest) {
  const owner = manifest?.suite?.distribution?.owner;
  const repo = manifest?.suite?.distribution?.repo;

  if (!owner || !repo || isPlaceholderReleaseValue(owner) || isPlaceholderReleaseValue(repo)) {
    return "";
  }

  return `https://github.com/${owner}/${repo}`;
}

function getToolsPageUrl(manifest) {
  return manifest?.suite?.supportUrl || "https://ycswu.co/araclar/";
}

function createLauncherService({ workspaceRoot, userDataPath }) {
  const catalogStore = new CatalogStore(workspaceRoot, userDataPath);

  async function readContext() {
    const { manifest, source, runtime } = await catalogStore.loadManifest();
    ensureDir(runtime.cacheRoot);
    ensureDir(runtime.managedAppsRoot);
    ensureDir(path.dirname(runtime.registryPath));
    const registryStore = new RegistryStore(runtime.registryPath);
    const packageManager = new PackageManager(runtime);
    const registry = registryStore.read();

    return {
      source,
      runtime,
      manifest,
      registryStore,
      packageManager,
      registry
    };
  }

  async function enrichApp(appEntry, registryEntry, packageManager, manifest) {
    const managedExecutablePath = packageManager.getManagedExecutablePath(appEntry);
    const candidatePaths = [
      registryEntry?.executablePath,
      managedExecutablePath,
      ...(appEntry.install.discoveryPaths || defaultDiscoveryPaths(appEntry)).map(expandVariables)
    ].filter(Boolean);

    const discoveredPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath)) || null;
    const releaseSource = inspectReleaseSource(getPackageSource(appEntry));
    const baseState = buildState(
      appEntry,
      discoveredPath ? { ...registryEntry, executablePath: discoveredPath } : registryEntry,
      managedExecutablePath,
      releaseSource
    );
    const state = baseState;
    const localVersion = registryEntry?.version || (discoveredPath ? "unknown" : "none");
    const githubUrl = resolveGithubUrl(appEntry, manifest);

    return {
      ...appEntry,
      installedVersion: registryEntry?.version || null,
      localVersion,
      latestVersion: appEntry.version,
      executablePath: discoveredPath,
      installRoot: discoveredPath ? path.dirname(discoveredPath) : null,
      releaseConfigured: releaseSource.configured,
      releaseSource,
      githubUrl,
      changelogSummary: summarizeChangelog(appEntry),
      state,
      availableActions: resolveAvailableActions(state, githubUrl),
      primaryAction: resolvePrimaryAction(state.status),
      primaryActionLabel: getActionLabel(resolvePrimaryAction(state.status))
    };
  }

  return {
    setManifestOverride(manifestPath) {
      catalogStore.setManifestOverride(manifestPath);
    },

    async getCatalog() {
      const context = await readContext();
      const apps = await Promise.all(
        context.manifest.apps.map((appEntry) =>
          enrichApp(appEntry, context.registry.apps[appEntry.id], context.packageManager, context.manifest)
        )
      );

      return {
        suite: context.manifest.suite,
        source: context.source,
        managedAppsRoot: context.runtime.managedAppsRoot,
        userDataPath: context.runtime.userDataPath,
        suiteGithubUrl: getSuiteGithubUrl(context.manifest),
        toolsPageUrl: getToolsPageUrl(context.manifest),
        apps
      };
    },

    async refreshCatalog() {
      return this.getCatalog();
    },

    async clearCache() {
      const context = await readContext();
      fs.rmSync(context.runtime.cacheRoot, { recursive: true, force: true });
      ensureDir(context.runtime.cacheRoot);

      return {
        ok: true,
        cacheRoot: context.runtime.cacheRoot,
        catalog: await this.getCatalog()
      };
    },

    async runAction({ appId, action }) {
      const context = await readContext();
      const appEntry = context.manifest.apps.find((item) => item.id === appId);

      if (!appEntry) {
        throw new Error(`App bulunamadi: ${appId}`);
      }

      const registryEntry = context.registry.apps[appId] || {};
      const enrichedApp = await enrichApp(appEntry, registryEntry, context.packageManager, context.manifest);

      if (action === "refresh") {
        return {
          ok: true,
          message: `${appEntry.name} durumu yenilendi.`,
          catalog: await this.getCatalog()
        };
      }

      if (action === "wire") {
        return {
          ok: true,
          message: `${appEntry.name} icin manifestte package URL veya installer URL baglayin.`,
          catalog: await this.getCatalog()
        };
      }

      if (action === "launch") {
        if (!enrichedApp.executablePath) {
          throw new Error(`${appEntry.name} icin calistirilabilir dosya bulunamadi.`);
        }

        context.packageManager.launchDetached(enrichedApp.executablePath);
        return {
          ok: true,
          message: `${appEntry.name} acildi.`,
          catalog: await this.getCatalog()
        };
      }

      if (action === "install" || action === "update") {
        if (appEntry.install.strategy === "portable") {
          const packageSource = appEntry.install.packageUrl || appEntry.install.portableUrl;
          const executablePath = await context.packageManager.installPortable(appEntry, packageSource);

          context.registryStore.updateApp(appId, () => ({
            version: appEntry.version,
            executablePath,
            installedAt: new Date().toISOString(),
            strategy: appEntry.install.strategy
          }));

          return {
            ok: true,
            message: `${appEntry.name} ${appEntry.version} launcher kutuphanesine yerlestirildi.`,
            catalog: await this.getCatalog()
          };
        }

        if (appEntry.install.strategy === "nsis") {
          const installerPath = await context.packageManager.downloadInstaller(
            appEntry,
            appEntry.install.installerUrl
          );

          context.packageManager.launchDetached(
            installerPath,
            Array.isArray(appEntry.install.silentArgs) ? appEntry.install.silentArgs : []
          );

          context.registryStore.updateApp(appId, (current) => ({
            ...current,
            pendingVersion: appEntry.version,
            strategy: appEntry.install.strategy,
            lastInstallerPath: installerPath,
            requestedAt: new Date().toISOString()
          }));

          return {
            ok: true,
            message: `${appEntry.name} installer baslatildi.`,
            catalog: await this.getCatalog()
          };
        }

        throw new Error(`${appEntry.name} icin desteklenmeyen install strategy.`);
      }

      throw new Error(`Bilinmeyen action: ${action}`);
    }
  };
}

module.exports = {
  createLauncherService
};
