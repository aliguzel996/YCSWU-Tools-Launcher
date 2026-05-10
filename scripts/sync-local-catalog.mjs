import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildReleaseTagPrefix, resolveGithubDistribution } from "./lib/release-config.mjs";

const workspaceRoot = process.cwd();
const sourceConfigPath = path.join(workspaceRoot, "config", "release-sources.json");
const localCatalogPath = path.join(workspaceRoot, "config", "catalog.local.json");

const sourceConfig = JSON.parse(fs.readFileSync(sourceConfigPath, "utf8"));
const catalog = JSON.parse(fs.readFileSync(localCatalogPath, "utf8"));
const distribution = resolveGithubDistribution(sourceConfig);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function replaceVersion(template, version) {
  return template.replaceAll("{version}", version);
}

function resolveArtifactPath(repoPath, template, version) {
  if (!template) {
    return null;
  }

  return path.join(repoPath, replaceVersion(template, version));
}

function toFileUrlIfExists(candidatePath) {
  if (!candidatePath) {
    return "";
  }

  if (!fs.existsSync(candidatePath)) {
    return "";
  }

  return pathToFileURL(candidatePath).href;
}

function toRelativeIfExists(candidatePath) {
  if (!candidatePath || !fs.existsSync(candidatePath)) {
    return "";
  }

  return candidatePath;
}

const nextApps = catalog.apps.map((appEntry) => {
  const sourceEntry = sourceConfig.apps.find((item) => item.id === appEntry.id);

  if (!sourceEntry) {
    return appEntry;
  }

  const packageJson = readJson(path.join(sourceEntry.repoPath, sourceEntry.packageJsonPath));
  const version = packageJson.version;
  const portablePath = resolveArtifactPath(sourceEntry.repoPath, sourceEntry.artifacts.portable, version);
  const installerPath = resolveArtifactPath(sourceEntry.repoPath, sourceEntry.artifacts.installer, version);
  const latestYmlPath = resolveArtifactPath(sourceEntry.repoPath, sourceEntry.artifacts.latestYml, version);

  const installStrategy = sourceEntry.preferredStrategy;
  const nextInstall =
    installStrategy === "nsis"
      ? {
          strategy: "nsis",
          installerUrl: toFileUrlIfExists(installerPath),
          silentArgs: [],
          launchExecutable: sourceEntry.artifacts.launchExecutable,
          installDirName: appEntry.install.installDirName || appEntry.id,
          discoveryPaths: appEntry.install.discoveryPaths || []
        }
      : {
          strategy: "portable",
          packageUrl: toFileUrlIfExists(portablePath),
          portableUrl: toFileUrlIfExists(portablePath),
          launchExecutable: sourceEntry.artifacts.launchExecutable,
          installDirName: appEntry.install.installDirName || appEntry.id,
          discoveryPaths: appEntry.install.discoveryPaths || []
        };

  return {
    ...appEntry,
    version,
    links: {
      ...appEntry.links,
      ...sourceEntry.links
    },
    install: nextInstall,
      source: {
        repoPath: sourceEntry.repoPath,
        packageJsonPath: path.join(sourceEntry.repoPath, sourceEntry.packageJsonPath),
        buildCommands: sourceEntry.buildCommands,
        releaseTagPrefix: buildReleaseTagPrefix(distribution, appEntry.id),
        assetPatterns: {
          portable: sourceEntry.artifacts.portable ? path.basename(sourceEntry.artifacts.portable) : "",
          installer: sourceEntry.artifacts.installer ? path.basename(sourceEntry.artifacts.installer) : ""
        },
        localArtifacts: {
          portable: toRelativeIfExists(portablePath),
          installer: toRelativeIfExists(installerPath),
          latestYml: toRelativeIfExists(latestYmlPath)
        }
    }
  };
});

const nextCatalog = {
  ...catalog,
  suite: {
    ...catalog.suite,
    syncedAt: new Date().toISOString()
  },
  apps: nextApps
};

fs.writeFileSync(localCatalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, "utf8");

const summary = nextApps.map((appEntry) => ({
  id: appEntry.id,
  version: appEntry.version,
  strategy: appEntry.install.strategy,
  packageUrl: appEntry.install.packageUrl || "",
  installerUrl: appEntry.install.installerUrl || ""
}));

console.log(JSON.stringify(summary, null, 2));
