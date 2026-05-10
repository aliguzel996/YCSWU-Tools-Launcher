const IMAGE_ROUTER_TOOL_IDS = new Set(["pixelmaxxxing", "hot-vs-nice", "giffer"]);

const state = {
  catalog: null,
  selectedAppId: null,
  activeToolTab: "image-router",
  routerItems: [],
  activity: [
    {
      type: "info",
      text: "Launcher hazir. Catalog okununca install ve update durumu ayni panelden akacak."
    }
  ]
};

const elements = {
  shell: document.querySelector(".shell"),
  catalogColumn: document.querySelector(".catalog-column"),
  appGrid: document.querySelector("#app-grid"),
  detailPanel: document.querySelector("#detail-panel"),
  activityLog: document.querySelector("#activity-log"),
  refreshButton: document.querySelector("#refresh-button"),
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

function getSelectedApp() {
  return state.catalog?.apps.find((item) => item.id === state.selectedAppId) || null;
}

function openInfo(appId) {
  state.selectedAppId = appId;
  renderDetail();
  highlightSelection();
}

function renderCardActions(appEntry) {
  const buttons = [];

  if (appEntry.availableActions.install) {
    buttons.push(`<button class="small-button" data-run-action="install" type="button">install</button>`);
  }

  if (appEntry.availableActions.open) {
    buttons.push(`<button class="small-button" data-run-action="launch" type="button">open</button>`);
  }

  if (appEntry.availableActions.update) {
    buttons.push(`<button class="small-button" data-run-action="update" type="button">update</button>`);
  }

  if (appEntry.availableActions.github) {
    buttons.push(
      `<button class="small-button ghost" data-open-github="${escapeHtml(appEntry.githubUrl)}" type="button">github</button>`
    );
  }

  if (appEntry.links?.siteUrl) {
    buttons.push(
      `<button class="small-button ghost" data-open-web="${escapeHtml(appEntry.links.siteUrl)}" type="button">try on web</button>`
    );
  }

  buttons.push(`<button class="small-button ghost" data-open-info="true" type="button">info</button>`);

  return buttons.join("");
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
    const versionPill = node.querySelector(".version-pill");
    const statusPill = node.querySelector(".status-pill");
    const headline = node.querySelector(".card-headline");
    const description = node.querySelector(".card-description");
    const actions = node.querySelector(".card-actions");

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
    versionPill.textContent = `v${appEntry.latestVersion}`;
    statusPill.textContent = appEntry.state.label;
    statusPill.classList.add(getStatusTone(appEntry.state.status));
    headline.textContent = appEntry.headline;
    description.textContent = appEntry.description;
    actions.innerHTML = renderCardActions(appEntry);

    if (state.selectedAppId === appEntry.id) {
      node.classList.add("is-selected");
    }

    node.addEventListener("click", async (event) => {
      const actionButton = event.target.closest("[data-run-action]");
      const githubButton = event.target.closest("[data-open-github]");
      const webButton = event.target.closest("[data-open-web]");
      const infoButton = event.target.closest("[data-open-info]");

      if (actionButton) {
        event.stopPropagation();
        await handleAction(appEntry.id, actionButton.dataset.runAction);
        return;
      }

      if (githubButton) {
        event.stopPropagation();
        await openExternalLink(githubButton.dataset.openGithub, "GitHub link opened.");
        return;
      }

      if (webButton) {
        event.stopPropagation();
        await openExternalLink(webButton.dataset.openWeb, "Web tool page opened.");
        return;
      }

      if (infoButton) {
        event.stopPropagation();
        openInfo(appEntry.id);
        return;
      }

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
      <button class="tool-tab ${state.activeToolTab === "image-router" ? "is-active" : ""}" data-tool-tab="image-router" type="button">image router</button>
      <button class="tool-tab ${state.activeToolTab === "release-map" ? "is-active" : ""}" data-tool-tab="release-map" type="button">release map</button>
      <button class="tool-tab ${state.activeToolTab === "quick-actions" ? "is-active" : ""}" data-tool-tab="quick-actions" type="button">quick actions</button>
    </div>
  `;
}

function getRouterCandidates() {
  if (!state.catalog) {
    return [];
  }

  return state.catalog.apps.filter((appEntry) => IMAGE_ROUTER_TOOL_IDS.has(appEntry.id));
}

function renderRouterCandidates(fileEntry) {
  const candidates = getRouterCandidates();

  if (candidates.length === 0) {
    return `<div class="tool-empty">No image-aware tools are registered yet.</div>`;
  }

  return `
    <div class="router-candidates">
      ${candidates
        .map(
          (appEntry) => `
            <div class="router-candidate">
              <div class="router-candidate-name">${escapeHtml(appEntry.name)}</div>
              <div class="router-candidate-meta">${escapeHtml(appEntry.state.label)}</div>
              <button class="small-button ghost" type="button" disabled>
                open with ${escapeHtml(appEntry.name)}
              </button>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderImageRouter() {
  const hasItems = state.routerItems.length > 0;

  return `
    <div class="tool-stack">
      ${renderToolTabs()}
      <div class="tool-panel">
        <label class="drop-zone ${hasItems ? "" : "is-empty"}" for="router-input">
          <span class="drop-zone-title">drop image or click to load</span>
        </label>
        <input id="router-input" class="hidden-input" type="file" accept="image/*" multiple />
        ${
          hasItems
            ? `
              <div class="router-list">
                ${state.routerItems
                  .map(
                    (fileEntry) => `
                      <article class="router-item">
                        <div class="router-item-head">
                          <div>
                            <div class="router-file">${escapeHtml(fileEntry.name)}</div>
                            <div class="router-file-meta">${escapeHtml(fileEntry.mime || "unknown type")}</div>
                          </div>
                        </div>
                        ${renderRouterCandidates(fileEntry)}
                      </article>
                    `
                  )
                  .join("")}
              </div>
            `
            : `
              <div class="tool-empty">
                Load a still image here, then the launcher will show which YCSWU tools can take the next step.
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

  return renderImageRouter();
}

function renderDetailActions(appEntry) {
  const buttons = [];

  if (appEntry.availableActions.install) {
    buttons.push(`<button class="primary-button" data-detail-action="install" type="button">install</button>`);
  }

  if (appEntry.availableActions.open) {
    buttons.push(`<button class="primary-button" data-detail-action="launch" type="button">open</button>`);
  }

  if (appEntry.availableActions.update) {
    buttons.push(`<button class="primary-button" data-detail-action="update" type="button">update</button>`);
  }

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
          <span class="status-pill ${getStatusTone(appEntry.state.status)}">${escapeHtml(appEntry.state.label)}</span>
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

  const routerInput = elements.detailPanel.querySelector("#router-input");

  if (routerInput) {
    routerInput.addEventListener("change", async (event) => {
      await addRouterFiles(event.target.files);
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
      await addRouterFiles(event.dataTransfer.files);
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
  for (const actionButton of elements.detailPanel.querySelectorAll("[data-detail-action]")) {
    actionButton.addEventListener("click", async () => {
      await handleAction(appEntry.id, actionButton.dataset.detailAction);
    });
  }

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

async function addRouterFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));

  if (files.length === 0) {
    pushActivity("No supported image file was loaded.", "error");
    return;
  }

  const nextItems = files.map((file) => ({
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    mime: file.type || "unknown"
  }));

  state.routerItems = [...nextItems, ...state.routerItems].slice(0, 12);
  state.activeToolTab = "image-router";
  renderDetail();
  pushActivity(`${files.length} image loaded into router.`, "success");
}

async function bootstrap() {
  document.querySelector("#hero-site-link")?.addEventListener("click", async () => {
    await openExternalLink("https://ycswu.co/", "ycswu.co opened.");
  });

  document.querySelector("#hero-wordmark-link")?.addEventListener("click", async () => {
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

  elements.refreshButton.addEventListener("click", async () => {
    await refreshCatalogAndShowTools("Release check completed.");
  });

  try {
    await loadCatalog();
  } catch (error) {
    pushActivity(error.message, "error");
  }
}

bootstrap();

// TODO: File handoff from image router into tool executables should be wired
// through launcher IPC once the target apps expose a stable "open with file" entrypoint.
