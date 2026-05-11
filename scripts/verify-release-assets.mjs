import fs from "node:fs";
import path from "node:path";
import { loadReleaseContext, resolveGithubDistribution } from "./lib/release-config.mjs";

const workspaceRoot = process.cwd();
const tagName =
  process.argv.find((item) => item.startsWith("--tag="))?.slice("--tag=".length) ||
  process.env.RELEASE_TAG ||
  process.env.GITHUB_REF_NAME ||
  "";
const eventPath = process.env.GITHUB_EVENT_PATH || "";

if (!tagName) {
  throw new Error("Release tag verilmedi. --tag=app-v1.2.3 veya RELEASE_TAG kullanin.");
}

const { releaseSources, localCatalog } = loadReleaseContext(workspaceRoot);
const distribution = resolveGithubDistribution(releaseSources);

function parseReleaseTag(tag, catalogApps) {
  for (const appEntry of catalogApps) {
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

function replaceVersion(template, version) {
  return template.replaceAll("{version}", version);
}

function expectedAssetsFor(sourceEntry, version) {
  const expected = [];

  if (sourceEntry.preferredStrategy === "portable" && sourceEntry.artifacts?.portable) {
    expected.push(path.basename(replaceVersion(sourceEntry.artifacts.portable, version)));
  }

  if (sourceEntry.preferredStrategy === "nsis" && sourceEntry.artifacts?.installer) {
    expected.push(path.basename(replaceVersion(sourceEntry.artifacts.installer, version)));
  }

  return expected;
}

function readReleaseAssetNames() {
  if (!eventPath || !fs.existsSync(eventPath)) {
    return [];
  }

  const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  return Array.isArray(payload.release?.assets) ? payload.release.assets.map((asset) => asset.name).filter(Boolean) : [];
}

const parsed = parseReleaseTag(tagName, localCatalog.apps);

if (!parsed) {
  throw new Error(`Release tag hicbir app ile eslesmedi: ${tagName}`);
}

const sourceEntry = releaseSources.apps.find((item) => item.id === parsed.appId);

if (!sourceEntry) {
  throw new Error(`release-sources.json icinde app bulunamadi: ${parsed.appId}`);
}

const expectedAssets = expectedAssetsFor(sourceEntry, parsed.version);
const releaseAssets = readReleaseAssetNames();

if (releaseAssets.length === 0) {
  console.log(
    JSON.stringify(
      {
        tag: tagName,
        appId: parsed.appId,
        version: parsed.version,
        skipped: true,
        reason: "No release assets were present in the event payload."
      },
      null,
      2
    )
  );
  process.exit(0);
}

const missingAssets = expectedAssets.filter((assetName) => !releaseAssets.includes(assetName));

if (missingAssets.length > 0) {
  throw new Error(
    `Release asset dogrulamasi basarisiz. Beklenen dosyalar eksik: ${missingAssets.join(", ")}. Mevcut assetler: ${releaseAssets.join(", ")}`
  );
}

console.log(
  JSON.stringify(
    {
      tag: tagName,
      appId: parsed.appId,
      version: parsed.version,
      expectedAssets,
      releaseAssets,
      ok: true
    },
    null,
    2
  )
);
