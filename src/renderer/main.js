const state = {
  catalog: null,
  selectedAppId: null,
  activeToolTab: "image-inverter",
  inverterItems: [],
  activity: [
    {
      type: "info",
      text: "Launcher hazir. Catalog okununca install ve update durumu ayni panelden akacak."
    }
  ]
};

const SUPPORT_ITCH_URL = "https://ycswu.itch.io/";
const SUPPORT_GITHUB_URL = "https://github.com/aliguzel996";

const elements = {
  shell: document.querySelector(".shell"),
  catalogColumn: document.querySelector(".catalog-column"),
  appGrid: document.querySelector("#app-grid"),
  detailPanel: document.querySelector("#detail-panel"),
  activityLog: document.querySelector("#activity-log"),
  cardTemplate: document.querySelector("#app-card-template")
};

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

function getStatusTone(status) {
  switch (status) {
    case "not-installed":
      return "status-ready";
    case "installed":
      return "status-installed";
    case "update-available":
      return "status-update";
    case "up-to-date":
      return "status-current";
    case "broken-link":
      return "status-broken";
    case "unknown":
    default:
      return "status-unknown";
  }
}

function getVisibleStatusLabel(appEntry) {
  if (!appEntry?.state) {
    return "";
  }

  if (appEntry.state.status === "not-installed") {
    return "";
  }

  return appEntry.state.label || "";
}

function getSelectedApp() {
  return state.catalog?.apps.find((item) => item.id === state.selectedAppId) || null;
}

function openInfo(appId) {
  state.selectedAppId = appId;
  renderDetail();
  highlightSelection();
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

    node.addEventListener("click", async () => {
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
                PNG, JPG or WEBP still images can be inverted here without leaving the launcher.
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
          <div>${escapeHtml(appEntry.localVersion || "none")}</div>
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
  const buttons = [
    `<button class="small-button" data-tool-action="check-updates" type="button">check updates</button>`,
    `<button class="small-button" data-tool-action="open-tools-folder" type="button">open tools folder</button>`,
    `<button class="small-button" data-tool-action="open-tools-page" type="button">open YCSWU tools page</button>`,
    `<button class="small-button" data-tool-action="clear-cache" type="button">clear cache</button>`,
    `<button class="small-button" data-tool-action="reload-registry" type="button">reload registry</button>`
  ];

  if (state.catalog?.suiteGithubUrl) {
    buttons.push(`<button class="small-button" data-tool-action="open-github" type="button">open GitHub</button>`);
  }

  return `
    <div class="tool-stack">
      ${renderToolTabs()}
      <div class="tool-panel">
        <div class="quick-actions-grid">
          ${buttons.join("")}
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

function renderDetailActions(appEntry) {
  const buttons = [];

  if (appEntry.availableActions.github) {
    buttons.push(
      `<button class="small-button ghost" data-detail-github="${escapeHtml(appEntry.githubUrl)}" type="button">github</button>`
    );
  }

  if (appEntry.links?.siteUrl) {
    buttons.push(
      `<button class="small-button ghost" data-detail-web="${escapeHtml(appEntry.links.siteUrl)}" type="button">try on web</button>`
    );
  }

  return buttons.join("");
}

function renderSelectedApp(appEntry) {
  const changelogSummary = appEntry.changelogSummary || "No changelog summary is attached yet.";

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
          <span class="version-pill detail-version-pill">local ${escapeHtml(appEntry.localVersion || "none")}</span>
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
        <div class="detail-label">release note</div>
        <div class="detail-value">${escapeHtml(changelogSummary)}</div>
      </div>
      <div class="detail-block">
        <div class="detail-label">release source</div>
        <div class="detail-value">${escapeHtml(appEntry.releaseSource?.label || "unknown")}</div>
      </div>
      <div class="detail-actions">
        ${renderDetailActions(appEntry)}
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

      if (action === "check-updates") {
        await refreshCatalogAndShowTools("Release check completed.");
        return;
      }

      if (action === "open-tools-folder") {
        const result = await window.launcher.openPath(state.catalog.managedAppsRoot);
        pushActivity(result.ok ? "Tools folder opened." : "Tools folder could not be opened.", result.ok ? "success" : "error");
        return;
      }

      if (action === "open-tools-page") {
        await openExternalLink(state.catalog.toolsPageUrl || "https://ycswu.co/araclar/", "YCSWU tools page opened.");
        return;
      }

      if (action === "open-github") {
        await openExternalLink(state.catalog.suiteGithubUrl, "GitHub link opened.");
        return;
      }

      if (action === "clear-cache") {
        const result = await window.launcher.clearCache();
        state.catalog = result.catalog;
        state.selectedAppId = null;
        renderGrid();
        renderDetail();
        pushActivity("Cache cleared.", "success");
        return;
      }

      if (action === "reload-registry") {
        await refreshCatalogAndShowTools("Registry reloaded.");
      }
    });
  }
}

function bindDetailEvents(appEntry) {
  for (const githubButton of elements.detailPanel.querySelectorAll("[data-detail-github]")) {
    githubButton.addEventListener("click", async () => {
      await openExternalLink(githubButton.dataset.detailGithub, "GitHub link opened.");
    });
  }

  for (const webButton of elements.detailPanel.querySelectorAll("[data-detail-web]")) {
    webButton.addEventListener("click", async () => {
      await openExternalLink(webButton.dataset.detailWeb, "Web tool page opened.");
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
  bindDetailEvents(appEntry);
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

function logUpdateSummary() {
  const updateCount = (state.catalog?.apps || []).filter((appEntry) => appEntry.state.status === "update-available").length;

  if (updateCount > 0) {
    pushActivity(`${updateCount} update available.`, "info");
  }
}

async function loadCatalog(method = "getCatalog") {
  pushActivity("Release check started.");
  const response =
    method === "refreshCatalog" ? await window.launcher.refreshCatalog() : await window.launcher.getCatalog();
  state.catalog = response;

  if (!state.catalog.apps.some((item) => item.id === state.selectedAppId)) {
    state.selectedAppId = null;
  }

  renderGrid();
  renderDetail();
  renderActivity();
  pushActivity("Registry loaded.", "success");
  pushActivity("Release check completed.", "success");
  logUpdateSummary();
}

async function refreshCatalogAndShowTools(message = "Registry reloaded.") {
  state.selectedAppId = null;
  await loadCatalog("refreshCatalog");
  highlightSelection();
  pushActivity(message, "success");
}

async function handleAction(appId, action) {
  const appEntry = state.catalog.apps.find((item) => item.id === appId);
  const isInstallFlow = action === "install" || action === "update";

  try {
    if (isInstallFlow) {
      pushActivity(`Install started for ${appEntry.name}.`);
    }

    const result = await window.launcher.runAction({ appId, action });
    state.catalog = result.catalog;

    if (!state.selectedAppId) {
      state.selectedAppId = appId;
    }

    renderGrid();
    renderDetail();

    if (isInstallFlow) {
      pushActivity("Install completed.", "success");
    }

    pushActivity(result.message, "success");
    logUpdateSummary();
  } catch (error) {
    if (isInstallFlow) {
      pushActivity(`Install failed for ${appEntry.name}.`, "error");
    }

    pushActivity(`${appEntry.name}: ${error.message}`, "error");
  }
}

async function openExternalLink(url, message) {
  if (!url) {
    return;
  }

  await window.launcher.openExternal(url);
  pushActivity(message, "success");
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

async function bootstrap() {
  document.querySelector("#support-itch-link")?.addEventListener("click", async () => {
    await openExternalLink(SUPPORT_ITCH_URL, "Support page opened.");
  });

  document.querySelector("#support-github-link")?.addEventListener("click", async () => {
    await openExternalLink(SUPPORT_GITHUB_URL, "GitHub profile opened.");
  });

  document.querySelector("#hero-site-link")?.addEventListener("click", async () => {
    await openExternalLink("https://ycswu.co/", "ycswu.co opened.");
  });

  document.querySelector("#hero-wordmark-link")?.addEventListener("click", async () => {
    await openExternalLink("https://ycswu.co/", "ycswu.co opened.");
  });

  document.querySelector("#hero-external-link")?.addEventListener("click", async () => {
    await openExternalLink("https://ycswu.co/", "ycswu.co opened.");
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
  }
}

bootstrap();
