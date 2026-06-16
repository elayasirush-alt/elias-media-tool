
const SOURCES = [
  ["pexels", "Pexels"],
  ["pixabay", "Pixabay"],
  ["unsplash", "Unsplash"],
  ["youtube", "YouTube"],
  ["canva", "Canva"],
  ["openverse", "Openverse"],
  ["nasa", "NASA"],
  ["wikimedia", "Wikimedia"],
  ["archive", "Internet Archive"],
  ["flickr", "Flickr"],
  ["giphy", "GIPHY"],
];

const NICHES = [
  ["general", "General"],
  ["documentary", "Documentary / News"],
  ["automotive", "Cars / Trucks"],
  ["aviation", "Aviation"],
  ["business", "Business / Corporate"],
  ["technology", "Technology / AI"],
  ["finance", "Finance / Economy"],
  ["realestate", "Real Estate"],
  ["architecture", "Architecture / Design"],
  ["construction", "Construction"],
  ["education", "Education"],
  ["healthcare", "Healthcare / Medical"],
  ["travel", "Travel"],
  ["food", "Food / Restaurant"],
  ["sports", "Sports / Fitness"],
  ["lifestyle", "Lifestyle"],
  ["motivation", "Motivation"],
  ["music", "Music / Performance"],
  ["worship", "Worship / Spiritual"],
  ["nature", "Nature / Wildlife"],
  ["politics", "Politics / Government"],
  ["crime", "Crime / Investigation"],
  ["history", "History / Archive"],
  ["science", "Science / Research"],
  ["fashion", "Fashion"],
  ["beauty", "Beauty"],
  ["gaming", "Gaming"],
  ["environment", "Environment / Climate"],
];

let latestSuggestionReport = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function readApi(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { error: text.slice(0, 500) }; }
  }
  if (!response.ok) throw new Error(data.error || `Server error ${response.status}`);
  return data;
}

function selectedSources() {
  return [...document.querySelectorAll(".sourceOpt:checked")].map((x) => x.value);
}

function initControls() {
  document.querySelectorAll("select[id$='niche'], select#niche, select#searchNiche, select#videoNiche").forEach((select) => {
    select.innerHTML = NICHES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  });
  document.getElementById("searchNiche").value = "general";
  document.getElementById("niche").value = "general";
  if (document.getElementById("videoNiche")) document.getElementById("videoNiche").value = "general";

  const sourceBox = document.getElementById("sourceChecks");
  sourceBox.innerHTML = SOURCES.map(([id, label]) => `
    <label class="source-check"><input class="sourceOpt" type="checkbox" value="${id}" checked> ${label}</label>
  `).join("");

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

function renderKeyStatus(keys = {}) {
  const labels = {
    PEXELS_API_KEY: "Pexels",
    PIXABAY_API_KEY: "Pixabay",
    UNSPLASH_ACCESS_KEY: "Unsplash",
    YOUTUBE_API_KEY: "YouTube",
    FLICKR_API_KEY: "Flickr",
    GIPHY_API_KEY: "GIPHY",
  };
  const rows = Object.entries(labels).map(([key, label]) => `
    <div class="key-row"><strong>${label}</strong><span class="${keys[key] ? "good" : "bad"}">${keys[key] ? "Ready" : "Missing"}</span></div>
  `).join("");
  document.getElementById("keyStatus").innerHTML = rows;
  const ready = Object.values(keys).filter(Boolean).length;
  document.getElementById("keyPill").textContent = `${ready}/6 API keys ready`;
}

async function loadStatus() {
  try {
    const data = await readApi(await fetch("/api/status"));
    renderKeyStatus(data.keys || {});
  } catch (_) {}
}

function mediaCard(item) {
  return `
    <article class="media-card">
      ${item.thumbnail ? `<img src="${escapeHtml(item.thumbnail)}" loading="lazy" onerror="this.style.display='none'">` : ""}
      <div class="media-body">
        <div class="media-source">${escapeHtml(item.source)} · ${escapeHtml(item.type)}</div>
        <div class="media-title">${escapeHtml(item.title)}</div>
        ${item.meta ? `<div class="muted">${escapeHtml(item.meta)}</div>` : ""}
        ${item.license ? `<div class="tag">${escapeHtml(item.license)}</div>` : ""}
        <div class="media-links">
          ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open</a>` : ""}
          ${item.downloadUrl ? `<a href="${escapeHtml(item.downloadUrl)}" target="_blank" rel="noopener">Media file</a>` : ""}
          ${item.downloadUrl ? `<a href="${escapeHtml(item.downloadUrl)}" target="_blank" rel="noopener" download>Download</a>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderMediaGroups(data, container) {
  const groups = data.groups || {};
  container.innerHTML = Object.keys(groups).map((name) => `
    <section class="media-group">
      <h3>${escapeHtml(name)} <span class="tag">${groups[name].length} result(s)</span></h3>
      <div class="media-grid">${groups[name].map(mediaCard).join("")}</div>
    </section>
  `).join("");
}


function renderMusicPlan(plan, backgroundMusicResults = []) {
  if (!plan) return "";
  return `
    <section class="scene-card">
      <div class="scene-head">
        <strong>Background music plan</strong>
        <p>${escapeHtml(plan.mainMood || "Serious documentary")}</p>
      </div>
      <div class="scene-body">
        <div>
          <b>How to use background music:</b>
          <div class="tag-row">${(plan.use || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("")}</div>
        </div>
        <div>
          <b>Volume guide:</b>
          <p class="muted">${escapeHtml(plan.volumeGuide || "Keep music under the voiceover.")}</p>
        </div>
        <div>
          <b>Music structure:</b>
          <div class="tag-row">${(plan.structure || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("")}</div>
        </div>
        <div>
          <b>Background music search terms:</b>
          <div class="tag-row">${(plan.searchTerms || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("")}</div>
        </div>
        <div>
          <b>Background music sources to use:</b>
          <div class="media-grid">${(backgroundMusicResults || []).map(mediaCard).join("")}</div>
        </div>
      </div>
    </section>
  `;
}

function renderScene(scene) {
  const mediaHtml = scene.media ? Object.keys(scene.media.groups || {}).map((name) => `
    <section class="media-group">
      <h3>${escapeHtml(name)} <span class="tag">${scene.media.groups[name].length}</span></h3>
      <div class="media-grid">${scene.media.groups[name].map(mediaCard).join("")}</div>
    </section>
  `).join("") : "";

  return `
    <article class="scene-card">
      <div class="scene-head">
        <strong>${escapeHtml(scene.timestamp)} — Scene ${scene.scene}</strong>
        <p>${escapeHtml(scene.text)}</p>
      </div>
      <div class="scene-body">
        <div class="tag-row">
          <span class="tag"><b>Visual:</b> ${escapeHtml(scene.visualPlan)}</span>
          <span class="tag"><b>SFX:</b> ${escapeHtml(scene.sfx)}</span>
          <span class="tag"><b>Music cue:</b> ${escapeHtml(scene.musicCue || "Serious documentary")}</span>
          <span class="tag"><b>Text:</b> ${escapeHtml(scene.textCallout || "No text needed")}</span>
        </div>
        <div>
          <b>Sound effect to use:</b>
          <div class="tag-row">
            <span class="tag">${escapeHtml(scene.sfxDetails?.category || "Transition")}</span>
            <span class="tag">${escapeHtml(scene.sfxDetails?.timing || scene.timestamp)}</span>
            <span class="tag">${escapeHtml(scene.sfxDetails?.volume || "8–12% under voiceover")}</span>
          </div>
          <p class="muted">${escapeHtml(scene.sfxDetails?.use || "Use a light transition effect only where needed.")}</p>
          <b>SFX search terms:</b>
          <div class="tag-row">${(scene.sfxDetails?.searchTerms || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
          <b>Sound effect sources to use:</b>
          <div class="media-grid">${(scene.sfxSources || []).map(mediaCard).join("")}</div>
        </div>
        <div>
          <b>Canva search terms:</b>
          <div class="tag-row">${(scene.canvaTerms || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
        </div>
        ${mediaHtml}
      </div>
    </article>`;
}

async function pollJob(jobId, progressCard, progressText, progressBar) {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const job = await readApi(await fetch(`/api/job/${jobId}`));
        progressCard.classList.remove("hidden");
        progressText.textContent = job.message || "Working...";
        progressBar.style.width = `${job.progress || 0}%`;
        if (job.status === "complete") {
          clearInterval(timer);
          resolve(job.result);
        }
        if (job.status === "failed") {
          clearInterval(timer);
          reject(new Error(job.error || "Job failed."));
        }
      } catch (error) {
        clearInterval(timer);
        reject(error);
      }
    }, 1800);
  });
}

document.getElementById("searchBtn").addEventListener("click", async () => {
  const box = document.getElementById("searchResults");
  box.innerHTML = `<div class="card"><p class="muted">Searching all selected sources...</p></div>`;
  try {
    const payload = {
      query: document.getElementById("searchQuery").value.trim(),
      topic: document.getElementById("searchTopic").value.trim(),
      niche: document.getElementById("searchNiche").value,
      count: Number(document.getElementById("searchCount").value || 6),
      sources: selectedSources(),
    };
    if (!payload.query) return alert("Enter a search query.");
    const data = await readApi(await fetch("/api/search-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));
    box.innerHTML = `<div class="card"><h2>Results for: ${escapeHtml(data.query)}</h2></div><div id="searchGroups"></div>`;
    renderMediaGroups(data, document.getElementById("searchGroups"));
    renderKeyStatus(data.keys || {});
  } catch (error) {
    box.innerHTML = `<div class="card"><p class="bad">${escapeHtml(error.message)}</p></div>`;
  }
});

document.getElementById("suggestBtn").addEventListener("click", async () => {
  const script = document.getElementById("script").value.trim();
  if (!script) return alert("Paste your timestamped script.");
  const progressCard = document.getElementById("suggestProgress");
  const progressText = document.getElementById("suggestProgressText");
  const progressBar = document.getElementById("suggestProgressBar");
  const results = document.getElementById("suggestResults");
  results.innerHTML = "";
  progressCard.classList.remove("hidden");
  progressText.textContent = "Starting suggestions...";
  progressBar.style.width = "1%";
  document.getElementById("suggestBtn").disabled = true;

  try {
    const payload = {
      script,
      topic: document.getElementById("topic").value.trim(),
      niche: document.getElementById("niche").value,
      count: Number(document.getElementById("mediaPerTimestamp").value || 2),
      includeLiveMedia: document.getElementById("includeLiveMedia").value === "true",
      sources: selectedSources(),
    };
    const start = await readApi(await fetch("/api/start-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));
    const data = await pollJob(start.jobId, progressCard, progressText, progressBar);
    renderKeyStatus(data.keys || {});
    results.innerHTML = renderMusicPlan(data.backgroundMusicPlan, data.backgroundMusicResults || []) + data.scenes.map(renderScene).join("");
    latestSuggestionReport = [
      "BACKGROUND MUSIC PLAN",
      `Main mood: ${data.backgroundMusicPlan?.mainMood || ""}`,
      `Volume: ${data.backgroundMusicPlan?.volumeGuide || ""}`,
      `Search terms: ${(data.backgroundMusicPlan?.searchTerms || []).join(" | ")}`,
      `Music sources: ${(data.backgroundMusicResults || []).map((m) => `${m.source}: ${m.url}`).join(" | ")}`,
      `Use: ${(data.backgroundMusicPlan?.use || []).join(" | ")}`,
      "",
      "TIMESTAMP DETAILS",
      ""
    ].join("\n") + "\n" + data.scenes.map((s) => [
      `${s.timestamp} — ${s.text}`,
      `Visual: ${s.visualPlan}`,
      `Canva 1: ${s.canvaTerms?.[0] || ""}`,
      `Canva 2: ${s.canvaTerms?.[1] || ""}`,
      `SFX: ${s.sfx}`,
      `SFX use: ${s.sfxDetails?.use || ""}`,
      `SFX search terms: ${(s.sfxDetails?.searchTerms || []).join(" | ")}`,
      `SFX sources: ${(s.sfxSources || []).map((m) => `${m.source}: ${m.url}`).join(" | ")}`,
      `Music cue: ${s.musicCue || "Serious documentary"}`,
      `Text: ${s.textCallout || "No text needed"}`,
      `Search query: ${s.query}`,
      ""
    ].join("\n")).join("\n");
    document.getElementById("downloadPlanBtn").disabled = false;
  } catch (error) {
    results.innerHTML = `<div class="card"><p class="bad">${escapeHtml(error.message)}</p></div>`;
  } finally {
    document.getElementById("suggestBtn").disabled = false;
  }
});

document.getElementById("downloadPlanBtn").addEventListener("click", () => {
  const blob = new Blob([latestSuggestionReport || ""], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "timestamp-media-suggestions.txt";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("videoBtn").addEventListener("click", async () => {
  const voiceover = document.getElementById("voiceover").files[0];
  const script = (document.getElementById("videoScript")?.value || document.getElementById("script")?.value || "").trim();
  if (!voiceover) return alert("Upload voiceover audio.");
  if (!script) return alert("Paste the timestamped script in the Automatic video maker tab.");

  const progressCard = document.getElementById("videoProgress");
  const progressText = document.getElementById("videoProgressText");
  const progressBar = document.getElementById("videoProgressBar");
  const resultCard = document.getElementById("videoResult");
  progressCard.classList.remove("hidden");
  resultCard.classList.add("hidden");
  progressText.textContent = "Starting video render...";
  progressBar.style.width = "1%";
  document.getElementById("videoBtn").disabled = true;

  try {
    const fd = new FormData();
    fd.append("voiceover", voiceover);
    fd.append("script", script);
    fd.append("topic", (document.getElementById("videoTopic")?.value || document.getElementById("topic")?.value || "").trim());
    fd.append("niche", document.getElementById("videoNiche")?.value || document.getElementById("niche")?.value || "general");
    fd.append("format", document.getElementById("videoFormat").value);
    fd.append("musicMood", document.getElementById("musicMood").value);
    const start = await readApi(await fetch("/api/start-video", { method: "POST", body: fd }));
    const data = await pollJob(start.jobId, progressCard, progressText, progressBar);
    document.getElementById("videoMeta").textContent = `Duration: ${data.duration}s. Rendered scenes: ${data.renderedScenes}. Parsed timestamps: ${data.parsedTimestamps}.`;
    document.getElementById("videoDownload").href = data.outputUrl;
    document.getElementById("videoReport").href = data.reportUrl;
    resultCard.classList.remove("hidden");
  } catch (error) {
    progressText.textContent = error.message;
  } finally {
    document.getElementById("videoBtn").disabled = false;
  }
});


document.getElementById("copyMainScriptBtn")?.addEventListener("click", () => {
  const mainScript = document.getElementById("script")?.value || "";
  const mainTopic = document.getElementById("topic")?.value || "";
  const mainNiche = document.getElementById("niche")?.value || "general";
  if (!mainScript.trim()) return alert("Paste your script in the Timestamp suggestions tab first, or paste directly in this video box.");
  document.getElementById("videoScript").value = mainScript;
  document.getElementById("videoTopic").value = mainTopic;
  document.getElementById("videoNiche").value = mainNiche;
});

initControls();
loadStatus();
