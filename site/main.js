const MANIFEST_CANDIDATES = [
  "./catalog.json",
  "https://raw.githubusercontent.com/aliguzel996/YCSWU-Tools-Launcher/main/catalog.json"
];

const SUPPORT_ITCH_URL = "https://ycswu.itch.io/";
const SUPPORT_GITHUB_URL = "https://github.com/aliguzel996";
const SUPPORT_MAIL_URL = "mailto:hiycswu@gmail.com";
const LAUNCHER_DOWNLOAD_URL = "https://ycswu.itch.io/ycswu-desktop-launcher";

const state = {
  catalog: null,
  selectedAppId: null,
  activeToolTab: "image-inverter",
  inverterItems: [],
  activity: [
    {
      type: "info",
      text: "Web katalogu hazir. Araclar, repo linkleri ve inverter ayni panelde toplaniyor."
    }
  ]
};

const elements = {
  catalogColumn: document.querySelector(".catalog-column"),
  appGrid: document.querySelector("#app-grid"),
  detailPanel: document.querySelector("#detail-panel"),
  activityLog: document.querySelector("#activity-log"),
  cardTemplate: document.querySelector("#app-card-template")
};

const mobileViewportQuery = window.matchMedia("(max-width: 640px)");

function updateViewportMode() {
  document.documentElement.classList.toggle("is-mobile-view", mobileViewportQuery.matches);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pushActivity(text, type = "info") {
  state.activity.unshift({ text, type });
  state.activity = state.activity.slice(0, 14);
  renderActivity();
}

function clearSelection() {
  if (!state.selectedAppId) {
    return;
  }

  state.selectedAppId = null;
  renderDetail();
  highlightSelection();
}

function getSelectedApp() {
  return state.catalog?.apps.find((item) => item.id === state.selectedAppId) || null;
}

function openExternalLink(url, message) {
  if (!url) {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  pushActivity(message, "success");
}

function fetchCatalogStatus(appEntry) {
  if (appEntry.install?.packageUrl || appEntry.install?.portableUrl || appEntry.install?.installerUrl) {
    return { status: "ready", label: "" };
  }

  return { status: "unknown", label: "UNKNOWN" };
}

function startLauncherDownload() {
  window.open(LAUNCHER_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
  pushActivity("Desktop launcher download opened.", "success");
}

function getStatusTone(status) {
  switch (status) {
    case "ready":
      return "status-ready";
    case "installed":
      return "status-installed";
    case "update":
      return "status-update";
    case "current":
      return "status-current";
    case "broken":
      return "status-broken";
    case "unknown":
    default:
      return "status-unknown";
  }
}

function getVisibleStatusLabel(appEntry) {
  return appEntry?.state?.label || "";
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

function enrichCatalog(catalog, source) {
  const suiteGithubUrl =
    catalog?.suite?.distribution?.owner && catalog?.suite?.distribution?.repo
      ? `https://github.com/${catalog.suite.distribution.owner}/${catalog.suite.distribution.repo}`
      : "https://github.com/aliguzel996/YCSWU-Tools-Launcher";

  return {
    ...catalog,
    manifestSource: source,
    suiteGithubUrl,
    toolsPageUrl: catalog?.suite?.supportUrl || "https://ycswu.co/araclar/",
    apps: catalog.apps.map((appEntry) => {
      const status = fetchCatalogStatus(appEntry);

      return {
        ...appEntry,
        latestVersion: appEntry.version || "0.0.0",
        localVersion: "web",
        state: status,
        releaseSource: {
          label: "github repo",
          url: appEntry.links?.repoUrl || ""
        },
        availableActions: {
          github: Boolean(appEntry.links?.repoUrl),
          site: Boolean(appEntry.links?.siteUrl)
        }
      };
    })
  };
}

function renderGrid() {
  elements.appGrid.innerHTML = "";

  if (!state.catalog) {
    return;
  }

  for (const appEntry of state.catalog.apps) {
    const node = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.appId = appEntry.id;

    const art = node.querySelector(".art-badge");
    const title = node.querySelector(".card-title");

    art.style.background = appEntry.art.background;
    art.style.color = appEntry.art.foreground;
    art.innerHTML = "";

    if (appEntry.art.imagePath) {
      const logoImage = document.createElement("img");
      logoImage.className = "art-image";
      logoImage.src = appEntry.art.imagePath;
      logoImage.alt = `${appEntry.name} logo`;
      art.append(logoImage);
      art.classList.add("has-image");
    } else {
      art.textContent = appEntry.art.monogram;
      art.classList.remove("has-image");
    }

    title.textContent = appEntry.name;

    if (state.selectedAppId === appEntry.id) {
      node.classList.add("is-selected");
    }

    node.addEventListener("click", (event) => {
      state.selectedAppId = appEntry.id;
      renderDetail();
      highlightSelection();
    });

    elements.appGrid.append(node);
  }
}

function highlightSelection() {
  for (const card of document.querySelectorAll(".tool-card")) {
    card.classList.toggle("is-selected", card.dataset.appId === state.selectedAppId);
  }
}

function renderToolTabs() {
  return `
    <div class="tool-tabs" role="tablist" aria-label="Launcher tools">
      <button class="tool-tab ${state.activeToolTab === "image-inverter" ? "is-active" : ""}" data-tool-tab="image-inverter" type="button">image inverter</button>
      <button class="tool-tab ${state.activeToolTab === "release-map" ? "is-active" : ""}" data-tool-tab="release-map" type="button">release map</button>
      <button class="tool-tab ${state.activeToolTab === "quick-actions" ? "is-active" : ""}" data-tool-tab="quick-actions" type="button">quick actions</button>
    </div>
  `;
}

function renderImageInverter() {
  const hasItems = state.inverterItems.length > 0;

  return `
    <div class="tool-stack">
      ${renderToolTabs()}
      <div class="tool-panel">
        <label class="drop-zone ${hasItems ? "" : "is-empty"}" for="inverter-input">
          <span class="drop-zone-title">drop image or click to load</span>
        </label>
        <input id="inverter-input" class="hidden-input" type="file" accept="image/*" multiple />
        ${
          hasItems
            ? `
              <div class="inverter-list">
                ${state.inverterItems
                  .map(
                    (fileEntry) => `
                      <article class="inverter-item">
                        <div class="inverter-item-head">
                          <div>
                            <div class="inverter-file">${escapeHtml(fileEntry.name)}</div>
                            <div class="inverter-file-meta">${escapeHtml(fileEntry.mime || "unknown type")}</div>
                          </div>
                          <button class="small-button ghost" data-download-inverted="${escapeHtml(fileEntry.id)}" type="button">download inverted</button>
                        </div>
                        <div class="inverter-preview-grid">
                          <div class="inverter-preview-block">
                            <div class="inverter-preview-label">original</div>
                            <img class="inverter-preview-image" src="${escapeHtml(fileEntry.sourceUrl)}" alt="${escapeHtml(fileEntry.name)} original preview" />
                          </div>
                          <div class="inverter-preview-block">
                            <div class="inverter-preview-label">inverted</div>
                            <img class="inverter-preview-image" src="${escapeHtml(fileEntry.invertedUrl)}" alt="${escapeHtml(fileEntry.name)} inverted preview" />
                          </div>
                        </div>
                      </article>
                    `
                  )
                  .join("")}
              </div>
            `
            : `
              <div class="tool-empty">
                Load a still image here, then compare the original and the inverted pass in the same panel.
              </div>
            `
        }
      </div>
    </div>
  `;
}

function renderReleaseMap() {
  const rows = (state.catalog?.apps || [])
    .map(
      (appEntry) => `
        <div class="release-row">
          <div>${escapeHtml(appEntry.name)}</div>
          <div>web</div>
          <div>v${escapeHtml(appEntry.latestVersion || "0.0.0")}</div>
          <div>${escapeHtml(appEntry.state.label)}</div>
          <div>${escapeHtml(appEntry.releaseSource?.label || "unknown")}</div>
        </div>
      `
    )
    .join("");

  return `
    <div class="tool-stack">
      ${renderToolTabs()}
      <div class="tool-panel">
        <div class="release-table">
          <div class="release-row release-head">
            <div>tool</div>
            <div>local</div>
            <div>latest</div>
            <div>status</div>
            <div>source</div>
          </div>
          ${rows}
        </div>
      </div>
    </div>
  `;
}

function renderQuickActions() {
  return `
    <div class="tool-stack">
      ${renderToolTabs()}
      <div class="tool-panel">
        <div class="quick-actions-grid">
          <button class="small-button" data-tool-action="check-updates" type="button">check updates</button>
          <button class="small-button" data-tool-action="open-tools-page" type="button">open YCSWU tools page</button>
          <button class="small-button" data-tool-action="open-github" type="button">open GitHub</button>
          <button class="small-button" data-tool-action="reload-registry" type="button">reload registry</button>
        </div>
      </div>
    </div>
  `;
}

function renderToolHub() {
  if (state.activeToolTab === "release-map") {
    return renderReleaseMap();
  }

  if (state.activeToolTab === "quick-actions") {
    return renderQuickActions();
  }

  return renderImageInverter();
}

function renderSelectedApp(appEntry) {
  return `
    <div class="panel-title">${escapeHtml(appEntry.name)}</div>
    <div class="detail-stack">
      <div class="detail-block">
        <div class="detail-label">status</div>
        <div class="detail-value detail-status-row">
          ${
            getVisibleStatusLabel(appEntry)
              ? `<span class="status-pill ${getStatusTone(appEntry.state.status)}">${escapeHtml(getVisibleStatusLabel(appEntry))}</span>`
              : ""
          }
          <span class="version-pill detail-version-pill">latest v${escapeHtml(appEntry.latestVersion)}</span>
          <span class="version-pill detail-version-pill">local web</span>
        </div>
      </div>
      <div class="detail-block">
        <div class="detail-label">english</div>
        <div class="detail-value">${escapeHtml(appEntry.headline)}</div>
      </div>
      <div class="detail-block">
        <div class="detail-label">turkce</div>
        <div class="detail-value">${escapeHtml(appEntry.description)}</div>
      </div>
      <div class="detail-block">
        <div class="detail-label">release source</div>
        <div class="detail-value">GitHub repo and YCSWU web page links are attached below.</div>
      </div>
      <div class="detail-actions">
        ${
          appEntry.availableActions.github
            ? `<button class="small-button ghost" data-detail-github="${escapeHtml(appEntry.links.repoUrl)}" type="button">github</button>`
            : ""
        }
        ${
          appEntry.availableActions.site
            ? `<button class="small-button ghost" data-detail-web="${escapeHtml(appEntry.links.siteUrl)}" type="button">try on web</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function bindToolHubEvents() {
  for (const tabButton of elements.detailPanel.querySelectorAll("[data-tool-tab]")) {
    tabButton.addEventListener("click", () => {
      state.activeToolTab = tabButton.dataset.toolTab;
      renderDetail();
    });
  }

  const inverterInput = elements.detailPanel.querySelector("#inverter-input");

  if (inverterInput) {
    inverterInput.addEventListener("change", async (event) => {
      await addInverterFiles(event.target.files);
      event.target.value = "";
    });
  }

  const dropZone = elements.detailPanel.querySelector(".drop-zone");

  if (dropZone) {
    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("is-dragging");
    });

    dropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
      await addInverterFiles(event.dataTransfer.files);
    });
  }

  for (const downloadButton of elements.detailPanel.querySelectorAll("[data-download-inverted]")) {
    downloadButton.addEventListener("click", () => {
      downloadInvertedImage(downloadButton.dataset.downloadInverted);
    });
  }

  for (const actionButton of elements.detailPanel.querySelectorAll("[data-tool-action]")) {
    actionButton.addEventListener("click", async () => {
      const action = actionButton.dataset.toolAction;

      if (action === "check-updates" || action === "reload-registry") {
        await refreshCatalogAndShowTools(action === "check-updates" ? "Release check completed." : "Registry reloaded.");
        return;
      }

      if (action === "open-tools-page") {
        openExternalLink(state.catalog.toolsPageUrl, "YCSWU tools page opened.");
        return;
      }

      if (action === "open-github") {
        openExternalLink(state.catalog.suiteGithubUrl, "GitHub link opened.");
      }
    });
  }
}

function bindDetailEvents() {
  for (const githubButton of elements.detailPanel.querySelectorAll("[data-detail-github]")) {
    githubButton.addEventListener("click", () => {
      openExternalLink(githubButton.dataset.detailGithub, "GitHub link opened.");
    });
  }

  for (const webButton of elements.detailPanel.querySelectorAll("[data-detail-web]")) {
    webButton.addEventListener("click", () => {
      openExternalLink(webButton.dataset.detailWeb, "Web tool page opened.");
    });
  }
}

function renderDetail() {
  const appEntry = getSelectedApp();

  if (!appEntry) {
    elements.detailPanel.innerHTML = `
      <div class="panel-title">launcher tools</div>
      ${renderToolHub()}
    `;
    bindToolHubEvents();
    return;
  }

  elements.detailPanel.innerHTML = renderSelectedApp(appEntry);
  bindDetailEvents();
}

function renderActivity() {
  elements.activityLog.innerHTML = state.activity
    .map(
      (entry) => `
        <div class="activity-item ${entry.type}">
          <span class="activity-bullet"></span>
          <span>${escapeHtml(entry.text)}</span>
        </div>
      `
    )
    .join("");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Preview image could not be decoded."));
    image.src = url;
  });
}

async function createInvertedDataUrl(sourceUrl) {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas context could not be created.");
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    data[index] = 255 - data[index];
    data[index + 1] = 255 - data[index + 1];
    data[index + 2] = 255 - data[index + 2];
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function downloadInvertedImage(itemId) {
  const item = state.inverterItems.find((entry) => entry.id === itemId);

  if (!item) {
    return;
  }

  const link = document.createElement("a");
  const safeBase = item.name.replace(/\.[^.]+$/, "");
  link.href = item.invertedUrl;
  link.download = `${safeBase}-inverted.png`;
  link.click();
  pushActivity(`Inverted image downloaded for ${item.name}.`, "success");
}

async function addInverterFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));

  if (files.length === 0) {
    pushActivity("No supported image file was loaded.", "error");
    return;
  }

  const nextItems = [];

  for (const file of files) {
    const sourceUrl = await readFileAsDataUrl(file);
    const invertedUrl = await createInvertedDataUrl(sourceUrl);
    nextItems.push({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      mime: file.type || "unknown",
      sourceUrl,
      invertedUrl
    });
  }

  state.inverterItems = [...nextItems, ...state.inverterItems].slice(0, 12);
  state.activeToolTab = "image-inverter";
  renderDetail();
  pushActivity(`${files.length} image loaded into inverter.`, "success");
}

async function loadCatalog() {
  pushActivity("Release check started.");
  const result = await fetchCatalog();
  state.catalog = enrichCatalog(result.catalog, result.source);

  if (!state.catalog.apps.some((item) => item.id === state.selectedAppId)) {
    state.selectedAppId = null;
  }

  renderGrid();
  renderDetail();
  pushActivity("Registry loaded.", "success");
  pushActivity("Release check completed.", "success");
}

async function refreshCatalogAndShowTools(message = "Registry reloaded.") {
  state.selectedAppId = null;
  await loadCatalog();
  highlightSelection();
  pushActivity(message, "success");
}

async function bootstrap() {
  updateViewportMode();
  mobileViewportQuery.addEventListener("change", updateViewportMode);

  document.querySelector("#support-itch-link")?.addEventListener("click", () => {
    openExternalLink(SUPPORT_ITCH_URL, "Support page opened.");
  });

  document.querySelector("#support-github-link")?.addEventListener("click", () => {
    openExternalLink(SUPPORT_GITHUB_URL, "GitHub profile opened.");
  });

  document.querySelector(".support-mail-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    openExternalLink(SUPPORT_MAIL_URL, "Mail composer opened.");
  });

  document.querySelector("#hero-site-link")?.addEventListener("click", () => {
    openExternalLink("https://ycswu.co/", "ycswu.co opened.");
  });

  document.querySelector("#hero-wordmark-link")?.addEventListener("click", () => {
    openExternalLink("https://ycswu.co/", "ycswu.co opened.");
  });

  document.querySelector("#launcher-download-button")?.addEventListener("click", () => {
    startLauncherDownload();
  });

  elements.catalogColumn.addEventListener("click", (event) => {
    if (event.target.closest(".tool-card") || event.target.closest(".suite-actions")) {
      return;
    }

    clearSelection();
  });

  document.querySelector(".hero-panel")?.addEventListener("click", () => {
    clearSelection();
  });

  try {
    await loadCatalog();
  } catch (error) {
    pushActivity(error.message, "error");
    renderDetail();
  }
}

bootstrap();
