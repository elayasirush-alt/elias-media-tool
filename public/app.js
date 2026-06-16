
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

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
    setProgress(p, "Building video... selecting clips, timing scenes, mixing audio, and rendering MP4.");
  }, 2500);
}

function renderScenePlan(data) {
  scenePlanCard.classList.remove("hidden");
  const flags = data.riskFlags || [];
  sceneSummary.innerHTML = `Scenes found: <strong>${data.scenes.length}</strong>. Risk flags: <span class="${flags.length ? "risk" : "ok"}">${escapeHtml(flags.join(", ") || "None")}</span>.`;
  sceneList.innerHTML = data.scenes.map((scene) => `
    <article class="scene-item">
      <div class="scene-num">${escapeHtml(scene.timestamp)} — Scene ${scene.scene}</div>
      <p><strong>Script:</strong> ${escapeHtml(scene.text)}</p>
      <p><strong>Visual plan:</strong> ${escapeHtml(scene.visualPlan)}</p>
      <p><strong>Text on screen:</strong> ${escapeHtml(scene.callout || "No text")}</p>
      <p><strong>Duration:</strong> ${Math.round(scene.duration)}s</p>
      <p><strong>Check:</strong> <span class="${(scene.riskFlags || []).length ? "risk" : "ok"}">${escapeHtml((scene.riskFlags || []).join(", ") || "No risk flag")}</span></p>
    </article>
  `).join("");
}

async function previewPlan() {
  const script = document.getElementById("script").value.trim();
  if (!script) {
    alert("Paste your timestamped script first.");
    return;
  }

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
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not read script.");
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
  if (!voiceover) {
    alert("Upload your voiceover first.");
    return;
  }
  const script = document.getElementById("script").value.trim();
  if (!script) {
    alert("Paste your timestamped script first.");
    return;
  }

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

  buildBtn.disabled = true;
  buildBtn.textContent = "Building...";
  setProgress(5, "Uploading audio and script...");
  fakeProgress();

  try {
    const response = await fetch("/api/build-video", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Video build failed.");

    clearInterval(progressTimer);
    setProgress(100, "Video ready.");

    const flags = data.riskFlags || [];
    resultMeta.innerHTML = `Duration: <strong>${data.duration}s</strong>. Scenes used: <strong>${data.scenes}</strong>. Risk flags: <span class="${flags.length ? "risk" : "ok"}">${escapeHtml(flags.join(", ") || "None")}</span>.`;
    downloadVideo.href = data.outputUrl;
    downloadReport.href = data.reportUrl;
    resultCard.classList.remove("hidden");
    resultCard.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    clearInterval(progressTimer);
    setProgress(100, error.message || "Something went wrong.");
  } finally {
    buildBtn.disabled = false;
    buildBtn.textContent = "2. Build video draft";
  }
});
