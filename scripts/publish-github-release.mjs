import fs from "node:fs";
import path from "node:path";
import {
  buildReleaseTag,
  loadReleaseContext,
  parseCsvArg,
  resolveGithubDistribution,
  selectApps
} from "./lib/release-config.mjs";

const workspaceRoot = process.cwd();
const githubToken = process.env.YCSWU_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";

if (!githubToken) {
  throw new Error("GITHUB_TOKEN veya YCSWU_GITHUB_TOKEN tanimli degil.");
}

const { releaseSources, localCatalog, remoteCatalog, remoteCatalogPath } = loadReleaseContext(workspaceRoot);
const distribution = resolveGithubDistribution(releaseSources);
const includeIds = parseCsvArg(process.argv, "--apps");
const skipIds = parseCsvArg(process.argv, "--skip");
const dryRun = process.argv.includes("--dry-run");
const markLatest = process.argv.includes("--latest");
const selectedApps = selectApps(localCatalog.apps, includeIds, skipIds);
const stagingRoot = path.join(workspaceRoot, "release-staging");

if (!remoteCatalog) {
  throw new Error("catalog.remote.json bulunamadi. Once build:remote-manifest calistirin.");
}

function githubApi(pathname) {
  return `https://api.github.com${pathname}`;
}

async function githubRequest(pathname, options = {}) {
  const response = await fetch(githubApi(pathname), {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "User-Agent": "ycswu-launcher-publisher",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function getReleaseByTag(tag) {
  try {
    return await githubRequest(`/repos/${distribution.owner}/${distribution.repo}/releases/tags/${encodeURIComponent(tag)}`);
  } catch (error) {
    if (String(error.message).includes("404")) {
      return null;
    }

    throw error;
  }
}

async function createRelease(tag, appEntry) {
  return githubRequest(`/repos/${distribution.owner}/${distribution.repo}/releases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tag_name: tag,
      name: `${appEntry.name} v${appEntry.version}`,
      draft: false,
      prerelease: appEntry.channel !== "stable",
      make_latest: markLatest ? "true" : "legacy",
      generate_release_notes: false,
      body: `Automated launcher publish for ${appEntry.name} ${appEntry.version}.`
    })
  });
}

async function ensureRelease(tag, appEntry) {
  const existing = await getReleaseByTag(tag);
  if (existing) {
    return existing;
  }

  return createRelease(tag, appEntry);
}

async function deleteAsset(assetId) {
  await githubRequest(`/repos/${distribution.owner}/${distribution.repo}/releases/assets/${assetId}`, {
    method: "DELETE"
  });
}

async function uploadAsset(uploadUrl, filePath) {
  const fileName = path.basename(filePath);
  const targetUrl = `${uploadUrl.replace("{?name,label}", "")}?name=${encodeURIComponent(fileName)}`;
  const bytes = fs.readFileSync(filePath);
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/octet-stream",
      "User-Agent": "ycswu-launcher-publisher",
      "Content-Length": String(bytes.byteLength)
    },
    body: bytes
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Asset upload failed ${response.status}: ${body}`);
  }

  return response.json();
}

async function publishApp(appEntry) {
  const remoteEntry = remoteCatalog.apps.find((item) => item.id === appEntry.id);
  const tag = remoteEntry?.source?.releaseTag || buildReleaseTag(distribution, appEntry.id, appEntry.version);
  const release = await ensureRelease(tag, appEntry);
  const assetCandidates = [
    path.join(stagingRoot, appEntry.id, appEntry.version, path.basename(appEntry.source?.localArtifacts?.portable || "")),
    path.join(stagingRoot, appEntry.id, appEntry.version, path.basename(appEntry.source?.localArtifacts?.installer || ""))
  ].filter((candidate) => fs.existsSync(candidate));

  const uploaded = [];

  for (const filePath of assetCandidates) {
    const fileName = path.basename(filePath);
    const existing = (release.assets || []).find((asset) => asset.name === fileName);

    if (existing && !dryRun) {
      await deleteAsset(existing.id);
    }

    if (dryRun) {
      uploaded.push({ fileName, skipped: true });
      continue;
    }

    const result = await uploadAsset(release.upload_url, filePath);
    uploaded.push({ fileName, browserDownloadUrl: result.browser_download_url });
  }

  return {
    id: appEntry.id,
    version: appEntry.version,
    tag,
    uploaded
  };
}

async function updateManifestFile() {
  const manifestPath = distribution.manifestPath;
  const rawContent = fs.readFileSync(remoteCatalogPath, "utf8");
  const encodedContent = Buffer.from(rawContent, "utf8").toString("base64");

  let sha = null;

  try {
    const existing = await githubRequest(
      `/repos/${distribution.owner}/${distribution.repo}/contents/${encodeURIComponent(manifestPath)}?ref=${encodeURIComponent(distribution.manifestBranch)}`
    );
    sha = existing.sha;
  } catch (error) {
    if (!String(error.message).includes("404")) {
      throw error;
    }
  }

  if (dryRun) {
    return { manifestPath, branch: distribution.manifestBranch, skipped: true };
  }

  await githubRequest(`/repos/${distribution.owner}/${distribution.repo}/contents/${encodeURIComponent(manifestPath)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `Update launcher manifest ${new Date().toISOString()}`,
      content: encodedContent,
      branch: distribution.manifestBranch,
      sha
    })
  });

  return {
    manifestPath,
    branch: distribution.manifestBranch,
    url: distribution.rawManifestUrl
  };
}

const results = [];

for (const appEntry of selectedApps) {
  results.push(await publishApp(appEntry));
}

const manifestUpdate = await updateManifestFile();

console.log(
  JSON.stringify(
    {
      repo: `${distribution.owner}/${distribution.repo}`,
      dryRun,
      apps: results,
      manifest: manifestUpdate
    },
    null,
    2
  )
);
