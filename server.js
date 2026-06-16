
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import ffmpegPath from "ffmpeg-static";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

dotenv.config();

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const TMP_DIR = path.join(__dirname, "tmp");
const OUTPUT_DIR = path.join(__dirname, "output");

fs.mkdirSync(TMP_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/output", express.static(OUTPUT_DIR));

const JOBS = new Map();

const STOPWORDS = new Set("the a an and or but of to in on for with from by as is are was were be been being this that these those it its into about after before during while where when what why how do does did can could should would will just your you they them their has have had not no yes more most very really started through every across over under there here than then because even after before again about still actually nobody wants wanted want vehicle vehicles video media search source direct results missing found open show use using make made says said".split(" "));

const SOURCE_LABELS = {
  pexels: "Pexels",
  pixabay: "Pixabay",
  unsplash: "Unsplash",
  youtube: "YouTube",
  canva: "Canva",
  openverse: "Openverse",
  nasa: "NASA",
  wikimedia: "Wikimedia",
  archive: "Internet Archive",
  flickr: "Flickr",
  giphy: "GIPHY",
};

const ALL_SOURCES = Object.keys(SOURCE_LABELS);

function key(name) {
  return process.env[name] || "";
}

function keyStatus() {
  return {
    PEXELS_API_KEY: Boolean(key("PEXELS_API_KEY")),
    PIXABAY_API_KEY: Boolean(key("PIXABAY_API_KEY")),
    UNSPLASH_ACCESS_KEY: Boolean(key("UNSPLASH_ACCESS_KEY")),
    YOUTUBE_API_KEY: Boolean(key("YOUTUBE_API_KEY")),
    FLICKR_API_KEY: Boolean(key("FLICKR_API_KEY")),
    GIPHY_API_KEY: Boolean(key("GIPHY_API_KEY")),
  };
}

function safeText(value) {
  return String(value || "")
    .replace(/[^\w\s.,?!:$%&()'"/+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value, fallback = "video") {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || fallback;
}

function secondsFromTimestamp(value = "") {
  const clean = String(value).trim().replace(/^[[(]/, "").replace(/[\])]$/, "");
  const parts = clean.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function topKeywords(text = "", count = 8) {
  const words = String(text)
    .toLowerCase()
    .replace(/\b(2026|2025|2024|2023)\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([w]) => w);
}

function nicheWords(niche = "") {
  return {
    general: "cinematic documentary b roll people city detail",
    documentary: "documentary real footage news evidence city people",
    automotive: "cars trucks vehicle dealership mechanic engine highway pickup",
    aviation: "aircraft airplane airport runway cockpit aviation",
    business: "business finance office economy company money charts",
    technology: "technology software computers servers data ai robotics",
    finance: "finance money banking stock market economy charts",
    realestate: "real estate homes buildings property construction interior exterior",
    architecture: "architecture building construction interior exterior design",
    construction: "construction site workers machinery concrete steel building",
    education: "classroom student teacher learning university books study",
    healthcare: "hospital doctor nurse medical healthcare patient laboratory",
    travel: "travel airport hotel beach road trip city tourism",
    food: "food restaurant cooking kitchen chef meal ingredients",
    sports: "sports athlete stadium training competition gym",
    lifestyle: "lifestyle people home city family daily life",
    motivation: "cinematic lifestyle sunrise city walking success discipline",
    music: "stage performance microphone studio concert singer",
    worship: "church worship prayer bible sunrise spiritual light",
    nature: "nature forest ocean mountains wildlife river sunset",
    politics: "government parliament press conference election flag city",
    crime: "police investigation evidence court law enforcement",
    history: "archive old city museum historic documents vintage",
    science: "science laboratory research experiment space microscope",
    fashion: "fashion model clothing studio runway style",
    beauty: "beauty skincare makeup salon cosmetics lifestyle",
    gaming: "gaming controller esports computer neon screen",
    environment: "environment climate renewable energy pollution nature",
  }[niche] || "cinematic documentary b roll people city detail";
}

function smartMediaQuery(text = "", topic = "", niche = "general") {
  const keywords = topKeywords(`${topic} ${text}`, 8);
  const joined = keywords.join(" ");
  const base = joined || safeText(`${topic} ${text}`).slice(0, 100);
  return `${base} ${nicheWords(niche)}`.trim();
}

function canvaTerms(text = "", topic = "", niche = "general") {
  const keywords = topKeywords(`${topic} ${text}`, 8);
  const base = keywords.slice(0, 5).join(" ") || safeText(topic || text).slice(0, 60);
  const theme = {
    automotive: "dealership inventory cinematic",
    aviation: "aircraft cockpit cinematic",
    business: "corporate crisis data chart",
    finance: "financial chart money data",
    technology: "technology futuristic dashboard",
    documentary: "documentary evidence headline",
    general: "cinematic documentary background",
  }[niche] || "cinematic documentary background";
  return [
    `${base} ${theme}`,
    `${base} dark cinematic title card`,
  ].map((x) => x.trim());
}

function sfxSuggestion(text = "") {
  const lower = String(text).toLowerCase();
  if (/\?|\bwhy\b|\bhow\b|\bwhat\b/.test(lower)) return "Soft whoosh + question hit";
  if (/\b(warning|failure|collapse|lawsuit|recall|risk|danger|problem|panic|damage)\b/.test(lower)) return "Low boom impact + subtle tension riser";
  if (/(\$?\d[\d,.]*|million|billion|percent|%|days|years)/i.test(text)) return "Clean data ping + short click";
  if (/\b(reveal|truth|exposed|secret|turning point)\b/.test(lower)) return "Cinematic reveal swell";
  return "Light transition whoosh";
}


function sfxCueDetails(text = "", timestamp = "") {
  const lower = String(text).toLowerCase();
  let category = "Transition";
  let use = "Use a very light whoosh at the sentence change.";
  let timing = `${timestamp || "timestamp"} + 0.0s`;
  let volume = "8–12% under voiceover";
  let searchTerms = ["subtle transition whoosh", "soft cinematic whoosh"];

  if (/\?|\bwhy\b|\bhow\b|\bwhat\b/.test(lower)) {
    category = "Question / Curiosity";
    use = "Place a soft whoosh before the question and a small hit after the question lands.";
    volume = "10–14% under voiceover";
    searchTerms = ["question reveal whoosh", "soft mystery hit"];
  } else if (/\b(warning|failure|collapse|lawsuit|recall|risk|danger|problem|panic|damage|exposed)\b/.test(lower)) {
    category = "Warning / Impact";
    use = "Use a low cinematic boom on the key word, then keep tension bed low.";
    volume = "12–18% for impact, then fade quickly";
    searchTerms = ["low cinematic boom", "dark tension impact"];
  } else if (/(\$?\d[\d,.]*|million|billion|percent|%|days|years|inventory|price|sales)/i.test(text)) {
    category = "Data / Number";
    use = "Use a clean data ping or small click exactly when the number appears on screen.";
    volume = "8–12% under voiceover";
    searchTerms = ["data ping sound effect", "clean UI click data"];
  } else if (/\b(turning point|reveal|truth|secret|real reason|but then)\b/.test(lower)) {
    category = "Reveal";
    use = "Use a short riser into the reveal and a soft hit when the reveal line starts.";
    volume = "10–16% under voiceover";
    searchTerms = ["cinematic reveal riser", "documentary reveal hit"];
  } else if (/\b(factory|engine|truck|car|vehicle|dealer|dealership|road|highway)\b/.test(lower)) {
    category = "Automotive ambience";
    use = "Use very low engine/road/dealership ambience only if it does not fight the voiceover.";
    volume = "5–9% under voiceover";
    searchTerms = ["low engine ambience", "car dealership ambience"];
  }

  return { category, use, timing, volume, searchTerms };
}

function musicMoodForScene(text = "", niche = "general") {
  const lower = String(text).toLowerCase();
  if (/\b(warning|failure|collapse|lawsuit|recall|risk|danger|panic|damage|problem)\b/.test(lower)) return "Dark tension";
  if (/\b(turning point|reveal|truth|exposed|secret|real reason)\b/.test(lower)) return "Rising reveal";
  if (/(\$?\d[\d,.]*|million|billion|percent|%|sales|inventory|price|data)/i.test(text)) return "Analytical pulse";
  if (/\b(hope|solution|future|recover|improve|opportunity)\b/.test(lower)) return "Hopeful lift";
  if (niche === "automotive") return "Serious automotive documentary";
  if (niche === "aviation") return "Calm investigative aviation";
  if (niche === "business" || niche === "finance") return "Corporate tension";
  return "Serious documentary";
}


function audioCard(source, kind, title, url, meta = "") {
  return {
    source,
    type: kind,
    title: safeText(title).slice(0, 160) || `${source} ${kind}`,
    thumbnail: "",
    url,
    downloadUrl: "",
    meta,
    license: "",
  };
}

function audioSourceResults(query = "", kind = "music") {
  const q = encodeURIComponent(safeText(query).slice(0, 120));
  const clean = safeText(query).slice(0, 90) || (kind === "music" ? "documentary background music" : "cinematic sound effect");
  if (kind === "music") {
    return [
      audioCard("Pixabay Music", "background music", `Search music: ${clean}`, `https://pixabay.com/music/search/${q}/`, "Open music results and download a suitable instrumental track."),
      audioCard("Freesound", "background music", `Search music/loops: ${clean}`, `https://freesound.org/search/?q=${q}`, "Check license and download suitable music/loop."),
      audioCard("Mixkit", "background music", `Search music: ${clean}`, `https://mixkit.co/free-stock-music/`, "Open Mixkit and search manually using this term."),
      audioCard("YouTube Audio Library", "background music", `Search YouTube Audio Library: ${clean}`, `https://studio.youtube.com/channel/UC/music`, "Use inside YouTube Studio; choose no-vocal instrumental tracks."),
    ];
  }
  return [
    audioCard("Pixabay Sound Effects", "sound effect", `Search SFX: ${clean}`, `https://pixabay.com/sound-effects/search/${q}/`, "Open sound effects results and download a matching cue."),
    audioCard("Freesound", "sound effect", `Search SFX: ${clean}`, `https://freesound.org/search/?q=${q}`, "Check license and download a matching cue."),
    audioCard("Mixkit", "sound effect", `Search SFX: ${clean}`, `https://mixkit.co/free-sound-effects/`, "Open Mixkit and search manually using this term."),
    audioCard("YouTube Audio Library", "sound effect", `Search YouTube Audio Library SFX: ${clean}`, `https://studio.youtube.com/channel/UC/music`, "Use YouTube Studio sound effects where available."),
  ];
}

function backgroundMusicSourceResults(plan = {}) {
  const terms = plan.searchTerms || [];
  const primary = terms[0] || plan.mainMood || "cinematic documentary background music";
  const secondary = terms[1] || "no vocals documentary background music";
  const results = [
    ...audioSourceResults(primary, "music"),
    ...audioSourceResults(secondary, "music").slice(0, 2),
  ];
  return dedupe(results, 8);
}

function sfxSourceResults(scene = {}) {
  const terms = scene.sfxDetails?.searchTerms || [scene.sfx || "subtle transition whoosh"];
  const results = terms.flatMap((term) => audioSourceResults(term, "sfx").slice(0, 2));
  return dedupe(results, 6);
}


function backgroundMusicPlan(scenes = [], topic = "", niche = "general") {
  const hasRisk = scenes.some((s) => /\b(failure|collapse|lawsuit|recall|risk|panic|damage|problem|exposed)\b/i.test(s.text));
  const hasNumbers = scenes.some((s) => /(\$?\d[\d,.]*|million|billion|percent|%|sales|inventory|price|data)/i.test(s.text));
  const hasHope = scenes.some((s) => /\b(solution|future|recover|improve|opportunity|comeback)\b/i.test(s.text));

  let mainMood = "Serious documentary tension";
  if (niche === "automotive") mainMood = "Dark automotive documentary";
  if (niche === "aviation") mainMood = "Investigative aviation documentary";
  if (niche === "business" || niche === "finance") mainMood = "Corporate crisis documentary";
  if (hasHope && !hasRisk) mainMood = "Warm hopeful documentary";

  const searchTerms = [
    `${topic || niche} ${mainMood} background music`,
    `${niche} documentary tension background music no vocals`,
    "cinematic documentary background music no vocals",
    hasNumbers ? "subtle data documentary pulse background music" : "slow cinematic investigative music",
  ].filter(Boolean);

  const use = [
    "Keep music under the voiceover, not above it.",
    "Start at 8–12% volume during the opening hook.",
    "Raise slightly to 14–18% during reveals, big numbers, or dramatic turns.",
    "Lower to 6–10% during dense information or important explanation.",
    "Fade music down before the final sentence, then lift gently at the outro.",
    "Use instrumental/no-vocal music only so it does not fight narration.",
  ];

  return {
    mainMood,
    searchTerms,
    volumeGuide: "Voiceover 100%, background music usually 8–15%, maximum 18% at dramatic moments.",
    structure: [
      "0:00 opening hook: low tension bed starts immediately.",
      "Main explanation: keep steady low pulse under narration.",
      "Big number / evidence sections: add subtle pulse or darker layer.",
      "Turning point: short riser into the reveal.",
      "Ending: fade tension and use a clean final hit or soft lift.",
    ],
    use,
  };
}


function textCallout(text = "") {
  const clean = safeText(text).slice(0, 140);
  if (!clean) return "";
  const number = clean.match(/(\$?\d[\d,.]*\s?(million|billion|thousand|%|percent|trucks|cars|people|years|days|hours)?)/i);
  if (number) return `${number[0].trim().toUpperCase()} MATTERS`;
  if (/\?/.test(clean)) return clean.split("?")[0].slice(0, 52).toUpperCase() + "?";
  const strong = clean.match(/\b(problem|failure|recall|warning|mistake|truth|risk|damage|collapse|turning point|investigation|lawsuit|exposed|panic|decline|consequence|strategy)\b/i);
  if (strong) return clean.split(/\s+/).filter((w) => w.length > 2).slice(0, 6).join(" ").toUpperCase();
  return "";
}

function infoNotes(text = "") {
  const notes = [];
  if (/(\$?\d[\d,.]*\s?(million|billion|thousand|%|percent|people|trucks|cars|planes|deaths|injuries|days)?)/i.test(text)) notes.push("Verify number with official/company/industry source.");
  if (/\b(lawsuit|recall|investigation|regulator|court|police|nhtsa|faa|sec|government)\b/i.test(text)) notes.push("Use official document or credible news screenshot.");
  if (/\b(killed|death|fatal|crash|injured|unsafe|dangerous)\b/i.test(text)) notes.push("Use respectful wording and verified source.");
  return notes;
}

function visualPlan(text = "", niche = "general") {
  const lower = text.toLowerCase();
  if (/\b(document|report|letter|email|claim|lawsuit|recall|headline|source|data)\b/.test(lower)) return "Use document/headline/data screenshot with slow zoom.";
  if (/\b(number|cost|million|billion|percent|sales|loss|price|money|inventory|supply)\b/.test(lower)) return "Use chart, price tag, inventory lot, or data graphic.";
  if (niche === "automotive") return "Use dealership lot, truck detail, mechanic, road, or showroom footage.";
  if (niche === "aviation") return "Use aircraft, cockpit, runway, radar, or airport footage.";
  if (niche === "business") return "Use office, executives, company building, finance chart, or workers.";
  return "Use relevant cinematic B-roll matching the sentence.";
}

function parseTimestampedScript(script = "", topic = "", niche = "general") {
  const rows = String(script)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = [];
  for (const line of rows) {
    const match = line.match(/^[\[(]?(\d{1,2}:\d{2}(?::\d{2})?)[\])]?\s*(?:[-–—:|]\s*)?(.*)$/);
    if (!match) continue;
    const start = secondsFromTimestamp(match[1]);
    const text = safeText(match[2] || "");
    if (start === null || !text) continue;
    parsed.push({ start, timestamp: formatTime(start), text });
  }

  parsed.sort((a, b) => a.start - b.start);

  return parsed.map((item, index) => {
    const nextStart = parsed[index + 1]?.start;
    const end = typeof nextStart === "number" ? nextStart : item.start + 8;
    const duration = Math.max(1.25, Math.min(24, end - item.start));
    return {
      scene: index + 1,
      start: item.start,
      end: item.start + duration,
      duration,
      timestamp: item.timestamp,
      text: item.text,
      query: smartMediaQuery(item.text, topic, niche),
      canvaTerms: canvaTerms(item.text, topic, niche),
      sfx: sfxSuggestion(item.text),
      sfxDetails: sfxCueDetails(item.text, item.timestamp),
      musicCue: musicMoodForScene(item.text, niche),
      textCallout: textCallout(item.text),
      visualPlan: visualPlan(item.text, niche),
    };
  });
}

function mediaResult(source, type, title, thumbnail, url, downloadUrl = "", meta = "", license = "") {
  return {
    source, type,
    title: safeText(title).slice(0, 160) || `${source} result`,
    thumbnail: thumbnail || "",
    url: url || "",
    downloadUrl: downloadUrl || "",
    meta: meta || "",
    license: license || "",
  };
}

function fallback(source, query, reason = "API key missing or no direct results returned.") {
  const q = encodeURIComponent(query);
  const links = {
    Pexels: `https://www.pexels.com/search/videos/${q}/`,
    Pixabay: `https://pixabay.com/videos/search/${q}/`,
    Unsplash: `https://unsplash.com/s/photos/${q}`,
    YouTube: `https://www.youtube.com/results?search_query=${q}`,
    Canva: `https://www.canva.com/templates/?query=${q}`,
    Openverse: `https://openverse.org/search/?q=${q}`,
    NASA: `https://images.nasa.gov/search-results?q=${q}`,
    Wikimedia: `https://commons.wikimedia.org/w/index.php?search=${q}`,
    "Internet Archive": `https://archive.org/search?query=${q}`,
    Flickr: `https://www.flickr.com/search/?text=${q}`,
    GIPHY: `https://giphy.com/search/${q}`,
  };
  return mediaResult(source, "source search", `Open ${source} search for "${query}"`, "", links[source], "", reason, "");
}

function dedupe(items, max = 999) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const keyValue = item.downloadUrl || item.url || item.thumbnail || `${item.source}:${item.title}`;
    if (!keyValue || seen.has(keyValue)) continue;
    seen.add(keyValue);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

function bestPexelsFile(video) {
  const files = (video.video_files || [])
    .filter((f) => f.file_type === "video/mp4" && f.link)
    .sort((a, b) => (b.width || 0) - (a.width || 0));
  return files.find((f) => (f.width || 0) >= 1280) || files[0];
}

async function searchPexels(query, count) {
  if (!key("PEXELS_API_KEY")) return [];
  const out = [];
  try {
    const params = new URLSearchParams({ query, per_page: String(Math.min(count, 20)), orientation: "landscape" });
    const r = await fetch(`https://api.pexels.com/videos/search?${params}`, { headers: { Authorization: key("PEXELS_API_KEY") } });
    if (r.ok) {
      const data = await r.json();
      for (const v of data.videos || []) {
        const file = bestPexelsFile(v);
        if (file?.link) out.push(mediaResult("Pexels", "video", `Pexels video ${v.id}`, v.image, v.url, file.link, "Direct MP4", "Pexels"));
      }
    }
  } catch (_) {}
  try {
    const params = new URLSearchParams({ query, per_page: String(Math.min(count, 20)), orientation: "landscape" });
    const r = await fetch(`https://api.pexels.com/v1/search?${params}`, { headers: { Authorization: key("PEXELS_API_KEY") } });
    if (r.ok) {
      const data = await r.json();
      for (const p of data.photos || []) {
        out.push(mediaResult("Pexels", "photo", p.alt || `Pexels photo ${p.id}`, p.src?.medium || p.src?.large, p.url, p.src?.original || p.src?.large, p.photographer || "", "Pexels"));
      }
    }
  } catch (_) {}
  return dedupe(out, count);
}

async function searchPixabay(query, count) {
  if (!key("PIXABAY_API_KEY")) return [];
  const out = [];
  try {
    const params = new URLSearchParams({ key: key("PIXABAY_API_KEY"), q: query, per_page: String(Math.min(count, 20)), safesearch: "true" });
    const r = await fetch(`https://pixabay.com/api/videos/?${params}`);
    if (r.ok) {
      const data = await r.json();
      for (const item of data.hits || []) {
        const v = item.videos?.large || item.videos?.medium || item.videos?.small;
        if (v?.url) out.push(mediaResult("Pixabay", "video", item.tags || `Pixabay video ${item.id}`, "", item.pageURL, v.url, item.user || "", "Pixabay"));
      }
    }
  } catch (_) {}
  try {
    const params = new URLSearchParams({ key: key("PIXABAY_API_KEY"), q: query, per_page: String(Math.min(count, 20)), safesearch: "true", image_type: "photo" });
    const r = await fetch(`https://pixabay.com/api/?${params}`);
    if (r.ok) {
      const data = await r.json();
      for (const item of data.hits || []) {
        out.push(mediaResult("Pixabay", "photo", item.tags || `Pixabay image ${item.id}`, item.webformatURL, item.pageURL, item.largeImageURL, item.user || "", "Pixabay"));
      }
    }
  } catch (_) {}
  return dedupe(out, count);
}

async function searchUnsplash(query, count) {
  if (!key("UNSPLASH_ACCESS_KEY")) return [];
  try {
    const params = new URLSearchParams({ query, per_page: String(Math.min(count, 20)), orientation: "landscape" });
    const r = await fetch(`https://api.unsplash.com/search/photos?${params}`, { headers: { Authorization: `Client-ID ${key("UNSPLASH_ACCESS_KEY")}` } });
    if (!r.ok) return [];
    const data = await r.json();
    return dedupe((data.results || []).map((p) => mediaResult("Unsplash", "photo", p.alt_description || p.description || "Unsplash photo", p.urls?.small, p.links?.html, p.urls?.raw || p.urls?.full, p.user?.name || "", "Unsplash")), count);
  } catch (_) {
    return [];
  }
}

async function searchYouTube(query, count) {
  if (!key("YOUTUBE_API_KEY")) return [];
  try {
    const params = new URLSearchParams({ part: "snippet", q: query, maxResults: String(Math.min(count, 20)), type: "video", key: key("YOUTUBE_API_KEY"), safeSearch: "moderate" });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!r.ok) return [];
    const data = await r.json();
    return dedupe((data.items || []).map((item) => mediaResult("YouTube", "reference", item.snippet?.title || "YouTube video", item.snippet?.thumbnails?.medium?.url || "", `https://www.youtube.com/watch?v=${item.id?.videoId}`, "", item.snippet?.channelTitle || "", "Reference only")), count);
  } catch (_) {
    return [];
  }
}

async function searchOpenverse(query, count) {
  try {
    const params = new URLSearchParams({ q: query, page_size: String(Math.min(count, 20)) });
    const r = await fetch(`https://api.openverse.engineering/v1/images/?${params}`, { headers: { "User-Agent": "EliasMediaRender/2.0" } });
    if (!r.ok) return [];
    const data = await r.json();
    return dedupe((data.results || []).map((x) => mediaResult("Openverse", "photo", x.title || "Openverse image", x.thumbnail || x.url, x.foreign_landing_url || x.url, x.url, x.creator || "", x.license || "")), count);
  } catch (_) {
    return [];
  }
}

async function searchNASA(query, count) {
  try {
    const params = new URLSearchParams({ q: query, media_type: "image" });
    const r = await fetch(`https://images-api.nasa.gov/search?${params}`);
    if (!r.ok) return [];
    const data = await r.json();
    return dedupe((data.collection?.items || []).slice(0, count).map((item) => {
      const title = item.data?.[0]?.title || "NASA image";
      const thumb = item.links?.[0]?.href || "";
      const nasaId = item.data?.[0]?.nasa_id || "";
      return mediaResult("NASA", "photo", title, thumb, item.href || `https://images.nasa.gov/details/${nasaId}`, thumb, "NASA", "NASA");
    }), count);
  } catch (_) {
    return [];
  }
}

async function searchWikimedia(query, count) {
  try {
    const params = new URLSearchParams({
      action: "query", format: "json", generator: "search",
      gsrsearch: query, gsrnamespace: "6", gsrlimit: String(Math.min(count, 20)),
      prop: "imageinfo", iiprop: "url|mime|extmetadata", origin: "*",
    });
    const r = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!r.ok) return [];
    const data = await r.json();
    return dedupe(Object.values(data.query?.pages || {}).map((page) => {
      const info = page.imageinfo?.[0] || {};
      const title = String(page.title || "Wikimedia media").replace(/^File:/, "");
      return mediaResult("Wikimedia", info.mime?.includes("video") ? "video" : "photo", title, info.thumburl || info.url, info.descriptionurl || info.url, info.url, "", info.extmetadata?.LicenseShortName?.value || "Commons");
    }), count);
  } catch (_) {
    return [];
  }
}

async function searchArchive(query, count) {
  try {
    const q = `(${query}) AND (mediatype:(movies) OR mediatype:(image))`;
    const params = new URLSearchParams({
      q, fl: "identifier,title,mediatype", rows: String(Math.min(count, 20)), output: "json",
    });
    const r = await fetch(`https://archive.org/advancedsearch.php?${params}`);
    if (!r.ok) return [];
    const data = await r.json();
    return dedupe((data.response?.docs || []).map((item) => mediaResult("Internet Archive", item.mediatype || "archive", item.title || item.identifier, "", `https://archive.org/details/${item.identifier}`, "", "Reference/download page", "Archive")), count);
  } catch (_) {
    return [];
  }
}

async function searchFlickr(query, count) {
  if (!key("FLICKR_API_KEY")) return [];
  try {
    const params = new URLSearchParams({
      method: "flickr.photos.search", api_key: key("FLICKR_API_KEY"), text: query,
      safe_search: "1", content_type: "1", media: "photos",
      per_page: String(Math.min(count, 20)), format: "json", nojsoncallback: "1",
      extras: "url_m,url_l,owner_name,license",
    });
    const r = await fetch(`https://www.flickr.com/services/rest/?${params}`);
    if (!r.ok) return [];
    const data = await r.json();
    return dedupe((data.photos?.photo || []).map((p) => mediaResult("Flickr", "photo", p.title || "Flickr photo", p.url_m || p.url_l, `https://www.flickr.com/photos/${p.owner}/${p.id}`, p.url_l || p.url_m, p.ownername || "", "Flickr")), count);
  } catch (_) {
    return [];
  }
}

async function searchGiphy(query, count) {
  if (!key("GIPHY_API_KEY")) return [];
  try {
    const params = new URLSearchParams({ api_key: key("GIPHY_API_KEY"), q: query, limit: String(Math.min(count, 20)), rating: "pg" });
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
    if (!r.ok) return [];
    const data = await r.json();
    return dedupe((data.data || []).map((g) => mediaResult("GIPHY", "gif/video", g.title || "GIPHY result", g.images?.fixed_width?.webp || g.images?.fixed_width?.url, g.url, g.images?.original?.mp4 || g.images?.original?.url, "GIF/video", "GIPHY")), count);
  } catch (_) {
    return [];
  }
}

async function searchSource(sourceId, query, count) {
  const name = SOURCE_LABELS[sourceId];
  const fn = {
    pexels: searchPexels,
    pixabay: searchPixabay,
    unsplash: searchUnsplash,
    youtube: searchYouTube,
    openverse: searchOpenverse,
    nasa: searchNASA,
    wikimedia: searchWikimedia,
    archive: searchArchive,
    flickr: searchFlickr,
    giphy: searchGiphy,
  }[sourceId];

  if (sourceId === "canva") {
    return [fallback("Canva", query, "Use these Canva search terms. Export designs/media from Canva manually if needed.")];
  }

  const items = fn ? await fn(query, count) : [];
  if (items.length) return items;
  return [fallback(name, query)];
}

async function searchAllSources(query, count = 6, sources = ALL_SOURCES) {
  const perSite = Math.max(1, Math.min(Number(count) || 6, Number(process.env.MAX_SOURCE_RESULTS_PER_SITE || 20), 20));
  const selected = (sources && sources.length ? sources : ALL_SOURCES).filter((s) => SOURCE_LABELS[s]);
  const groups = {};
  for (const sourceId of selected) {
    const label = SOURCE_LABELS[sourceId];
    try {
      groups[label] = dedupe(await searchSource(sourceId, query, perSite), perSite);
    } catch (e) {
      groups[label] = [fallback(label, query, e.message || "Source failed.")];
    }
  }
  const all = dedupe(Object.values(groups).flat(), selected.length * perSite);
  return { query, perSite, groups, results: all, keys: keyStatus() };
}

function dimensions(format) {
  if (format === "portrait") return { width: 720, height: 1280 };
  if (format === "square") return { width: 900, height: 900 };
  return { width: 1280, height: 720 };
}

function parseDuration(stderr = "") {
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 60;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

async function mediaDuration(filePath) {
  try { await execFileAsync(ffmpegPath, ["-i", filePath], { timeout: 15000 }); }
  catch (error) { return parseDuration(error.stderr || ""); }
  return 60;
}

async function downloadFile(url, target) {
  const r = await fetch(url, { headers: { "User-Agent": "EliasMediaRender/2.0" } });
  if (!r.ok) throw new Error(`Download failed ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(target, b);
  return target;
}

function fallbackVideoArgs(duration, dims, outPath, text = "") {
  const color = "0x08111f";
  return [
    "-y", "-f", "lavfi", "-i", `color=c=${color}:s=${dims.width}x${dims.height}:d=${duration}`,
    "-vf", `fade=t=in:st=0:d=0.12,fade=t=out:st=${Math.max(0, duration - 0.16).toFixed(2)}:d=0.16`,
    "-r", "30", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-pix_fmt", "yuv420p", outPath,
  ];
}

function makeVideoPartArgs(inputPath, duration, dims, outPath) {
  const vf = `scale=${dims.width}:${dims.height}:force_original_aspect_ratio=increase,crop=${dims.width}:${dims.height},setsar=1,fade=t=in:st=0:d=0.12,fade=t=out:st=${Math.max(0, duration - 0.16).toFixed(2)}:d=0.16`;
  return ["-y", "-stream_loop", "-1", "-i", inputPath, "-t", String(duration), "-vf", vf, "-an", "-r", "30", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-pix_fmt", "yuv420p", outPath];
}

function writeWavPcm16(filePath, samples, sampleRate = 22050) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(filePath, buffer);
}

function createAutoMusic(duration, mood, outPath) {
  const sr = 22050, total = Math.ceil(duration * sr), samples = new Float32Array(total);
  const palettes = {
    tension: [49, 73.42, 98, 146.83, 196],
    energetic: [65.41, 98, 130.81, 196, 261.63],
    warm: [58.27, 87.31, 116.54, 174.61, 233.08],
    documentary: [55, 82.41, 110, 164.81, 220],
  };
  const freqs = palettes[mood] || palettes.documentary;
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const env = Math.max(0, Math.min(1, t / 4, (duration - t) / 4));
    let v = 0;
    for (let j = 0; j < freqs.length; j++) v += Math.sin(2 * Math.PI * freqs[j] * t + j * 0.6) * (j === 0 ? 0.04 : 0.022);
    samples[i] = v * env * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.05 * t));
  }
  writeWavPcm16(outPath, samples, sr);
  return outPath;
}

function addSine(samples, sr, startSec, freq, len, amp) {
  const start = Math.floor(startSec * sr), length = Math.floor(len * sr);
  for (let i = 0; i < length && start + i < samples.length; i++) {
    const t = i / sr, env = Math.exp(-5 * t / len);
    samples[start + i] += Math.sin(2 * Math.PI * freq * t) * amp * env;
  }
}

function createAutoSfx(duration, scenes, outPath) {
  const sr = 22050, total = Math.ceil(duration * sr), samples = new Float32Array(total);
  for (const scene of scenes.slice(0, 80)) {
    const start = Math.max(0.1, scene.start + 0.05);
    if (scene.sfx.includes("boom")) addSine(samples, sr, start, 72, 0.6, 0.05);
    else if (scene.sfx.includes("data")) { addSine(samples, sr, start, 440, 0.12, 0.025); addSine(samples, sr, start + 0.11, 660, 0.11, 0.018); }
    else addSine(samples, sr, start, 220, 0.18, 0.015);
  }
  writeWavPcm16(outPath, samples, sr);
  return outPath;
}

function combineScenesForRender(scenes, targetSeconds = 12) {
  const combined = [];
  let current = null;
  for (const scene of scenes) {
    if (!current) {
      current = { ...scene, textParts: [scene.text] };
      continue;
    }
    if (current.duration < targetSeconds && current.duration + scene.duration <= targetSeconds + 6) {
      current.duration += scene.duration;
      current.end = scene.end;
      current.textParts.push(scene.text);
      current.text = current.textParts.join(" ");
      current.query = smartMediaQuery(current.text, "", "general");
      current.textCallout = current.textCallout || scene.textCallout;
      current.sfx = current.sfx || scene.sfx;
    } else {
      combined.push(current);
      current = { ...scene, textParts: [scene.text] };
    }
  }
  if (current) combined.push(current);
  return combined.map((s, i) => ({ ...s, scene: i + 1 }));
}

async function renderVideoJob(job, payload, files) {
  const workDir = path.join(TMP_DIR, `job-${job.id}`);
  fs.mkdirSync(workDir, { recursive: true });

  const voiceover = files?.voiceover?.[0];
  if (!voiceover) throw new Error("Upload voiceover first.");

  const topic = payload.topic || "";
  const niche = payload.niche || "general";
  const format = payload.format || "landscape";
  const mood = payload.musicMood || "documentary";
  const script = payload.script || "";
  const dims = dimensions(format);
  const audioDurationFull = await mediaDuration(voiceover.path);
  const maxVideoSeconds = Number(process.env.MAX_VIDEO_SECONDS || 240);
  const audioDuration = Math.min(audioDurationFull, maxVideoSeconds);

  const allScenes = parseTimestampedScript(script, topic, niche).filter((s) => s.start < audioDuration);
  if (!allScenes.length) throw new Error("No valid timestamp lines found.");
  const maxScenes = Number(process.env.MAX_VIDEO_SCENES || 45);
  const scenes = combineScenesForRender(allScenes, 12).slice(0, maxScenes);
  const parts = [];
  const report = [];

  for (let i = 0; i < scenes.length; i++) {
    job.progress = Math.round((i / Math.max(1, scenes.length)) * 80);
    job.message = `Rendering scene ${i + 1} of ${scenes.length}`;
    const scene = scenes[i];
    let sourceInfo = "Fallback background";
    let mediaPath = "";
    try {
      const pexels = await searchPexels(scene.query, 2);
      const pixabay = await searchPixabay(scene.query, 2);
      const media = [...pexels, ...pixabay].find((x) => x.type === "video" && x.downloadUrl);
      if (media) {
        mediaPath = path.join(workDir, `media-${i}.mp4`);
        await downloadFile(media.downloadUrl, mediaPath);
        sourceInfo = `${media.source}: ${media.title}`;
      }
    } catch (_) {}

    const partPath = path.join(workDir, `part-${String(i).padStart(4, "0")}.mp4`);
    if (mediaPath) {
      try { await execFileAsync(ffmpegPath, makeVideoPartArgs(mediaPath, scene.duration, dims, partPath), { timeout: 120000 }); }
      catch (_) { await execFileAsync(ffmpegPath, fallbackVideoArgs(scene.duration, dims, partPath, scene.text), { timeout: 60000 }); }
    } else {
      await execFileAsync(ffmpegPath, fallbackVideoArgs(scene.duration, dims, partPath, scene.text), { timeout: 60000 });
    }
    parts.push(partPath);
    report.push(`Scene ${scene.scene} ${scene.timestamp}
Line: ${scene.text}
Media used: ${sourceInfo}
Text to include: ${scene.textCallout || "None"}
SFX: ${scene.sfx}
SFX details: ${scene.sfxDetails?.use || "Use lightly under voiceover"} | Volume: ${scene.sfxDetails?.volume || "8–12%"} | Search terms: ${(scene.sfxDetails?.searchTerms || []).join(" | ")}
Music cue: ${scene.musicCue || "Serious documentary"}
Canva terms: ${scene.canvaTerms.join(" | ")}
`);
  }

  job.progress = 84;
  job.message = "Combining video...";
  const listPath = path.join(workDir, "concat.txt");
  fs.writeFileSync(listPath, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const videoOnly = path.join(workDir, "video-only.mp4");
  await execFileAsync(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", videoOnly], { timeout: 300000 });

  job.progress = 90;
  job.message = "Adding voice, music and sound effects...";
  const musicPath = path.join(workDir, "music.wav");
  const sfxPath = path.join(workDir, "sfx.wav");
  createAutoMusic(audioDuration, mood, musicPath);
  createAutoSfx(audioDuration, scenes, sfxPath);

  const outputName = `${slugify(topic || "elias-video")}-${job.id}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  const filters = [
    "[1:a]volume=1.0[voice]",
    "[2:a]volume=0.18,atrim=0:" + audioDuration + "[music]",
    "[3:a]volume=0.45,atrim=0:" + audioDuration + "[sfx]",
    "[voice][music][sfx]amix=inputs=3:duration=first:dropout_transition=2[a]",
  ].join(";");

  await execFileAsync(ffmpegPath, [
    "-y", "-i", videoOnly, "-i", voiceover.path, "-i", musicPath, "-i", sfxPath,
    "-filter_complex", filters, "-map", "0:v", "-map", "[a]", "-shortest",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", outputPath,
  ], { timeout: 300000 });

  const reportName = outputName.replace(".mp4", "-media-plan.txt");
  fs.writeFileSync(path.join(OUTPUT_DIR, reportName), report.join("\n"));
  return { outputUrl: `/output/${outputName}`, reportUrl: `/output/${reportName}`, renderedScenes: scenes.length, parsedTimestamps: allScenes.length, duration: Math.round(audioDuration) };
}

app.get("/api/status", (req, res) => {
  res.json({ ok: true, keys: keyStatus(), sources: SOURCE_LABELS });
});

app.post("/api/search-media", async (req, res) => {
  try {
    const { query = "", topic = "", niche = "general", count = 6, sources = ALL_SOURCES } = req.body || {};
    const q = smartMediaQuery(query, topic, niche);
    const data = await searchAllSources(q, count, sources);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || "Search failed." });
  }
});

app.post("/api/start-suggestions", async (req, res) => {
  try {
    const { script = "", topic = "", niche = "general", count = 3, sources = ALL_SOURCES, includeLiveMedia = true } = req.body || {};
    const scenes = parseTimestampedScript(script, topic, niche);
    if (!scenes.length) return res.status(400).json({ error: "No valid timestamps found. Use 00:00 Sentence format." });

    const id = crypto.randomBytes(8).toString("hex");
    const job = { id, status: "running", progress: 0, message: "Starting suggestions...", result: null, error: "" };
    JOBS.set(id, job);
    res.json({ jobId: id });

    setImmediate(async () => {
      try {
        const output = [];
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          job.progress = Math.round((i / Math.max(1, scenes.length)) * 95);
          job.message = `Processing timestamp ${i + 1} of ${scenes.length}`;
          let media = null;
          if (includeLiveMedia !== false) {
            media = await searchAllSources(scene.query, count, sources);
          }
          output.push({ ...scene, sfxSources: sfxSourceResults(scene), media });
        }
        job.status = "complete";
        job.progress = 100;
        job.message = "Suggestions ready.";
        const musicPlan = backgroundMusicPlan(scenes, topic, niche);
        job.result = { scenes: output, total: output.length, keys: keyStatus(), backgroundMusicPlan: musicPlan, backgroundMusicResults: backgroundMusicSourceResults(musicPlan) };
      } catch (error) {
        job.status = "failed";
        job.error = error.message || "Suggestion job failed.";
        job.message = job.error;
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not start suggestions." });
  }
});

app.get("/api/job/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json(job);
});

app.post("/api/start-video", upload.fields([{ name: "voiceover", maxCount: 1 }]), async (req, res) => {
  try {
    const id = crypto.randomBytes(8).toString("hex");
    const job = { id, status: "running", progress: 0, message: "Starting video render...", result: null, error: "" };
    JOBS.set(id, job);
    res.json({ jobId: id });

    setImmediate(async () => {
      try {
        const result = await renderVideoJob(job, req.body || {}, req.files || {});
        job.status = "complete";
        job.progress = 100;
        job.message = "Video ready.";
        job.result = result;
      } catch (error) {
        console.error(error);
        job.status = "failed";
        job.progress = 100;
        job.error = error.message || "Video render failed.";
        job.message = job.error;
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not start video job." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Elias Media Render Dashboard running on port ${PORT}`);
});
