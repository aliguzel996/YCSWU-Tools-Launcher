import fs from "node:fs";
import path from "node:path";
import { loadReleaseContext, resolveGithubDistribution } from "./lib/release-config.mjs";

const workspaceRoot = process.cwd();
const tagName =
  process.argv.find((item) => item.startsWith("--tag="))?.slice("--tag=".length) ||
  process.env.RELEASE_TAG ||
  process.env.GITHUB_REF_NAME ||
  "";
const isPrerelease = ["1", "true", "yes"].includes(String(process.env.RELEASE_PRERELEASE || "").toLowerCase());

if (!tagName) {
  throw new Error("Release tag verilmedi. --tag=app-v1.2.3 veya RELEASE_TAG kullanin.");
}

const { releaseSources, localCatalogPath } = loadReleaseContext(workspaceRoot);
const localCatalog = JSON.parse(fs.readFileSync(localCatalogPath, "utf8"));
const distribution = resolveGithubDistribution(releaseSources);

function parseReleaseTag(tag, catalog) {
  for (const appEntry of catalog.apps) {
    const prefix = distribution.releaseTagPattern.replaceAll("{appId}", appEntry.id).replaceAll("{version}", "");

    if (tag.startsWith(prefix)) {
      return {
        appId: appEntry.id,
        version: tag.slice(prefix.length)
      };
    }
  }

  return null;
}

const parsed = parseReleaseTag(tagName, localCatalog);

if (!parsed) {
  throw new Error(`Release tag hicbir app ile eslesmedi: ${tagName}`);
}

let changed = false;

const nextCatalog = {
  ...localCatalog,
  suite: {
    ...localCatalog.suite,
    syncedAt: new Date().toISOString()
  },
  apps: localCatalog.apps.map((appEntry) => {
    if (appEntry.id !== parsed.appId) {
      return appEntry;
    }

    changed = changed || appEntry.version !== parsed.version;

    return {
      ...appEntry,
      version: parsed.version,
      channel: isPrerelease ? "beta" : "stable"
    };
  })
};

if (changed) {
  fs.writeFileSync(localCatalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, "utf8");
}

console.log(
  JSON.stringify(
    {
      tag: tagName,
      appId: parsed.appId,
      version: parsed.version,
      prerelease: isPrerelease,
      changed
    },
    null,
    2
  )
);
