const MANIFEST_CANDIDATES = [
  "https://raw.githubusercontent.com/aliguzel996/YCSWU-Tools-Launcher/main/catalog.json",
  "./catalog.json"
];

const elements = {
  siteGrid: document.querySelector("#site-grid"),
  siteMeta: document.querySelector("#site-meta"),
  manifestSource: document.querySelector("#manifest-source"),
  syncStamp: document.querySelector("#sync-stamp"),
  cardTemplate: document.querySelector("#site-card-template")
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchCatalog() {
  for (const url of MANIFEST_CANDIDATES) {
    try {
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        continue;
      }

      const catalog = await response.json();

      if (!catalog || !Array.isArray(catalog.apps)) {
        continue;
      }

      return { catalog, source: url };
    } catch {
      continue;
    }
  }

  throw new Error("Catalog could not be loaded from local or GitHub source.");
}

function renderCard(appEntry) {
  const node = elements.cardTemplate.content.firstElementChild.cloneNode(true);
  const art = node.querySelector(".card-art");
  const title = node.querySelector(".card-title");
  const version = node.querySelector(".card-version");
  const channel = node.querySelector(".card-channel");
  const headline = node.querySelector(".card-headline");
  const description = node.querySelector(".card-description");
  const meta = node.querySelector(".card-meta");
  const actions = node.querySelector(".card-actions");

  art.style.background = appEntry.art?.background || "#000000";
  art.style.color = appEntry.art?.foreground || "#ffffff";
  art.innerHTML = appEntry.art?.imagePath
    ? `<img src="${escapeHtml(appEntry.art.imagePath)}" alt="${escapeHtml(appEntry.name)} logo" />`
    : escapeHtml(appEntry.art?.monogram || appEntry.name.slice(0, 2).toUpperCase());

  title.textContent = appEntry.name;
  version.textContent = `v${appEntry.version}`;
  channel.textContent = appEntry.channel || "stable";
  headline.textContent = appEntry.headline || "";
  description.textContent = appEntry.description || "";
  meta.textContent = `release tag: ${appEntry.source?.releaseTag || "pending"} / source: github releases`;

  const buttons = [];
  const downloadUrl = appEntry.install?.packageUrl || appEntry.install?.portableUrl || appEntry.install?.installerUrl || "";

  if (downloadUrl) {
    buttons.push(
      `<a class="site-button primary" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noreferrer">${
        appEntry.install?.strategy === "nsis" ? "download setup" : "download latest"
      }</a>`
    );
  }

  if (appEntry.links?.repoUrl) {
    buttons.push(
      `<a class="site-button ghost" href="${escapeHtml(appEntry.links.repoUrl)}" target="_blank" rel="noreferrer">github</a>`
    );
  }

  if (appEntry.links?.siteUrl) {
    buttons.push(
      `<a class="site-button ghost" href="${escapeHtml(appEntry.links.siteUrl)}" target="_blank" rel="noreferrer">try on web</a>`
    );
  }

  actions.innerHTML = buttons.join("");
  return node;
}

function renderCatalog({ catalog, source }) {
  elements.siteGrid.innerHTML = "";
  elements.siteMeta.textContent = `${catalog.apps.length} tools / github-tracked catalog`;
  elements.manifestSource.textContent = `manifest source: ${source}`;
  elements.syncStamp.textContent = `last sync: ${catalog.suite?.builtAt || catalog.suite?.syncedAt || "unknown"}`;

  for (const appEntry of catalog.apps) {
    elements.siteGrid.append(renderCard(appEntry));
  }
}

function renderError(message) {
  elements.siteMeta.textContent = "catalog load failed";
  elements.manifestSource.textContent = "manifest source: unavailable";
  elements.syncStamp.textContent = "last sync: unavailable";
  elements.siteGrid.innerHTML = `<div class="site-error">${escapeHtml(message)}</div>`;
}

async function bootstrap() {
  try {
    const result = await fetchCatalog();
    renderCatalog(result);
  } catch (error) {
    renderError(error.message);
  }
}

bootstrap();
