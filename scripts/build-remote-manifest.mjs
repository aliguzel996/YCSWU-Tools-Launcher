import fs from "node:fs";
import path from "node:path";
import {
  buildGithubReleaseAssetUrl,
  buildReleaseTag,
  buildReleaseTagPrefix,
  loadReleaseContext,
  resolveGithubDistribution
} from "./lib/release-config.mjs";

const workspaceRoot = process.cwd();
const sourceConfigPath = path.join(workspaceRoot, "config", "release-sources.json");
const remoteCatalogPath = path.join(workspaceRoot, "config", "catalog.remote.json");

const sourceConfig = JSON.parse(fs.readFileSync(sourceConfigPath, "utf8"));
const { localCatalog, remoteCatalog: previousRemoteCatalog, discoveredTools } = loadReleaseContext(workspaceRoot);
const distribution = resolveGithubDistribution(sourceConfig);

function stripBuiltAt(value) {
  if (!value) {
    return null;
  }

  const nextValue = structuredClone(value);

  if (nextValue.suite) {
    delete nextValue.suite.builtAt;
  }

  return nextValue;
}

function replaceVersion(template, version) {
  return template.replaceAll("{version}", version);
}

function parseGithubRepoUrl(repoUrl = "") {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);

  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2]
  };
}

function normalizeToolKey(value = "") {
  return String(value).trim().toLowerCase();
}

function dedupeApps(apps) {
  const seenIds = new Set();
  const seenNames = new Set();
  const seenRepoUrls = new Set();
  const result = [];

  for (const appEntry of apps) {
    const normalizedId = normalizeToolKey(appEntry.id);
    const normalizedName = normalizeToolKey(appEntry.name);
    const normalizedRepoUrl = normalizeToolKey(appEntry.links?.repoUrl || "");

    if (
      seenIds.has(normalizedId) ||
      seenNames.has(normalizedName) ||
      (normalizedRepoUrl && seenRepoUrls.has(normalizedRepoUrl))
    ) {
      continue;
    }

    seenIds.add(normalizedId);
    seenNames.add(normalizedName);

    if (normalizedRepoUrl) {
      seenRepoUrls.add(normalizedRepoUrl);
    }

    result.push(appEntry);
  }

  return result;
}

function distributionForApp(sourceEntry) {
  const repoRef = parseGithubRepoUrl(sourceEntry?.links?.repoUrl || "");

  if (repoRef) {
    return {
      ...distribution,
      owner: repoRef.owner,
      repo: repoRef.repo
    };
  }

  return distribution;
}

function remoteUrlFor(appId, relativeTemplate, version, sourceEntry) {
  if (!relativeTemplate) {
    return "";
  }

  const fileName = path.basename(replaceVersion(relativeTemplate, version));
  const appDistribution = distributionForApp(sourceEntry);
  const tag = buildReleaseTag(appDistribution, appId, version);
  return buildGithubReleaseAssetUrl(appDistribution, tag, fileName);
}

const remoteApps = localCatalog.apps.map((appEntry) => {
  const sourceEntry = sourceConfig.apps.find((item) => item.id === appEntry.id);
  const nextEntry = structuredClone(appEntry);

  if (!sourceEntry) {
    return nextEntry;
  }

  nextEntry.links = {
    ...nextEntry.links,
    ...sourceEntry.links
  };

  if (nextEntry.install.strategy === "portable") {
    const url = remoteUrlFor(appEntry.id, sourceEntry.artifacts.portable, appEntry.version, sourceEntry);
    nextEntry.install.packageUrl = url;
    nextEntry.install.portableUrl = url;
  } else {
    nextEntry.install.installerUrl = remoteUrlFor(
      appEntry.id,
      sourceEntry.artifacts.installer,
      appEntry.version,
      sourceEntry
    );
  }

  const appDistribution = distributionForApp(sourceEntry);
  const releaseTag = buildReleaseTag(appDistribution, appEntry.id, appEntry.version);

  nextEntry.source = {
    ...nextEntry.source,
    releaseTag,
    releaseTagPrefix: buildReleaseTagPrefix(appDistribution, appEntry.id),
    remoteBaseUrl: `https://github.com/${appDistribution.owner}/${appDistribution.repo}/releases/tag/${releaseTag}`
  };

  return nextEntry;
});

const nextRemoteCatalog = {
  ...localCatalog,
  suite: {
    ...localCatalog.suite,
    distribution,
    manifestUrl: distribution.rawManifestUrl
  },
  apps: dedupeApps([...remoteApps, ...(discoveredTools.apps || [])])
};

const hasMaterialChange =
  JSON.stringify(stripBuiltAt(previousRemoteCatalog)) !== JSON.stringify(stripBuiltAt(nextRemoteCatalog));

const remoteCatalog = {
  ...nextRemoteCatalog,
  suite: {
    ...nextRemoteCatalog.suite,
    builtAt:
      hasMaterialChange || !previousRemoteCatalog?.suite?.builtAt
        ? new Date().toISOString()
        : previousRemoteCatalog.suite.builtAt
  }
};

fs.writeFileSync(remoteCatalogPath, `${JSON.stringify(remoteCatalog, null, 2)}\n`, "utf8");
console.log(`Remote manifest written to ${remoteCatalogPath}`);
