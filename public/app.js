const form = document.getElementById("searchForm");
const statusEl = document.getElementById("status");
const apiSection = document.getElementById("apiSection");
const apiResults = document.getElementById("apiResults");
const canvaSection = document.getElementById("canvaSection");
const canvaTerms = document.getElementById("canvaTerms");
const canvaToolkitSection = document.getElementById("canvaToolkitSection");
const canvaToolkit = document.getElementById("canvaToolkit");
const sourceLinksSection = document.getElementById("sourceLinksSection");
const sourceLinks = document.getElementById("sourceLinks");
const timelineForm = document.getElementById("timelineForm");
const timelineSection = document.getElementById("timelineSection");
const timelineResults = document.getElementById("timelineResults");
const loadScriptExample = document.getElementById("loadScriptExample");

function setStatus(message) { statusEl.textContent = message || ""; }
async function copyText(text) { await navigator.clipboard.writeText(text || ""); }
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function escapeAttribute(value) { return escapeHtml(value).replaceAll("`", "&#096;"); }
function policyClass(policy = "") {
  const p = policy.toLowerCase();
  if (p.includes("free download")) return "good";
  if (p.includes("reference")) return "ref";
  if (p.includes("paid") || p.includes("subscription") || p.includes("license") || p.includes("archive")) return "warn";
  return "";
}

function renderSourceLinks(groups) {
  sourceLinks.innerHTML = "";
  groups.forEach((group) => {
    const wrap = document.createElement("div");
    wrap.className = "source-group";
    wrap.innerHTML = `
      <div class="source-group-head">
        <h3>${escapeHtml(group.group)}</h3>
        <p>${escapeHtml(group.note)}</p>
      </div>
      <div class="source-chip-grid">
        ${group.sources.map((source) => `
          <a class="source-chip" href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">
            <span>${escapeHtml(source.name)}</span>
            <small class="policy ${policyClass(source.policy)}">${escapeHtml(source.policy)}</small>
            <small>${escapeHtml(source.action)}</small>
          </a>`).join("")}
      </div>`;
    sourceLinks.appendChild(wrap);
  });
  sourceLinksSection.classList.remove("hidden");
}


function renderCanvaToolkit(data) {
  if (!data) return;
  canvaToolkit.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "canva-toolkit";
  const categoryHtml = (data.categories || []).map((group, idx) => `
    <div class="canva-card">
      <div class="canva-card-head">
        <div>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.description || "")}</p>
        </div>
        <button type="button" class="ghost-copy" data-copy-all="${idx}">Copy all</button>
      </div>
      <div class="canva-term-grid">
        ${(group.terms || []).map((term) => `
          <button type="button" class="canva-chip" data-copy-term="${escapeAttribute(term)}">${escapeHtml(term)}</button>
        `).join("")}
      </div>
    </div>
  `).join("");
  wrap.innerHTML = `
    <div class="canva-summary">
      <div>
        <p class="summary-tag">Best workflow</p>
        <h3>Search Canva stock smarter</h3>
        <p>${escapeHtml(data.summary || "")}</p>
      </div>
      <div class="canva-action-row">
        ${(data.actions || []).map((action) => `
          <a class="canva-action" href="${escapeAttribute(action.url)}" target="_blank" rel="noreferrer">
            <strong>${escapeHtml(action.name)}</strong>
            <small>${escapeHtml(action.description)}</small>
          </a>
        `).join("")}
      </div>
    </div>
    <div class="canva-grid">${categoryHtml}</div>
    <div class="canva-workflow">
      <h3>Suggested Canva workflow</h3>
      <ol>
        ${(data.workflow || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>
    </div>`;
  canvaToolkit.appendChild(wrap);

  wrap.querySelectorAll("[data-copy-term]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.getAttribute("data-copy-term") || "";
      await copyText(value);
      const old = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = old), 1000);
    });
  });

  wrap.querySelectorAll("[data-copy-all]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.getAttribute("data-copy-all"));
      const terms = data.categories?.[index]?.terms || [];
      await copyText(terms.join("\n"));
      const old = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = old), 1000);
    });
  });

  canvaToolkitSection.classList.remove("hidden");
}

function renderCanvaTerms(items) {
  canvaTerms.innerHTML = "";
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "term";
    div.innerHTML = `
      <strong>${escapeHtml(item.term)}</strong>
      <small>${escapeHtml(item.note)}</small>
      <button type="button">Copy term</button>`;
    div.querySelector("button").addEventListener("click", async (event) => {
      await copyText(item.term);
      event.target.textContent = "Copied";
      setTimeout(() => (event.target.textContent = "Copy term"), 1200);
    });
    canvaTerms.appendChild(div);
  });
  canvaSection.classList.remove("hidden");
}

function renderApiSource(sourceData) {
  const block = document.createElement("div");
  block.className = "api-block";
  const error = sourceData.error ? `<p class="error">${escapeHtml(sourceData.error)}</p>` : "";
  const cards = (sourceData.results || []).map(renderCard).join("");
  block.innerHTML = `
    <h3>${escapeHtml(sourceData.source)}</h3>
    ${error}
    ${(sourceData.results || []).length ? `<div class="grid">${cards}</div>` : `<p class="empty">No direct API results from this source yet. Use the search links below.</p>`}`;
  return block;
}

function renderCard(item) {
  const mainAction = item.directUrl
    ? `<a href="${escapeAttribute(item.directUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.actionLabel || "Open")}</a>`
    : "";
  return `
    <article class="card">
      <img class="thumb" src="${escapeAttribute(item.thumbnail)}" alt="${escapeAttribute(item.title)}" loading="lazy" onerror="this.style.display='none'" />
      <div class="card-body">
        <span class="policy ${policyClass(item.policy)}">${escapeHtml(item.policy)}</span>
        <h4>${escapeHtml(item.title)}</h4>
        <div class="meta">
          <div><strong>Source:</strong> ${escapeHtml(item.source)}</div>
          <div><strong>Creator:</strong> ${escapeHtml(item.creator)}</div>
          <div><strong>Size:</strong> ${escapeHtml(item.width || "N/A")} × ${escapeHtml(item.height || "N/A")}</div>
          <div><strong>Duration:</strong> ${escapeHtml(item.duration || "N/A")}</div>
        </div>
        <div class="actions">
          <a href="${escapeAttribute(item.sourcePage)}" target="_blank" rel="noreferrer">Source page</a>
          ${mainAction}
          <button type="button" onclick="navigator.clipboard.writeText('${escapeAttribute(item.directUrl || item.sourcePage)}')">Copy link</button>
          <button type="button" onclick="navigator.clipboard.writeText('${escapeAttribute(item.attribution || '')}')">Copy credit</button>
        </div>
      </div>
    </article>`;
}

function renderApiResults(api) {
  apiResults.innerHTML = "";
  [api.pexels, api.pixabay, api.youtube, api.unsplash].forEach((sourceData) => {
    apiResults.appendChild(renderApiSource(sourceData));
  });
  apiSection.classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const q = document.getElementById("query").value.trim();
  const orientation = document.getElementById("orientation").value;
  const perPage = document.getElementById("perPage").value;
  if (!q) return;

  apiSection.classList.add("hidden");
  canvaToolkitSection.classList.add("hidden");
  canvaSection.classList.add("hidden");
  sourceLinksSection.classList.add("hidden");
  if (timelineSection) timelineSection.classList.add("hidden");
  setStatus("Radar is scanning live APIs, Canva terms, stock sites, archives, and reference platforms...");

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(q)}&orientation=${encodeURIComponent(orientation)}&per_page=${encodeURIComponent(perPage)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Search failed");
    renderApiResults(data.apiResults || {});
    renderCanvaToolkit(data.canvaToolkit || {});
    renderCanvaTerms(data.canvaSuggestions || []);
    renderSourceLinks(data.sourceLinks || []);
    setStatus("Done. Open source pages and check the badge before downloading or publishing.");
  } catch (error) {
    setStatus(error.message || "Something went wrong.");
  }
});


function renderCompactCard(item) {
  return `
    <div class="compact-card">
      <img src="${escapeAttribute(item.thumbnail)}" alt="${escapeAttribute(item.title)}" loading="lazy" onerror="this.style.display='none'" />
      <div>
        <span class="policy ${policyClass(item.policy)}">${escapeHtml(item.policy)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.creator || "")}</small>
        <div class="compact-actions">
          <a href="${escapeAttribute(item.sourcePage)}" target="_blank" rel="noreferrer">Open</a>
          ${item.directUrl ? `<a href="${escapeAttribute(item.directUrl)}" target="_blank" rel="noreferrer">File</a>` : ""}
          <button type="button" data-copy-term="${escapeAttribute(item.sourcePage)}">Copy link</button>
        </div>
      </div>
    </div>`;
}

function attachCopyHandlers(root = document) {
  root.querySelectorAll("[data-copy-term]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.getAttribute("data-copy-term") || "";
      await copyText(value);
      const old = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = old), 1000);
    });
  });
}

function renderTimelineCard(item, index) {
  const terms = (item.searchTerms || []).map((term) => `
    <button type="button" class="canva-chip" data-copy-term="${escapeAttribute(term)}">${escapeHtml(term)}</button>
  `).join("");

  const canvaBlocks = (item.canvaTerms || []).map((group) => `
    <div class="timeline-mini">
      <h4>${escapeHtml(group.title)}</h4>
      <div class="canva-term-grid">
        ${(group.terms || []).slice(0, 3).map((term) => `
          <button type="button" class="canva-chip" data-copy-term="${escapeAttribute(term)}">${escapeHtml(term)}</button>
        `).join("")}
      </div>
    </div>
  `).join("");

  const sourceBlocks = ["pexels", "pixabay", "youtube", "unsplash"].map((key) => {
    const source = item.results?.[key];
    if (!source) return "";
    const cards = (source.results || []).slice(0, 3).map(renderCompactCard).join("");
    return `
      <div class="timeline-source">
        <h4>${escapeHtml(source.source)}</h4>
        ${source.error ? `<p class="error">${escapeHtml(source.error)}</p>` : ""}
        ${cards || `<p class="empty">No direct results. Use the terms above.</p>`}
      </div>`;
  }).join("");

  return `
    <article class="timeline-item">
      <div class="timeline-top">
        <div class="timestamp">${escapeHtml(item.timestamp || `Scene ${index + 1}`)}</div>
        <div>
          <h3>${escapeHtml(item.visualType || "media scene")}</h3>
          <p>${escapeHtml(item.scriptLine || "")}</p>
          <small>${escapeHtml(item.visualNote || "")}</small>
        </div>
      </div>
      <div class="timeline-mini">
        <h4>Search terms</h4>
        <div class="canva-term-grid">${terms}</div>
      </div>
      <div class="timeline-canva">${canvaBlocks}</div>
      <div class="timeline-source-grid">${sourceBlocks}</div>
    </article>`;
}

function renderTimelineResults(items) {
  timelineResults.innerHTML = (items || []).map(renderTimelineCard).join("");
  attachCopyHandlers(timelineResults);
  timelineSection.classList.remove("hidden");
}

if (timelineForm) {
  timelineForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const script = document.getElementById("scriptInput").value.trim();
    const topic = document.getElementById("topicInput").value.trim();
    const orientation = document.getElementById("timelineOrientation").value;
    const perTimestamp = document.getElementById("timelinePerTimestamp").value;
    if (!script) return setStatus("Paste a timestamped script first.");

    apiSection.classList.add("hidden");
    canvaToolkitSection.classList.add("hidden");
    canvaSection.classList.add("hidden");
    sourceLinksSection.classList.add("hidden");
    timelineSection.classList.add("hidden");
    setStatus("Analyzing timestamps and searching media options...");

    try {
      const response = await fetch("/api/timeline-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, topic, orientation, perTimestamp }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Timeline search failed");
      renderTimelineResults(data.timeline || []);
      setStatus(`Done. Created media search plans for ${data.count || 0} timestamps.`);
    } catch (error) {
      setStatus(error.message || "Something went wrong.");
    }
  });
}

if (loadScriptExample) {
  loadScriptExample.addEventListener("click", () => {
    document.getElementById("topicInput").value = "Toyota Tundra truck recall automotive";
    document.getElementById("scriptInput").value =
`00:00 Toyota Tundra owners started hearing reports about engine problems.
00:08 The recall affected pickup trucks and raised questions at dealerships.
00:16 Mechanics inspected engines while drivers waited for answers.
00:24 A document on screen reveals the key recall detail.
00:32 A truck drives down the highway as the story closes.`;
  });
}


document.querySelectorAll(".examples button[data-query]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById("query").value = button.dataset.query || "";
    document.getElementById("query").focus();
  });
});
