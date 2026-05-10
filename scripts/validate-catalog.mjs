import fs from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const manifestPath = path.join(workspaceRoot, "config", "catalog.local.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const errors = [];

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

assert(typeof manifest.suite?.name === "string", "suite.name gerekli.");
assert(Array.isArray(manifest.apps), "apps dizi olmali.");

for (const appEntry of manifest.apps || []) {
  assert(typeof appEntry.id === "string" && appEntry.id.length > 0, `app.id gerekli: ${JSON.stringify(appEntry)}`);
  assert(typeof appEntry.name === "string" && appEntry.name.length > 0, `${appEntry.id}: app.name gerekli.`);
  assert(typeof appEntry.version === "string" && appEntry.version.length > 0, `${appEntry.id}: version gerekli.`);
  assert(typeof appEntry.headline === "string" && appEntry.headline.length > 0, `${appEntry.id}: headline gerekli.`);
  assert(typeof appEntry.description === "string" && appEntry.description.length > 0, `${appEntry.id}: description gerekli.`);
  assert(typeof appEntry.install?.strategy === "string", `${appEntry.id}: install.strategy gerekli.`);
  assert(typeof appEntry.install?.launchExecutable === "string", `${appEntry.id}: install.launchExecutable gerekli.`);
  assert(typeof appEntry.art?.monogram === "string", `${appEntry.id}: art.monogram gerekli.`);
}

if (process.argv.includes("--print")) {
  console.log(
    JSON.stringify(
      {
        suite: manifest.suite.name,
        appCount: manifest.apps.length,
        apps: manifest.apps.map((appEntry) => ({
          id: appEntry.id,
          version: appEntry.version,
          strategy: appEntry.install.strategy
        }))
      },
      null,
      2
    )
  );
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log(`Catalog valid: ${manifest.apps.length} app entry checked.`);
