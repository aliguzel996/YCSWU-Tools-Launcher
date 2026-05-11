import fs from "node:fs";
import path from "node:path";

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadReleaseContext(workspaceRoot) {
  const releaseSourcesPath = path.join(workspaceRoot, "config", "release-sources.json");
  const localCatalogPath = path.join(workspaceRoot, "config", "catalog.local.json");
  const remoteCatalogPath = path.join(workspaceRoot, "config", "catalog.remote.json");
  const discoveredToolsPath = path.join(workspaceRoot, "config", "discovered-tools.json");

  return {
    releaseSourcesPath,
    localCatalogPath,
    remoteCatalogPath,
    discoveredToolsPath,
    releaseSources: loadJson(releaseSourcesPath),
    localCatalog: loadJson(localCatalogPath),
    remoteCatalog: fs.existsSync(remoteCatalogPath) ? loadJson(remoteCatalogPath) : null,
    discoveredTools: fs.existsSync(discoveredToolsPath) ? loadJson(discoveredToolsPath) : { owner: null, syncedAt: null, apps: [] }
  };
}

export function resolveGithubDistribution(sourceConfig, env = process.env) {
  const distribution = sourceConfig.distribution || {};
  const owner = env.YCSWU_GITHUB_OWNER || env.GITHUB_OWNER || distribution.owner || "YOUR_GITHUB_OWNER";
  const repo = env.YCSWU_GITHUB_REPO || env.GITHUB_REPO || distribution.repo || "YOUR_LAUNCHER_REPO";
  const manifestBranch =
    env.YCSWU_GITHUB_MANIFEST_BRANCH || env.GITHUB_MANIFEST_BRANCH || distribution.manifestBranch || "main";
  const manifestPath =
    env.YCSWU_GITHUB_MANIFEST_PATH || env.GITHUB_MANIFEST_PATH || distribution.manifestPath || "catalog.json";
  const releaseTagPattern = distribution.releaseTagPattern || "{appId}-v{version}";

  return {
    type: distribution.type || "github-releases",
    owner,
    repo,
    manifestBranch,
    manifestPath,
    releaseTagPattern,
    rawManifestUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${manifestBranch}/${manifestPath}`
  };
}

export function buildReleaseTag(distribution, appId, version) {
  return distribution.releaseTagPattern.replaceAll("{appId}", appId).replaceAll("{version}", version);
}

export function buildReleaseTagPrefix(distribution, appId) {
  return distribution.releaseTagPattern.replaceAll("{appId}", appId).replaceAll("{version}", "");
}

export function buildGithubReleaseAssetUrl(distribution, tag, fileName) {
  return `https://github.com/${distribution.owner}/${distribution.repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`;
}

export function parseCsvArg(argv, flagName) {
  const direct = argv.find((item) => item.startsWith(`${flagName}=`));
  if (!direct) {
    return [];
  }

  return direct
    .slice(flagName.length + 1)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function selectApps(allApps, includeIds, skipIds) {
  return allApps.filter((appEntry) => {
    if (includeIds.length > 0 && !includeIds.includes(appEntry.id)) {
      return false;
    }

    if (skipIds.includes(appEntry.id)) {
      return false;
    }

    return true;
  });
}
