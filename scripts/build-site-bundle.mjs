import fs from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const siteRoot = path.join(workspaceRoot, "site");
const siteDistRoot = path.join(workspaceRoot, "site-dist");
const remoteCatalogPath = path.join(workspaceRoot, "config", "catalog.remote.json");
const rootCatalogPath = path.join(workspaceRoot, "catalog.json");
const distCatalogPath = path.join(siteDistRoot, "catalog.json");

if (!fs.existsSync(remoteCatalogPath)) {
  throw new Error("config/catalog.remote.json bulunamadi. Once build:remote-manifest calistirin.");
}

fs.rmSync(siteDistRoot, { recursive: true, force: true });
fs.mkdirSync(siteDistRoot, { recursive: true });
fs.cpSync(siteRoot, siteDistRoot, { recursive: true });

const remoteCatalog = fs.readFileSync(remoteCatalogPath, "utf8");
fs.writeFileSync(rootCatalogPath, remoteCatalog, "utf8");
fs.writeFileSync(distCatalogPath, remoteCatalog, "utf8");

console.log(`Site bundle written to ${siteDistRoot}`);
