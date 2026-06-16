
const SOURCES = [
  ["pexels", "Pexels"],
  ["pixabay", "Pixabay"],
  ["youtube", "YouTube ref"],
  ["unsplash", "Unsplash"],
  ["openverse", "Openverse"],
  ["nasa", "NASA"],
  ["wikimedia", "Wikimedia"],
  ["archive", "Archive"],
  ["flickr", "Flickr"],
  ["giphy", "GIPHY"],
];

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});


async function readApiResponse(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { error: text.slice(0, 500) };
    }
  }
  if (!response.ok) {
    throw new Error(data.error || `Server error ${response.status}. This usually means the render was too heavy or the service restarted.`);
  }
  return data;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function selectedSources() {
  return [...document.querySelectorAll(".source-check:checked")].map((input) => input.value);
}

function renderSourceChecks() {
  const grid = document.getElementById("sourceGrid");
  grid.innerHTML = SOURCES.map(([id, label]) => `
    <label class="source-card">
      <input class="source-check" type="checkbox" value="${id}" checked />
      ${label}
    </label>
  `).join("");
}

renderSourceChecks();

// Build video mode
const form = document.getElementById("builderForm");
const previewBtn = document.getElementById("previewBtn");
const buildBtn = document.getElementById("buildBtn");
const progressCard = document.getElementById("progressCard");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const resultCard = document.getElementById("resultCard");
const resultMeta = document.getElementById("resultMeta");
const downloadVideo = document.getElementById("downloadVideo");
const downloadReport = document.getElementById("downloadReport");
const scenePlanCard = document.getElementById("scenePlanCard");
const sceneSummary = document.getElementById("sceneSummary");
const sceneList = document.getElementById("sceneList");
let progressTimer;

function setProgress(percent, text) {
  progressCard.classList.remove("hidden");
  progressBar.style.width = `${percent}%`;
  progressText.textContent = text;
}

function fakeProgress() {
  let p = 8;
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    p = Math.min(p + Math.random() * 5, 88);
    setProgress(p, "Building video... selecting clips, timing scenes, designing music/SFX, and rendering MP4.");
  }, 2500);
}

function renderScenePlan(data, targetList = sceneList, targetSummary = sceneSummary, targetCard = scenePlanCard) {
  targetCard.classList.remove("hidden");
  const flags = data.riskFlags || [];
  targetSummary.innerHTML = `Scenes found: <strong>${data.scenes.length}</strong>. Risk flags: <span class="${flags.length ? "risk" : "ok"}">${escapeHtml(flags.join(", ") || "None")}</span>.`;
  targetList.innerHTML = data.scenes.map((scene) => `
    <article class="scene-item">
      <div class="scene-num">${escapeHtml(scene.timestamp)} — Scene ${scene.scene}</div>
      <p><strong>Script:</strong> ${escapeHtml(scene.text)}</p>
      <p><strong>Suggested media:</strong> ${escapeHtml(scene.visualPlan)}</p>
      <p><strong>Text on screen:</strong> ${escapeHtml(scene.callout || "No text")}</p>
      <p><strong>Duration:</strong> ${Math.round(scene.duration)}s</p>
      <p><strong>Check:</strong> <span class="${(scene.riskFlags || []).length ? "risk" : "ok"}">${escapeHtml((scene.riskFlags || []).join(", ") || "No risk flag")}</span></p>
    </article>
  `).join("");
}

async function previewPlan() {
  const script = document.getElementById("script").value.trim();
  if (!script) return alert("Paste your timestamped script first.");

  previewBtn.disabled = true;
  previewBtn.textContent = "Reading script...";
  try {
    const response = await fetch("/api/parse-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script,
        topic: document.getElementById("topic").value.trim(),
        niche: document.getElementById("niche").value,
        audioDuration: 0,
      }),
    });
    const data = await readApiResponse(response);
    renderScenePlan(data);
    scenePlanCard.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    alert(error.message || "Could not read script.");
  } finally {
    previewBtn.disabled = false;
    previewBtn.textContent = "1. Preview scene plan";
  }
}

previewBtn.addEventListener("click", previewPlan);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultCard.classList.add("hidden");

  const voiceover = document.getElementById("voiceover").files[0];
  if (!voiceover) return alert("Upload your voiceover first.");
  const script = document.getElementById("script").value.trim();
  if (!script) return alert("Paste your timestamped script first.");

  const formData = new FormData();
  formData.append("voiceover", voiceover);

  const music = document.getElementById("music").files[0];
  if (music) formData.append("music", music);

  formData.append("script", script);
  formData.append("topic", document.getElementById("topic").value.trim());
  formData.append("niche", document.getElementById("niche").value);
  formData.append("format", document.getElementById("format").value);
  formData.append("photoMotion", document.getElementById("photoMotion").value);
  formData.append("useMusic", document.getElementById("useMusic").checked ? "true" : "false");
  formData.append("renderMode", document.getElementById("renderMode")?.value || "exact");
  formData.append("audioMode", document.getElementById("audioMode")?.value || "auto");
  formData.append("sfxMode", document.getElementById("sfxMode")?.value || "auto");
  formData.append("musicMood", document.getElementById("musicMood")?.value || "documentary");

  buildBtn.disabled = true;
  buildBtn.textContent = "Building...";
  setProgress(5, "Uploading audio and script...");
  fakeProgress();

  try {
        const startResponse = await fetch("/api/start-build-video", { method: "POST", body: formData });
    const startData = await readApiResponse(startResponse);
    clearInterval(progressTimer);
    await pollRenderJob(startData.jobId);
  } catch (error) {
    clearInterval(progressTimer);
    setProgress(100, error.message || "Something went wrong.");
  } finally {
    buildBtn.disabled = false;
    buildBtn.textContent = "2. Build video draft";
  }
});


async function pollRenderJob(jobId) {
  setProgress(3, "Render job started. Keep this page open.");
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/job/${jobId}`);
        const job = await readApiResponse(response);
        setProgress(job.progress || 1, job.message || "Rendering...");
        if (job.total) {
          progressText.textContent = `${job.message || "Rendering..."} (${job.current || 0}/${job.total} scenes)`;
        }

        if (job.status === "complete") {
          clearInterval(timer);
          const data = job.result || {};
          setProgress(100, "Video ready.");
          const flags = data.riskFlags || [];
          resultMeta.innerHTML = `Duration: <strong>${data.duration || ""}s</strong>. Render scenes used: <strong>${data.scenes || job.total}</strong> from <strong>${data.originalScenes || job.total}</strong> timestamp lines. Risk flags: <span class="${flags.length ? "risk" : "ok"}">${escapeHtml(flags.join(", ") || "None")}</span>.`;
          downloadVideo.href = job.outputUrl || data.outputUrl;
          downloadReport.href = job.reportUrl || data.reportUrl;
          resultCard.classList.remove("hidden");
          resultCard.scrollIntoView({ behavior: "smooth" });
          resolve(job);
        }

        if (job.status === "failed") {
          clearInterval(timer);
          setProgress(100, job.error || "Render failed.");
          reject(new Error(job.error || "Render failed."));
        }
      } catch (error) {
        clearInterval(timer);
        setProgress(100, error.message || "Could not read render status.");
        reject(error);
      }
    }, 3000);
  });
}


// Media search mode
const mediaSearchBtn = document.getElementById("mediaSearchBtn");
const mediaResults = document.getElementById("mediaResults");

function renderMediaCards(items) {
  if (!items?.length) return `<p class="muted">No results found from selected sources. Check API keys or try a different query.</p>`;
  return `<div class="results-grid">${items.map((item) => `
    <article class="result-card">
      ${item.thumbnail ? `<img src="${escapeHtml(item.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
      <div class="result-body">
        <div class="result-source">${escapeHtml(item.source)} · ${escapeHtml(item.type)}</div>
        <div class="result-title">${escapeHtml(item.title)}</div>
        <div class="result-meta">${escapeHtml(item.meta || "")}</div>
        <div class="result-links">
          ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open</a>` : ""}
          ${item.downloadUrl ? `<a href="${escapeHtml(item.downloadUrl)}" target="_blank" rel="noopener">Media file</a>` : ""}
        </div>
      </div>
    </article>
  `).join("")}</div>`;
}

function renderGroupedResults(data, container, title = "Media results") {
  const groups = data.groups || {};
  const names = Object.keys(groups);
  container.classList.remove("hidden");
  container.innerHTML = `<h2>${escapeHtml(title)}</h2>
    <p class="muted">${data.results?.length || 0} results found.</p>
    ${names.length ? names.map((name) => `
      <h3 class="group-title">${escapeHtml(name)}</h3>
      ${renderMediaCards(groups[name])}
    `).join("") : renderMediaCards([])}
  `;
}

mediaSearchBtn.addEventListener("click", async () => {
  const query = document.getElementById("mediaQuery").value.trim();
  if (!query) return alert("Enter something to search.");
  mediaSearchBtn.disabled = true;
  mediaSearchBtn.textContent = "Searching...";
  mediaResults.classList.remove("hidden");
  mediaResults.innerHTML = "<h2>Searching media...</h2><p class='muted'>Checking selected sources.</p>";
  try {
    const response = await fetch("/api/search-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        niche: document.getElementById("mediaNiche").value,
        sources: selectedSources(),
        count: 6,
      }),
    });
    const data = await readApiResponse(response);
    renderGroupedResults(data, mediaResults, "Media results");
  } catch (error) {
    mediaResults.innerHTML = `<h2>Search failed</h2><p class="risk">${escapeHtml(error.message)}</p>`;
  } finally {
    mediaSearchBtn.disabled = false;
    mediaSearchBtn.textContent = "Search all selected sources";
  }
});

// Timestamp suggestion mode
const suggestPlanBtn = document.getElementById("suggestPlanBtn");
const suggestMediaBtn = document.getElementById("suggestMediaBtn");
const suggestResults = document.getElementById("suggestResults");

async function parseSuggestScript() {
  const script = document.getElementById("suggestScript").value.trim();
  if (!script) throw new Error("Paste timestamped text first.");
  const response = await fetch("/api/parse-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      script,
      topic: document.getElementById("suggestTopic").value.trim(),
      niche: document.getElementById("suggestNiche").value,
      audioDuration: 0,
    }),
  });
  const data = await readApiResponse(response);
  return data;
}

suggestPlanBtn.addEventListener("click", async () => {
  suggestPlanBtn.disabled = true;
  suggestPlanBtn.textContent = "Reading...";
  try {
    const data = await parseSuggestScript();
    suggestResults.classList.remove("hidden");
    suggestResults.innerHTML = `<h2>Timestamp suggestions</h2><p id="suggestSummary"></p><div id="suggestList"></div>`;
    renderScenePlan(data, document.getElementById("suggestList"), document.getElementById("suggestSummary"), suggestResults);
  } catch (error) {
    alert(error.message);
  } finally {
    suggestPlanBtn.disabled = false;
    suggestPlanBtn.textContent = "Preview suggestions only";
  }
});

suggestMediaBtn.addEventListener("click", async () => {
  const script = document.getElementById("suggestScript").value.trim();
  if (!script) return alert("Paste timestamped text first.");
  suggestMediaBtn.disabled = true;
  suggestMediaBtn.textContent = "Finding media...";
  suggestResults.classList.remove("hidden");
  suggestResults.innerHTML = "<h2>Finding media examples...</h2><p class='muted'>This can take time on long scripts.</p>";
  try {
    const response = await fetch("/api/suggest-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script,
        topic: document.getElementById("suggestTopic").value.trim(),
        niche: document.getElementById("suggestNiche").value,
        maxScenes: 25,
        sources: selectedSources(),
      }),
    });
    const data = await readApiResponse(response);
    suggestResults.innerHTML = `<h2>Timestamp media examples</h2>
      <p class="muted">Showing media examples for ${data.scenes.length} scenes. For long videos, start with these first and search more scene-by-scene if needed.</p>
      ${data.scenes.map((scene) => `
        <article class="scene-item">
          <div class="scene-num">${escapeHtml(scene.timestamp)} — ${escapeHtml(scene.visualPlan)}</div>
          <p><strong>Script:</strong> ${escapeHtml(scene.text)}</p>
          <p><strong>Text on screen:</strong> ${escapeHtml(scene.callout || "No text")}</p>
          ${renderMediaCards(scene.media || [])}
        </article>
      `).join("")}`;
  } catch (error) {
    suggestResults.innerHTML = `<h2>Media suggestion failed</h2><p class="risk">${escapeHtml(error.message)}</p>`;
  } finally {
    suggestMediaBtn.disabled = false;
    suggestMediaBtn.textContent = "Find media examples";
  }
});
