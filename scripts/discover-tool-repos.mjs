import fs from "node:fs";
import path from "node:path";
import { loadReleaseContext, resolveGithubDistribution } from "./lib/release-config.mjs";

const workspaceRoot = process.cwd();
const githubToken = process.env.YCSWU_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
const {
  releaseSources,
  discoveredToolsPath,
  localCatalog
} = loadReleaseContext(workspaceRoot);
const distribution = resolveGithubDistribution(releaseSources);
const owner = process.env.YCSWU_TOOL_OWNER || distribution.owner;
const manifestCandidates = ["app.manifest.json", "metadata/manifest/tool.manifest.json"];

if (!githubToken) {
  throw new Error("GITHUB_TOKEN veya YCSWU_GITHUB_TOKEN tanimli degil.");
}

function githubApi(pathname) {
  return `https://api.github.com${pathname}`;
}

function encodeGithubContentPath(filePath) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function githubRequest(pathname) {
  const response = await fetch(githubApi(pathname), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "User-Agent": "ycswu-tool-discovery"
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  return response.json();
}

async function listOwnedRepos() {
  const allRepos = [];
  let page = 1;

  while (true) {
    const repos = await githubRequest(`/users/${owner}/repos?per_page=100&page=${page}&sort=updated&type=owner`);

    if (!Array.isArray(repos) || repos.length === 0) {
      break;
    }

    allRepos.push(...repos);

    if (repos.length < 100) {
      break;
    }

    page += 1;
  }

  return allRepos;
}

async function fetchRepoManifest(repoName) {
  for (const manifestPath of manifestCandidates) {
    const result = await githubRequest(
      `/repos/${owner}/${repoName}/contents/${encodeGithubContentPath(manifestPath)}`
    );

    if (!result?.content) {
      continue;
    }

    const raw = Buffer.from(result.content, "base64").toString("utf8");

    try {
      return {
        manifestPath,
        manifest: JSON.parse(raw)
      };
    } catch {
      continue;
    }
  }

  return null;
}

function createMonogram(name = "YT") {
  return name
    .split(/[\s-_]+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function inferVersion(tagName, manifest, repoName) {
  if (tagName) {
    const candidates = [
      `${manifest.id || repoName}-v`,
      `${repoName}-v`,
      "v"
    ];

    for (const prefix of candidates) {
      if (tagName.startsWith(prefix)) {
        return tagName.slice(prefix.length);
      }
    }
  }

  return manifest.version || "0.0.0";
}

function pickReleaseAssets(release, manifest) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const exeAssets = assets.filter((asset) => asset.name?.toLowerCase().endsWith(".exe"));
  const portableAsset = exeAssets.find((asset) => asset.name.toLowerCase().includes("portable")) || null;
  const installerAsset =
    exeAssets.find((asset) => /setup|installer/.test(asset.name.toLowerCase())) || null;
  const fallbackAsset = exeAssets[0] || null;
  const windowsUrl = manifest.downloadUrls?.windows || "";

  if (portableAsset) {
    return {
      strategy: "portable",
      packageUrl: portableAsset.browser_download_url,
      portableUrl: portableAsset.browser_download_url,
      installerUrl: installerAsset?.browser_download_url || ""
    };
  }

  if (installerAsset) {
    return {
      strategy: "nsis",
      packageUrl: "",
      portableUrl: "",
      installerUrl: installerAsset.browser_download_url
    };
  }

  if (fallbackAsset) {
    const isInstaller = /setup|installer/.test(fallbackAsset.name.toLowerCase());

    return isInstaller
      ? {
          strategy: "nsis",
          packageUrl: "",
          portableUrl: "",
          installerUrl: fallbackAsset.browser_download_url
        }
      : {
          strategy: "portable",
          packageUrl: fallbackAsset.browser_download_url,
          portableUrl: fallbackAsset.browser_download_url,
          installerUrl: ""
        };
  }

  if (windowsUrl) {
    const isInstaller = /setup|installer/.test(windowsUrl.toLowerCase());

    return isInstaller
      ? { strategy: "nsis", packageUrl: "", portableUrl: "", installerUrl: windowsUrl }
      : { strategy: "portable", packageUrl: windowsUrl, portableUrl: windowsUrl, installerUrl: "" };
  }

  return {
    strategy: "portable",
    packageUrl: "",
    portableUrl: "",
    installerUrl: ""
  };
}

async function fetchLatestRelease(repoName) {
  const latest = await githubRequest(`/repos/${owner}/${repoName}/releases/latest`);

  if (latest) {
    return latest;
  }

  const releaseList = await githubRequest(`/repos/${owner}/${repoName}/releases?per_page=1`);
  return Array.isArray(releaseList) ? releaseList[0] || null : null;
}

function normalizeDiscoveredTool(repo, manifest, manifestPath, release) {
  const version = inferVersion(release?.tag_name, manifest, repo.name);
  const install = pickReleaseAssets(release, manifest);
  const repoUrl = manifest.github || repo.html_url || "";
  const id = manifest.id || repo.name;

  return {
    id,
    name: manifest.name || repo.name,
    headline: manifest.shortDescription || manifest.aiDescription || `${repo.name} tool`,
    description: manifest.shortDescription || manifest.aiDescription || `${repo.name} tool`,
    version,
    channel: release?.prerelease ? "beta" : "stable",
    art: {
      monogram: createMonogram(manifest.name || repo.name),
      background: "#0d0d0d",
      foreground: "#ffffff",
      imagePath: ""
    },
    links: {
      siteUrl: manifest.website || `https://ycswu.co/${id}/`,
      repoUrl
    },
    install: {
      strategy: install.strategy,
      packageUrl: install.packageUrl,
      portableUrl: install.portableUrl,
      installerUrl: install.installerUrl,
      launchExecutable: manifest.name ? `${manifest.name}.exe` : `${repo.name}.exe`,
      installDirName: id,
      discoveryPaths: []
    },
    source: {
      repoPath: repo.html_url,
      packageJsonPath: manifestPath,
      buildCommands: {},
      releaseTagPrefix: `${id}-v`,
      assetPatterns: {},
      localArtifacts: {},
      releaseTag: release?.tag_name || `${id}-v${version}`,
      remoteBaseUrl: release?.html_url || manifest.latestReleaseUrl || repo.html_url,
      autoDiscovered: true,
      discoverySource: manifestPath
    }
  };
}

const knownIds = new Set(localCatalog.apps.map((appEntry) => appEntry.id));
const repos = await listOwnedRepos();
const discoveredApps = [];

for (const repo of repos) {
  if (repo.name === distribution.repo) {
    continue;
  }

  if (repo.fork || repo.archived) {
    continue;
  }

  const manifestResult = await fetchRepoManifest(repo.name);

  if (!manifestResult) {
    continue;
  }

  const { manifest, manifestPath } = manifestResult;
  const toolId = manifest.id || repo.name;

  if (knownIds.has(toolId)) {
    continue;
  }

  const release = await fetchLatestRelease(repo.name);
  discoveredApps.push(normalizeDiscoveredTool(repo, manifest, manifestPath, release));
}

const output = {
  owner,
  syncedAt: new Date().toISOString(),
  apps: discoveredApps.sort((left, right) => left.name.localeCompare(right.name))
};

fs.writeFileSync(discoveredToolsPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Discovered ${discoveredApps.length} auto-registered tools.`);
