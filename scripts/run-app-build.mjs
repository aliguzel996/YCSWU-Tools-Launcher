import { spawn } from "node:child_process";
import path from "node:path";
import { loadReleaseContext, parseCsvArg, selectApps } from "./lib/release-config.mjs";

const workspaceRoot = process.cwd();
const { releaseSources, localCatalog } = loadReleaseContext(workspaceRoot);
const includeIds = parseCsvArg(process.argv, "--apps");
const skipIds = parseCsvArg(process.argv, "--skip");
const mode = process.argv.find((item) => item.startsWith("--mode="))?.split("=")[1] || "preferred";

const selectedApps = selectApps(localCatalog.apps, includeIds, skipIds);

function runCommand(command, workdir) {
  return new Promise((resolve, reject) => {
    const child = spawn("C:\\WINDOWS\\System32\\cmd.exe", ["/d", "/s", "/c", command], {
      cwd: workdir,
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}: ${command}`));
    });

    child.on("error", reject);
  });
}

function resolveBuildCommand(sourceEntry, appEntry) {
  if (mode === "portable") {
    return sourceEntry.buildCommands.portable || "";
  }

  if (mode === "installer") {
    return sourceEntry.buildCommands.installer || sourceEntry.buildCommands.portable || "";
  }

  if (appEntry.install.strategy === "nsis") {
    return sourceEntry.buildCommands.installer || sourceEntry.buildCommands.portable || "";
  }

  return sourceEntry.buildCommands.portable || sourceEntry.buildCommands.installer || "";
}

for (const appEntry of selectedApps) {
  const sourceEntry = releaseSources.apps.find((item) => item.id === appEntry.id);

  if (!sourceEntry) {
    console.warn(`Skipping ${appEntry.id}: source config not found.`);
    continue;
  }

  const command = resolveBuildCommand(sourceEntry, appEntry);

  if (!command) {
    console.warn(`Skipping ${appEntry.id}: build command not configured.`);
    continue;
  }

  console.log(`\n==> ${appEntry.id}`);
  console.log(`repo: ${sourceEntry.repoPath}`);
  console.log(`command: ${command}`);
  await runCommand(command, sourceEntry.repoPath);
}

console.log("\nSelected builds completed.");
