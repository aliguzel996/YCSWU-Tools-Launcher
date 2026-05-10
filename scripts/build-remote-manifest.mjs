import fs from "node:fs";
import path from "node:path";
import {
  buildGithubReleaseAssetUrl,
  buildReleaseTag,
  buildReleaseTagPrefix,
  resolveGithubDistribution
} from "./lib/release-config.mjs";

const workspaceRoot = process.cwd();
const sourceConfigPath = path.join(workspaceRoot, "config", "release-sources.json");
const localCatalogPath = path.join(workspaceRoot, "config", "catalog.local.json");
const remoteCatalogPath = path.join(workspaceRoot, "config", "catalog.remote.json");

const sourceConfig = JSON.parse(fs.readFileSync(sourceConfigPath, "utf8"));
const localCatalog = JSON.parse(fs.readFileSync(localCatalogPath, "utf8"));
const distribution = resolveGithubDistribution(sourceConfig);

function replaceVersion(template, version) {
  return template.replaceAll("{version}", version);
}

function remoteUrlFor(appId, relativeTemplate, version) {
  if (!relativeTemplate) {
    return "";
  }

  const fileName = path.basename(replaceVersion(relativeTemplate, version));
  const tag = buildReleaseTag(distribution, appId, version);
  return buildGithubReleaseAssetUrl(distribution, tag, fileName);
}

const remoteApps = localCatalog.apps.map((appEntry) => {
  const sourceEntry = sourceConfig.apps.find((item) => item.id === appEntry.id);
  const nextEntry = structuredClone(appEntry);

  if (!sourceEntry) {
    return nextEntry;
  }

  if (nextEntry.install.strategy === "portable") {
    const url = remoteUrlFor(appEntry.id, sourceEntry.artifacts.portable, appEntry.version);
    nextEntry.install.packageUrl = url;
    nextEntry.install.portableUrl = url;
  } else {
    nextEntry.install.installerUrl = remoteUrlFor(appEntry.id, sourceEntry.artifacts.installer, appEntry.version);
  }

  nextEntry.source = {
    ...nextEntry.source,
    releaseTag: buildReleaseTag(distribution, appEntry.id, appEntry.version),
    releaseTagPrefix: buildReleaseTagPrefix(distribution, appEntry.id),
    remoteBaseUrl: `https://github.com/${distribution.owner}/${distribution.repo}/releases/tag/${buildReleaseTag(
      distribution,
      appEntry.id,
      appEntry.version
    )}`
  };

  return nextEntry;
});

const remoteCatalog = {
  ...localCatalog,
  suite: {
    ...localCatalog.suite,
    distribution,
    manifestUrl: distribution.rawManifestUrl,
    builtAt: new Date().toISOString()
  },
  apps: remoteApps
};

fs.writeFileSync(remoteCatalogPath, `${JSON.stringify(remoteCatalog, null, 2)}\n`, "utf8");
console.log(`Remote manifest written to ${remoteCatalogPath}`);
