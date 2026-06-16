
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
const downloadGuideBtn = document.getElementById("downloadGuideBtn");
const downloadWordBtn = document.getElementById("downloadWordBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const downloadSelectedBtn = document.getElementById("downloadSelectedBtn");
const assistantSection = document.getElementById("assistantSection");
const assistantContent = document.getElementById("assistantContent");
const historyContent = document.getElementById("historyContent");
const adminContent = document.getElementById("adminContent");

let latestTimelineItems = [];
let latestTimelineContext = { topic: "", guide: "", niche: "general", orientation: "any" };
const SOURCE_KEYS = ["pexels", "pixabay", "youtube", "unsplash", "openverse", "nasa", "commons", "archive", "flickr", "giphy"];
let selectedDownloads = [];
const HISTORY_KEY = "elias_media_history_v1";
const STATS_KEY = "elias_media_stats_v1";

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
function slugify(value) {
  return String(value || "media").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "media";
}
function getEnabledSources(selector) {
  return [...document.querySelectorAll(selector + ':checked')].map((el) => el.value);
}
function incStat(key, amount = 1) {
  const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{"searches":0,"timelineRuns":0,"downloads":0}');
  stats[key] = (stats[key] || 0) + amount;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  renderAdmin();
}
function saveHistory(entry) {
  const items = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  items.unshift({ id: Date.now(), createdAt: new Date().toISOString(), ...entry });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
  renderHistory();
}
function renderHistory() {
  const items = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  if (!historyContent) return;
  if (!items.length) {
    historyContent.innerHTML = '<p class="empty">No saved projects yet. Run a timestamped script and it will appear here.</p>';
    return;
  }
  historyContent.innerHTML = items.map((item) => `
    <article class="history-card">
      <strong>${escapeHtml(item.topic || item.niche || 'Untitled project')}</strong>
      <small>${new Date(item.createdAt).toLocaleString()}</small>
      <p>${escapeHtml((item.script || '').split('\n')[0] || '')}</p>
      <div class="compact-actions">
        <button type="button" data-history-id="${item.id}">Load</button>
      </div>
    </article>`).join('');
  historyContent.querySelectorAll('[data-history-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = items.find((row) => String(row.id) === btn.dataset.historyId);
      if (!item) return;
      document.getElementById('topicInput').value = item.topic || '';
      document.getElementById('timelineNiche').value = item.niche || 'general';
      document.getElementById('guideInput').value = item.guide || '';
      document.getElementById('scriptInput').value = item.script || '';
      window.scrollTo({ top: document.getElementById('timelineForm').offsetTop - 20, behavior: 'smooth' });
    });
  });
}
function renderAdmin() {
  const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{"searches":0,"timelineRuns":0,"downloads":0}');
  adminContent.innerHTML = `
    <div class="admin-card"><strong>${stats.searches || 0}</strong><span>Searches</span></div>
    <div class="admin-card"><strong>${stats.timelineRuns || 0}</strong><span>Timeline runs</span></div>
    <div class="admin-card"><strong>${stats.downloads || 0}</strong><span>Downloads triggered</span></div>
    <div class="admin-card"><strong>${JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').length}</strong><span>Saved local projects</span></div>`;
}
function buildDownloadUrl(item) {
  if (!item?.directUrl) return "";
  if ((item.source || "").toLowerCase().includes("youtube")) return "";
  const params = new URLSearchParams({
    source: item.source || "media",
    url: item.directUrl || "",
    filename: `${slugify(item.source || 'media')}-${slugify(item.title || item.id || 'file')}`,
  });
  if (item.downloadLocation) params.set("downloadLocation", item.downloadLocation);
  return `/api/download?${params.toString()}`;
}
function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function downloadWord(filename, html) {
  const blob = new Blob([`<html><head><meta charset="utf-8"></head><body>${html}</body></html>`], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function timelineToCsvRows(items) {
  const rows = [["Timestamp", "Script line", "Visual type", "Visual note", "Search term 1", "Search term 2", "Search term 3", "Pexels", "Pixabay", "YouTube", "Unsplash", "Openverse", "NASA", "Wikimedia", "Archive", "Flickr", "GIPHY", "CapCut note", "Suggested SFX"]];
  (items || []).forEach((item) => {
    const getFirst = (key) => item.results?.[key]?.results?.[0]?.sourcePage || "";
    const edit = inferEditGuide(item);
    rows.push([item.timestamp || "", item.scriptLine || "", item.visualType || "", item.visualNote || "", item.searchTerms?.[0] || "", item.searchTerms?.[1] || "", item.searchTerms?.[2] || "", getFirst("pexels"), getFirst("pixabay"), getFirst("youtube"), getFirst("unsplash"), edit.editing, edit.sfx]);
  });
  return rows;
}
function inferEditGuide(item) {
  const visual = (item.visualType || '').toLowerCase();
  if (visual.includes('automotive')) return { editing: 'Use quick cuts, push-in zooms, engine/detail close-ups, dealership B-roll, and lower-third labels.', sfx: 'Engine rev, whoosh transition, soft impact hit.' };
  if (visual.includes('aviation')) return { editing: 'Use slow pans, map overlays, cockpit inserts, and clean documentary captions.', sfx: 'Air whoosh, radar beep, soft cinematic rise.' };
  if (visual.includes('document')) return { editing: 'Use slight zoom, highlight boxes, crop-ins, and typewriter-style text reveals.', sfx: 'Paper rustle, click, light typewriter.' };
  if (visual.includes('map')) return { editing: 'Animate route lines, apply gentle zoom, and keep text minimal and readable.', sfx: 'Whoosh, digital ping, subtle pulse.' };
  if (visual.includes('business')) return { editing: 'Use clean slide transitions, chart overlays, and simple keyword callouts.', sfx: 'Light click, soft riser, ambient office tone.' };
  return { editing: 'Use short clips, subtle zooms, clean text overlays, and a simple cut or dissolve between scenes.', sfx: 'Light whoosh, ambient bed, soft hit.' };
}
function buildCanvaSearchLink(term) {
  return `https://www.canva.com/search?q=${encodeURIComponent(term)}`;
}
function buildMusicLinks(topic) {
  const q = encodeURIComponent(topic || 'cinematic background music');
  return [
    { name: 'Pixabay Music', url: `https://pixabay.com/music/search/${q}/` },
    { name: 'Pixabay Sound Effects', url: `https://pixabay.com/sound-effects/search/${q}/` },
    { name: 'Mixkit Music', url: `https://mixkit.co/free-stock-music/?q=${q}` },
    { name: 'Mixkit Sound Effects', url: `https://mixkit.co/free-sound-effects/?q=${q}` },
  ];
}
function buildThumbnailIdeas(topic, niche) {
  const clean = topic || 'Your story';
  const hooks = [
    `${clean}: What Really Happened?`,
    `The Truth About ${clean}`,
    `Why ${clean} Matters`
  ];
  const visuals = {
    automotive: ['close-up of vehicle front grille', 'mechanic checking engine', 'car on highway at sunset'],
    aviation: ['aircraft nose close-up', 'cockpit instrument panel', 'runway takeoff shot'],
    documentary: ['dramatic archive still', 'headline over blurred background', 'wide establishing shot'],
    motivation: ['confident person walking forward', 'city skyline at sunrise', 'hands on steering wheel or desk'],
    business: ['office desk with charts', 'city skyline business district', 'person presenting graphs'],
    music: ['performer on stage lights', 'microphone close-up', 'crowd silhouette with lights'],
    architecture: ['building exterior wide shot', 'interior detail shot', 'construction or design workspace'],
    general: ['strong close-up subject', 'wide context shot', 'detail shot with text space']
  };
  return { hooks, visuals: visuals[niche] || visuals.general };
}
function renderAssistant() {
  if (!assistantSection) return;
  if (!latestTimelineItems.length) {
    assistantSection.classList.add('hidden');
    return;
  }
  const topic = latestTimelineContext.topic || latestTimelineContext.niche || 'Project';
  const niche = latestTimelineContext.niche || 'general';
  const thumb = buildThumbnailIdeas(topic, niche);
  const firstTerm = latestTimelineItems[0]?.searchTerms?.[0] || topic;
  const music = buildMusicLinks(topic);
  assistantContent.innerHTML = `
    <div class="assistant-grid">
      <div class="assistant-card">
        <h3>Thumbnail assistant</h3>
        <p>Possible thumbnail hook text:</p>
        <ul>${thumb.hooks.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
        <p>Thumbnail visual ideas:</p>
        <ul>${thumb.visuals.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
      </div>
      <div class="assistant-card">
        <h3>Canva quick actions</h3>
        <p>Open Canva search straight from this project:</p>
        <div class="compact-actions">
          <a href="${escapeAttribute(buildCanvaSearchLink(firstTerm))}" target="_blank" rel="noreferrer">Open Canva search</a>
          <button type="button" id="copyAllCanvaBtn">Copy Canva terms</button>
        </div>
        <small>It copies the Canva search terms from every timestamp in one click.</small>
      </div>
      <div class="assistant-card">
        <h3>Music and sound search</h3>
        <div class="compact-actions link-wrap">${music.map((m) => `<a href="${escapeAttribute(m.url)}" target="_blank" rel="noreferrer">${escapeHtml(m.name)}</a>`).join('')}</div>
        <small>Use these links to find background music and sound effects for this topic.</small>
      </div>
    </div>
    <div class="assistant-card full-width">
      <h3>CapCut editing guide</h3>
      <div class="guide-table">
        ${(latestTimelineItems || []).map((item) => {
          const edit = inferEditGuide(item);
          return `<div class="guide-row"><strong>${escapeHtml(item.timestamp || '')}</strong><span>${escapeHtml(edit.editing)}</span><small>SFX: ${escapeHtml(edit.sfx)}</small></div>`;
        }).join('')}
      </div>
    </div>`;
  assistantSection.classList.remove('hidden');
  const copyBtn = document.getElementById('copyAllCanvaBtn');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const terms = latestTimelineItems.flatMap((item) => item.canvaTerms?.flatMap((group) => group.terms || []) || []);
    await copyText([...new Set(terms)].join('\n'));
    copyBtn.textContent = 'Copied';
    setTimeout(() => copyBtn.textContent = 'Copy Canva terms', 1000);
  });
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
    <div class="canva-grid">${categoryHtml}</div>`;
  canvaToolkit.appendChild(wrap);
  attachCopyHandlers(wrap);
  wrap.querySelectorAll("[data-copy-all]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.getAttribute("data-copy-all"));
      const terms = data.categories?.[index]?.terms || [];
      await copyText(terms.join("\n"));
      const old = button.textContent; button.textContent = "Copied"; setTimeout(() => (button.textContent = old), 1000);
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
      <div class="compact-actions"><button type="button">Copy term</button><a href="${escapeAttribute(buildCanvaSearchLink(item.term))}" target="_blank" rel="noreferrer">Open Canva</a></div>`;
    div.querySelector("button").addEventListener("click", async (event) => {
      await copyText(item.term); event.target.textContent = "Copied"; setTimeout(() => (event.target.textContent = "Copy term"), 1200);
    });
    canvaTerms.appendChild(div);
  });
  canvaSection.classList.remove("hidden");
}
function renderApiSource(sourceData) {
  const block = document.createElement("div");
  block.className = "api-block";
  const error = sourceData.error ? `<p class="error">${escapeHtml(sourceData.error)}</p>` : "";
  const cards = (sourceData.results || []).map((item) => renderCard(item, sourceData.source)).join("");
  block.innerHTML = `
    <h3>${escapeHtml(sourceData.source)}</h3>
    ${error}
    ${(sourceData.results || []).length ? `<div class="grid">${cards}</div>` : `<p class="empty">No direct API results from this source yet. Use the search links below.</p>`}`;
  return block;
}
function buildSelectableId(item) { return `${slugify(item.source)}-${slugify(item.id || item.title)}`; }
function pushSelectable(item) {
  const downloadUrl = buildDownloadUrl(item);
  if (!downloadUrl) return;
  if (!selectedDownloads.some((row) => row.id === buildSelectableId(item))) {
    selectedDownloads.push({ id: buildSelectableId(item), title: item.title, url: downloadUrl });
  }
}
function renderCard(item, sourceName = '') {
  pushSelectable(item);
  const downloadUrl = buildDownloadUrl(item);
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
          ${item.directUrl ? `<a href="${escapeAttribute(item.directUrl)}" target="_blank" rel="noreferrer">Open file</a>` : ""}
          ${downloadUrl ? `<a href="${escapeAttribute(downloadUrl)}">Download</a>` : ""}
          ${downloadUrl ? `<label class="select-download"><input type="checkbox" class="download-check" value="${escapeAttribute(buildSelectableId(item))}" /> Select</label>` : ""}
          <button type="button" data-copy-term="${escapeAttribute(item.directUrl || item.sourcePage)}">Copy link</button>
          <button type="button" data-copy-term="${escapeAttribute(item.attribution || '')}">Copy credit</button>
        </div>
      </div>
    </article>`;
}
function renderApiResults(api) {
  selectedDownloads = [];
  apiResults.innerHTML = "";
  const enabled = getEnabledSources('.src-filter');
  SOURCE_KEYS.map((key) => api[key]).filter(Boolean).forEach((sourceData) => {
    const key = (sourceData.source || '').toLowerCase();
    const sourceLabel = (sourceData.source || "").toLowerCase();
    if (enabled.some((name) => sourceLabel.includes(name) || (name === "commons" && sourceLabel.includes("wikimedia")) || (name === "archive" && sourceLabel.includes("internet archive")))) apiResults.appendChild(renderApiSource(sourceData));
  });
  apiSection.classList.remove("hidden");
  attachCopyHandlers(apiResults);
  syncSelectedDownloadButton();
}
function buildCanvaTermsHtml(item) {
  const groups = item.canvaTerms || [];
  return groups.map((group) => `
    <div class="timeline-mini">
      <h4>${escapeHtml(group.title)}</h4>
      <div class="canva-term-grid">
        ${(group.terms || []).slice(0, 3).map((term) => `
          <button type="button" class="canva-chip" data-copy-term="${escapeAttribute(term)}">${escapeHtml(term)}</button>
        `).join("")}
      </div>
      ${(group.terms || [])[0] ? `<div class="compact-actions"><a href="${escapeAttribute(buildCanvaSearchLink(group.terms[0]))}" target="_blank" rel="noreferrer">Open Canva search</a></div>` : ''}
    </div>`).join('');
}
function renderCompactCard(item) {
  pushSelectable(item);
  const downloadUrl = buildDownloadUrl(item);
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
          ${downloadUrl ? `<a href="${escapeAttribute(downloadUrl)}">Download</a>` : ""}
          ${downloadUrl ? `<label class="select-download"><input type="checkbox" class="download-check" value="${escapeAttribute(buildSelectableId(item))}" /> Select</label>` : ''}
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
      const old = button.textContent; button.textContent = "Copied"; setTimeout(() => (button.textContent = old), 1000);
    });
  });
  root.querySelectorAll('.download-check').forEach((input) => input.addEventListener('change', syncSelectedDownloadButton));
}
function syncSelectedDownloadButton() {
  const anyChecked = document.querySelectorAll('.download-check:checked').length > 0;
  if (downloadSelectedBtn) downloadSelectedBtn.classList.toggle('hidden', !anyChecked);
}
function renderTimelineCard(item, index) {
  const edit = inferEditGuide(item);
  const terms = (item.searchTerms || []).map((term) => `<button type="button" class="canva-chip" data-copy-term="${escapeAttribute(term)}">${escapeHtml(term)}</button>`).join("");
  const enabled = getEnabledSources('.timeline-src-filter');
  const sourceBlocks = SOURCE_KEYS.filter((key) => enabled.includes(key)).map((key) => {
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
      <div class="timeline-mini">
        <h4>CapCut note</h4>
        <p>${escapeHtml(edit.editing)}</p>
        <small>Suggested SFX: ${escapeHtml(edit.sfx)}</small>
      </div>
      <div class="timeline-canva">${buildCanvaTermsHtml(item)}</div>
      <div class="timeline-source-grid">${sourceBlocks}</div>
    </article>`;
}
function renderTimelineResults(items) {
  selectedDownloads = [];
  latestTimelineItems = items || [];
  timelineResults.innerHTML = latestTimelineItems.map(renderTimelineCard).join("");
  attachCopyHandlers(timelineResults);
  timelineSection.classList.remove("hidden");
  [downloadGuideBtn, downloadWordBtn, downloadPdfBtn].forEach((btn) => btn && btn.classList.remove('hidden'));
  syncSelectedDownloadButton();
  renderAssistant();
}
function applyNiche(topic, niche) {
  const prefixes = {
    automotive: 'cars trucks automotive',
    aviation: 'aviation aircraft airport',
    documentary: 'documentary news real footage',
    motivation: 'motivational cinematic lifestyle',
    business: 'business finance office economy',
    music: 'music performance stage singer',
    architecture: 'architecture building interior exterior'
  };
  return niche && niche !== 'general' ? `${topic} ${prefixes[niche] || ''}`.trim() : topic;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const niche = document.getElementById('searchNiche').value;
  const qBase = document.getElementById("query").value.trim();
  const q = applyNiche(qBase, niche);
  const orientation = document.getElementById("orientation").value;
  const perPage = document.getElementById("perPage").value;
  if (!qBase) return;
  apiSection.classList.add("hidden"); canvaToolkitSection.classList.add("hidden"); canvaSection.classList.add("hidden"); sourceLinksSection.classList.add("hidden");
  if (timelineSection) timelineSection.classList.add("hidden"); assistantSection.classList.add('hidden');
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
    incStat('searches');
  } catch (error) {
    setStatus(error.message || "Something went wrong.");
  }
});
if (timelineForm) {
  timelineForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const topicBase = document.getElementById("topicInput").value.trim();
    const niche = document.getElementById('timelineNiche').value;
    const topic = applyNiche(topicBase, niche);
    const guide = document.getElementById("guideInput").value.trim();
    const script = document.getElementById("scriptInput").value.trim();
    const orientation = document.getElementById("timelineOrientation").value;
    const perTimestamp = document.getElementById("timelinePerTimestamp").value;
    if (!script) return setStatus("Paste a timestamped script first.");
    apiSection.classList.add("hidden"); canvaToolkitSection.classList.add("hidden"); canvaSection.classList.add("hidden"); sourceLinksSection.classList.add("hidden"); timelineSection.classList.add("hidden"); assistantSection.classList.add('hidden');
    setStatus("Analyzing timestamps and searching media options...");
    try {
      const response = await fetch("/api/timeline-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script, topic, guide, orientation, perTimestamp }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Timeline search failed");
      latestTimelineContext = { topic: topicBase, guide, niche, orientation };
      renderTimelineResults(data.timeline || []);
      saveHistory({ topic: topicBase, niche, guide, script });
      setStatus(`Done. Created media search plans for ${data.count || 0} timestamps.`);
      incStat('timelineRuns');
    } catch (error) {
      setStatus(error.message || "Something went wrong.");
    }
  });
}
if (loadScriptExample) {
  loadScriptExample.addEventListener("click", () => {
    document.getElementById("topicInput").value = "Toyota Tundra truck recall";
    document.getElementById('timelineNiche').value = 'automotive';
    document.getElementById("guideInput").value = "Use realistic car and truck footage, mechanic close-ups, dealership shots, clean documentary style, no animals, no cartoons.";
    document.getElementById("scriptInput").value = `00:00 Toyota Tundra owners started hearing reports about engine problems.
00:08 The recall affected pickup trucks and raised questions at dealerships.
00:16 Mechanics inspected engines while drivers waited for answers.
00:24 A document on screen reveals the key recall detail.
00:32 A truck drives down the highway as the story closes.`;
  });
}
document.querySelectorAll(".examples button[data-query]").forEach((button) => {
  button.addEventListener("click", () => { document.getElementById("query").value = button.dataset.query || ""; document.getElementById("query").focus(); });
});
if (downloadGuideBtn) {
  downloadGuideBtn.addEventListener("click", () => { downloadCsv("elias-media-guide.csv", timelineToCsvRows(latestTimelineItems)); });
}
if (downloadWordBtn) {
  downloadWordBtn.addEventListener('click', () => {
    const html = `
      <h1>Elias Media Guide</h1>
      <p><strong>Topic:</strong> ${escapeHtml(latestTimelineContext.topic)}</p>
      ${(latestTimelineItems || []).map((item) => {
        const edit = inferEditGuide(item);
        return `<h2>${escapeHtml(item.timestamp)}</h2><p><strong>Script:</strong> ${escapeHtml(item.scriptLine)}</p><p><strong>Search terms:</strong> ${escapeHtml((item.searchTerms || []).join(', '))}</p><p><strong>CapCut note:</strong> ${escapeHtml(edit.editing)}</p><p><strong>SFX:</strong> ${escapeHtml(edit.sfx)}</p>`;
      }).join('')}`;
    downloadWord('elias-media-guide.doc', html);
  });
}
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener('click', () => window.print());
}
if (downloadSelectedBtn) {
  downloadSelectedBtn.addEventListener('click', async () => {
    const checked = [...document.querySelectorAll('.download-check:checked')].map((el) => el.value);
    const chosen = selectedDownloads.filter((item) => checked.includes(item.id));
    if (!chosen.length) return;
    chosen.forEach((item, idx) => setTimeout(() => window.open(item.url, '_blank'), idx * 600));
    incStat('downloads', chosen.length);
    setStatus(`Started ${chosen.length} download(s). Check your browser downloads.`);
  });
}
renderHistory();
renderAdmin();
