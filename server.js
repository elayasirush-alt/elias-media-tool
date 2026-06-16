
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
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, "tmp", "uploads");
const RENDER_DIR = path.join(__dirname, "tmp", "renders");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(RENDER_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 240 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true, limit: "3mb" }));

function authToken() {
  const password = process.env.APP_PASSWORD || "";
  const username = process.env.APP_USERNAME || "admin";
  if (!password) return "";
  return crypto.createHmac("sha256", password).update(username).digest("hex");
}

function parseCookies(header = "") {
  return Object.fromEntries(
    String(header)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function loginPage(error = "") {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Elias Media Login</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; color: #eef6ff; background: radial-gradient(circle at top left, #12345a, #07111f 45%, #030711); }
    .card { width: min(420px, calc(100% - 32px)); border: 1px solid rgba(148, 163, 184, .25); border-radius: 24px; padding: 28px; background: rgba(8, 14, 28, .88); box-shadow: 0 24px 70px rgba(0,0,0,.35); }
    h1 { margin: 0 0 8px; font-size: 30px; }
    p { color: #a9b8d0; line-height: 1.5; }
    label { display: block; margin: 16px 0 7px; color: #dbeafe; font-weight: 700; }
    input { width: 100%; box-sizing: border-box; border: 1px solid rgba(148, 163, 184, .35); border-radius: 14px; padding: 14px; background: #050b16; color: #fff; font-size: 16px; }
    button { width: 100%; margin-top: 20px; border: 0; border-radius: 14px; padding: 14px 18px; background: linear-gradient(135deg, #38bdf8, #818cf8); color: #06111f; font-weight: 900; font-size: 16px; cursor: pointer; }
    .error { margin-top: 14px; padding: 12px; border-radius: 12px; color: #fecaca; background: rgba(239, 68, 68, .12); border: 1px solid rgba(248, 113, 113, .35); }
  </style>
</head>
<body>
  <form class="card" method="post" action="/login">
    <h1>Elias Media</h1>
    <p>Enter your private login to access the studio.</p>
    <label>Username</label>
    <input name="username" autocomplete="username" required />
    <label>Password</label>
    <input name="password" type="password" autocomplete="current-password" required />
    <button type="submit">Login</button>
    ${error ? `<div class="error">${error}</div>` : ""}
  </form>
</body>
</html>`;
}

app.get("/login", (req, res) => {
  if (!process.env.APP_PASSWORD) return res.redirect("/");
  res.send(loginPage());
});

app.post("/login", (req, res) => {
  const expectedUsername = process.env.APP_USERNAME || "admin";
  const expectedPassword = process.env.APP_PASSWORD || "";
  if (!expectedPassword) return res.redirect("/");
  const username = String(req.body?.username || "");
  const password = String(req.body?.password || "");
  if (username === expectedUsername && password === expectedPassword) {
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `em_auth=${authToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
    return res.redirect("/");
  }
  res.status(401).send(loginPage("Wrong username or password."));
});

app.get("/logout", (req, res) => {
  res.setHeader("Set-Cookie", "em_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.redirect("/login");
});

function requireLogin(req, res, next) {
  const expected = authToken();
  if (!expected) return next();
  const cookies = parseCookies(req.headers.cookie || "");
  if (cookies.em_auth === expected) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Login required." });
  return res.redirect("/login");
}

app.use(requireLogin);
app.use(express.static(path.join(__dirname, "public")));
app.use("/renders", express.static(RENDER_DIR));

const STOPWORDS = new Set("the a an and or but of to in on for with from by as is are was were be been being this that these those it its into about after before during while where when what why how do does did can could should would will just your you they them their has have had not no yes more most very really started through every across over under".split(" "));

function safeText(value) {
  return String(value || "").replace(/[^\w\s.,?!:$%&()'-]/g, "").replace(/\s+/g, " ").trim();
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

function topKeywords(text = "", count = 7) {
  const words = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([w]) => w);
}

function nicheWords(niche = "") {
  return {
    automotive: "cars trucks vehicle dealership mechanic engine highway pickup",
    aviation: "aircraft airplane airport runway cockpit aviation",
    business: "business finance office economy company money charts",
    motivation: "cinematic lifestyle sunrise city walking success discipline",
    architecture: "architecture building construction interior exterior design",
    music: "stage performance microphone studio concert singer",
    documentary: "documentary real footage news evidence city people",
  }[niche] || "documentary real footage b roll";
}

function buildSceneQuery(text, topic, niche) {
  const keywords = topKeywords(`${topic} ${text}`, 7);
  return `${topic || ""} ${keywords.join(" ")} ${nicheWords(niche)}`.trim() || "cinematic documentary b roll";
}

function detectRiskFlags(text = "") {
  const flags = [];
  if (/\b(recall|lawsuit|investigation|regulator|government|nhtsa|faa|police|court|official|data|cox|caredge)\b/i.test(text)) flags.push("Verify official/source claim");
  if (/(\$?\d[\d,.]*\s?(million|billion|thousand|%|percent|people|trucks|cars|planes|deaths|injuries|days)?)/i.test(text)) flags.push("Verify number");
  if (/\b(killed|death|fatal|crash|accident|injured|unsafe|dangerous)\b/i.test(text)) flags.push("Use careful wording");
  if (/\b(bankrupt|fraud|criminal|illegal|corrupt|scam)\b/i.test(text)) flags.push("High-risk claim");
  return [...new Set(flags)];
}

function createCallout(text = "") {
  const clean = safeText(text).slice(0, 140);
  if (!clean) return "";
  if (/\?|\bwhy\b|\bhow\b|\bwhat\b|\bdid\b|\bcan\b|\bshould\b/i.test(clean)) {
    return (clean.includes("?") ? clean.split("?")[0] + "?" : clean).slice(0, 54).toUpperCase();
  }
  const number = clean.match(/(\$?\d[\d,.]*\s?(million|billion|thousand|%|percent|trucks|cars|people|years|days|hours)?)/i);
  if (number && number[0].trim()) return `${number[0].toUpperCase()} MATTERS`;
  if (/\b(problem|failure|recall|warning|mistake|truth|risk|damage|collapse|turning point|investigation|lawsuit|exposed|panic|decline|consequence|strategy|arrogant|greedy)\b/i.test(clean)) {
    return clean.split(" ").filter((w) => w.length > 2).slice(0, 5).join(" ").toUpperCase();
  }
  return "";
}

function visualPlanForScene(text = "", niche = "documentary") {
  const lower = String(text).toLowerCase();
  if (/\b(document|report|letter|email|claim|lawsuit|recall|headline|source|data|cox|caredge)\b/.test(lower)) return "Document/headline/data visual with slow push-in";
  if (/\b(number|cost|million|billion|percent|sales|loss|price|money|inventory|supply)\b/.test(lower)) return "Chart, dealership lot, price tag, or evidence visual";
  if (/\b(buyer|customer|family|contractor|fleet|owner|dealer)\b/.test(lower)) return "People, dealership, customer decision, or showroom B-roll";
  if (niche === "automotive") return "Vehicle, dealership, mechanic, road, pickup, or engine detail";
  if (niche === "aviation") return "Aircraft, cockpit, runway, radar, or airport detail";
  if (niche === "business") return "Office, company building, charts, workers, or market footage";
  if (niche === "architecture") return "Building exterior, interior, plan, construction, or design detail";
  return "Relevant documentary B-roll with clean movement";
}

function parseTimestampedScript(script = "", audioDuration = 0, topic = "", niche = "documentary") {
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

  const scenes = parsed.map((item, index) => {
    const nextStart = parsed[index + 1]?.start;
    let end = typeof nextStart === "number" ? nextStart : (audioDuration || item.start + 8);
    if (audioDuration && end > audioDuration) end = audioDuration;
    let duration = Math.max(2, end - item.start);
    if (duration > 24) duration = 24;
    return {
      scene: index + 1,
      start: item.start,
      end: item.start + duration,
      duration,
      timestamp: item.timestamp,
      text: item.text,
      query: buildSceneQuery(item.text, topic, niche),
      callout: createCallout(item.text),
      riskFlags: detectRiskFlags(item.text),
      visualPlan: visualPlanForScene(item.text, niche),
    };
  });

  return scenes.filter((s) => s.duration > 0.5);
}

function dimensions(format) {
  if (format === "portrait") return { width: 1080, height: 1920 };
  if (format === "square") return { width: 1080, height: 1080 };
  return { width: 1920, height: 1080 };
}

function parseDuration(stderr = "") {
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 60;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

async function mediaDuration(filePath) {
  try {
    await execFileAsync(ffmpegPath, ["-i", filePath], { timeout: 15000 });
  } catch (error) {
    return parseDuration(error.stderr || "");
  }
  return 60;
}

async function downloadFile(url, target) {
  const response = await fetch(url, { headers: { "User-Agent": "EliasMedia/1.0" } });
  if (!response.ok) throw new Error(`Download failed ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(target, buffer);
  return target;
}

function result(source, type, title, thumbnail, url, downloadUrl = "", meta = "") {
  return { source, type, title: safeText(title).slice(0, 140) || source, thumbnail, url, downloadUrl, meta };
}

function bestPexelsFile(video) {
  const files = (video.video_files || [])
    .filter((f) => f.file_type === "video/mp4" && f.link)
    .sort((a, b) => {
      const ar = Math.abs((a.width || 1) / (a.height || 1) - 1.777);
      const br = Math.abs((b.width || 1) / (b.height || 1) - 1.777);
      return ar - br || (b.width || 0) - (a.width || 0);
    });
  return files.find((f) => (f.width || 0) >= 1280) || files[0];
}

async function searchPexelsVideos(query, count = 6) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({ query, per_page: String(Math.min(count, 20)), orientation: "landscape" });
    const response = await fetch(`https://api.pexels.com/videos/search?${params}`, { headers: { Authorization: key } });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.videos || []).map((video) => {
      const file = bestPexelsFile(video);
      return file?.link ? result("Pexels", "video", `Pexels video ${video.id}`, video.image, video.url, file.link, "Stock video") : null;
    }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function searchPexelsPhotos(query, count = 6) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({ query, per_page: String(Math.min(count, 20)), orientation: "landscape" });
    const response = await fetch(`https://api.pexels.com/v1/search?${params}`, { headers: { Authorization: key } });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.photos || []).map((photo) => result("Pexels", "photo", photo.alt || `Pexels photo ${photo.id}`, photo.src?.medium || photo.src?.large, photo.url, photo.src?.original, "Stock photo"));
  } catch (_) {
    return [];
  }
}

async function searchPixabayVideos(query, count = 6) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({ key, q: query, per_page: String(Math.min(count, 20)), safesearch: "true" });
    const response = await fetch(`https://pixabay.com/api/videos/?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.hits || []).map((item) => {
      const video = item.videos?.large || item.videos?.medium || item.videos?.small;
      return video?.url ? result("Pixabay", "video", item.tags || `Pixabay video ${item.id}`, item.picture_id ? `https://i.vimeocdn.com/video/${item.picture_id}_640x360.jpg` : "", item.pageURL, video.url, `By ${item.user || "creator"}`) : null;
    }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function searchPixabayImages(query, count = 6) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({ key, q: query, per_page: String(Math.min(count, 20)), safesearch: "true", image_type: "photo" });
    const response = await fetch(`https://pixabay.com/api/?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.hits || []).map((item) => result("Pixabay", "photo", item.tags || `Pixabay image ${item.id}`, item.webformatURL, item.pageURL, item.largeImageURL, `By ${item.user || "creator"}`));
  } catch (_) {
    return [];
  }
}

async function searchUnsplash(query, count = 6) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({ query, per_page: String(Math.min(count, 20)), orientation: "landscape" });
    const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, { headers: { Authorization: `Client-ID ${key}` } });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map((item) => result("Unsplash", "photo", item.alt_description || item.description || `Unsplash photo`, item.urls?.small, item.links?.html, item.urls?.raw, `By ${item.user?.name || "creator"}`));
  } catch (_) {
    return [];
  }
}

async function searchYouTube(query, count = 6) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({ key, q: query, part: "snippet", type: "video", maxResults: String(Math.min(count, 10)), safeSearch: "moderate" });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.items || []).map((item) => result("YouTube", "reference", item.snippet?.title || "YouTube reference", item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url, `https://www.youtube.com/watch?v=${item.id?.videoId}`, "", "Reference only, not downloadable"));
  } catch (_) {
    return [];
  }
}

async function searchOpenverse(query, count = 6) {
  try {
    const params = new URLSearchParams({ q: query, page_size: String(Math.min(count, 20)) });
    const response = await fetch(`https://api.openverse.engineering/v1/images/?${params}`, { headers: { "User-Agent": "EliasMedia/1.0" } });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map((item) => result("Openverse", "photo", item.title || "Openverse image", item.thumbnail || item.url, item.foreign_landing_url || item.url, item.url, item.license ? `License: ${item.license}` : ""));
  } catch (_) {
    return [];
  }
}

async function searchNASA(query, count = 6) {
  try {
    const params = new URLSearchParams({ q: query, media_type: "image" });
    const response = await fetch(`https://images-api.nasa.gov/search?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.collection?.items || []).slice(0, count).map((item) => {
      const title = item.data?.[0]?.title || "NASA image";
      const thumb = item.links?.[0]?.href || "";
      const nasaId = item.data?.[0]?.nasa_id || "";
      return result("NASA", "photo", title, thumb, item.href || `https://images.nasa.gov/details/${nasaId}`, thumb, "NASA image library");
    });
  } catch (_) {
    return [];
  }
}

async function searchWikimedia(query, count = 6) {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: String(Math.min(count, 15)),
      prop: "imageinfo",
      iiprop: "url|mime|extmetadata",
      origin: "*",
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data.query?.pages || {}).map((page) => {
      const info = page.imageinfo?.[0] || {};
      const title = String(page.title || "Wikimedia media").replace(/^File:/, "");
      return result("Wikimedia", info.mime?.includes("video") ? "video" : "photo", title, info.thumburl || info.url, info.descriptionurl || info.url, info.url, info.extmetadata?.LicenseShortName?.value || "Commons");
    });
  } catch (_) {
    return [];
  }
}

async function searchArchive(query, count = 6) {
  try {
    const params = new URLSearchParams({
      q: `${query} AND mediatype:(movies OR image)`,
      fl: "identifier,title,mediatype",
      rows: String(Math.min(count, 20)),
      page: "1",
      output: "json",
    });
    const response = await fetch(`https://archive.org/advancedsearch.php?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.response?.docs || []).map((item) => result("Internet Archive", item.mediatype === "movies" ? "video" : "photo", item.title || item.identifier, `https://archive.org/services/img/${item.identifier}`, `https://archive.org/details/${item.identifier}`, "", item.mediatype || "archive"));
  } catch (_) {
    return [];
  }
}

async function searchFlickr(query, count = 6) {
  const key = process.env.FLICKR_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({
      method: "flickr.photos.search",
      api_key: key,
      text: query,
      safe_search: "1",
      content_type: "1",
      media: "photos",
      per_page: String(Math.min(count, 20)),
      format: "json",
      nojsoncallback: "1",
      extras: "url_m,url_l,owner_name,license",
    });
    const response = await fetch(`https://www.flickr.com/services/rest/?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.photos?.photo || []).map((item) => result("Flickr", "photo", item.title || "Flickr photo", item.url_m || item.url_l, `https://www.flickr.com/photos/${item.owner}/${item.id}`, item.url_l || item.url_m, item.ownername ? `By ${item.ownername}` : ""));
  } catch (_) {
    return [];
  }
}

async function searchGiphy(query, count = 6) {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({ api_key: key, q: query, limit: String(Math.min(count, 20)), rating: "pg" });
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []).map((item) => result("GIPHY", "gif", item.title || "GIPHY result", item.images?.fixed_width?.webp || item.images?.fixed_width?.url, item.url, item.images?.original?.mp4 || item.images?.original?.url, "GIF/animation"));
  } catch (_) {
    return [];
  }
}

async function searchAllSources(query, count = 6, allowedSources = []) {
  const allow = new Set(allowedSources?.length ? allowedSources : ["pexels", "pixabay", "youtube", "unsplash", "openverse", "nasa", "wikimedia", "archive", "flickr", "giphy"]);
  const tasks = [];
  if (allow.has("pexels")) tasks.push(searchPexelsVideos(query, count), searchPexelsPhotos(query, count));
  if (allow.has("pixabay")) tasks.push(searchPixabayVideos(query, count), searchPixabayImages(query, count));
  if (allow.has("youtube")) tasks.push(searchYouTube(query, count));
  if (allow.has("unsplash")) tasks.push(searchUnsplash(query, count));
  if (allow.has("openverse")) tasks.push(searchOpenverse(query, count));
  if (allow.has("nasa")) tasks.push(searchNASA(query, count));
  if (allow.has("wikimedia")) tasks.push(searchWikimedia(query, count));
  if (allow.has("archive")) tasks.push(searchArchive(query, count));
  if (allow.has("flickr")) tasks.push(searchFlickr(query, count));
  if (allow.has("giphy")) tasks.push(searchGiphy(query, count));

  const settled = await Promise.allSettled(tasks);
  const flat = settled.flatMap((item) => item.status === "fulfilled" ? item.value : []);
  const seen = new Set();
  const filtered = flat.filter((item) => {
    const key = item.url || item.downloadUrl || item.thumbnail || item.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const groups = {};
  for (const item of filtered) {
    groups[item.source] ||= [];
    groups[item.source].push(item);
  }
  return { results: filtered, groups };
}

const usedMediaUrls = new Set();

async function getBestStockForScene(scene, niche) {
  const [pexels, pixabay] = await Promise.all([searchPexelsVideos(scene.query, 5), searchPixabayVideos(scene.query, 5)]);
  const all = [...pexels, ...pixabay].filter((item) => item && item.downloadUrl && !usedMediaUrls.has(item.downloadUrl));
  const chosen = all[0] || [...pexels, ...pixabay][0] || null;
  if (chosen?.downloadUrl) usedMediaUrls.add(chosen.downloadUrl);
  return chosen;
}

function fallbackColorVideoArgs(duration, dims, text, outPath) {
  return [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0x08111f:s=${dims.width}x${dims.height}:d=${duration}`,
    "-vf", "fade=t=in:st=0:d=0.12,fade=t=out:st=" + Math.max(0, duration - 0.16).toFixed(2) + ":d=0.16",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    outPath,
  ];
}

function makePartArgs(inputPath, duration, dims, text, photoMotion, outPath) {
  // No FFmpeg drawtext: Render's ffmpeg-static build may not include it.
  const scaleCrop = `scale=${dims.width}:${dims.height}:force_original_aspect_ratio=increase,crop=${dims.width}:${dims.height},setsar=1`;
  const fade = `,fade=t=in:st=0:d=0.12,fade=t=out:st=${Math.max(0, duration - 0.16).toFixed(2)}:d=0.16`;
  return [
    "-y",
    "-stream_loop", "-1",
    "-i", inputPath,
    "-t", String(duration),
    "-vf", `${scaleCrop}${fade}`,
    "-an",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    outPath,
  ];
}

async function renderVideo({ audioPath, musicPath, topic, niche, format, script, useMusic, photoMotion }) {
  usedMediaUrls.clear();

  const id = crypto.randomBytes(8).toString("hex");
  const workDir = path.join(RENDER_DIR, id);
  fs.mkdirSync(workDir, { recursive: true });

  const audioDuration = Math.max(8, Math.min(await mediaDuration(audioPath), 1200));
  const dims = dimensions(format);
  const scenes = parseTimestampedScript(script, audioDuration, topic, niche);
  if (!scenes.length) throw new Error("No valid timestamps found. Use lines like 00:00 Your sentence here or (0:00) Your sentence here.");

  const parts = [];
  const sourceReport = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const partPath = path.join(workDir, `part-${String(i).padStart(3, "0")}.mp4`);
    const chosen = await getBestStockForScene(scene, niche);

    if (chosen) {
      const mediaPath = path.join(workDir, `stock-${String(i).padStart(3, "0")}.mp4`);
      try {
        await downloadFile(chosen.downloadUrl || chosen.url, mediaPath);
        await execFileAsync(ffmpegPath, makePartArgs(mediaPath, scene.duration, dims, scene.callout, photoMotion, partPath), { timeout: 120000 });
        sourceReport.push(`Scene ${scene.scene} ${scene.timestamp}: ${chosen.source} - ${chosen.title}\nSource: ${chosen.url}\nVisual plan: ${scene.visualPlan}\nLine: ${scene.text}\nText callout: ${scene.callout || "None"}\nRisk: ${(scene.riskFlags || []).join(", ") || "None"}\n`);
      } catch (error) {
        await execFileAsync(ffmpegPath, fallbackColorVideoArgs(scene.duration, dims, scene.callout || scene.visualPlan || topic, partPath), { timeout: 60000 });
        sourceReport.push(`Scene ${scene.scene} ${scene.timestamp}: fallback generated visual\nVisual plan: ${scene.visualPlan}\nLine: ${scene.text}\nText callout: ${scene.callout || "None"}\nRisk: ${(scene.riskFlags || []).join(", ") || "None"}\n`);
      }
    } else {
      await execFileAsync(ffmpegPath, fallbackColorVideoArgs(scene.duration, dims, scene.callout || scene.visualPlan || topic, partPath), { timeout: 60000 });
      sourceReport.push(`Scene ${scene.scene} ${scene.timestamp}: fallback generated visual\nVisual plan: ${scene.visualPlan}\nLine: ${scene.text}\nText callout: ${scene.callout || "None"}\nRisk: ${(scene.riskFlags || []).join(", ") || "None"}\n`);
    }

    parts.push(partPath);
  }

  const listPath = path.join(workDir, "concat.txt");
  fs.writeFileSync(listPath, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));

  const silentVideo = path.join(workDir, "video-only.mp4");
  await execFileAsync(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", silentVideo], { timeout: 180000 });

  const outputName = `${slugify(topic || "timestamped-video")}-${id}.mp4`;
  const outputPath = path.join(RENDER_DIR, outputName);

  if (useMusic === "true" && musicPath) {
    await execFileAsync(ffmpegPath, [
      "-y", "-i", silentVideo, "-i", audioPath, "-stream_loop", "-1", "-i", musicPath,
      "-filter_complex", `[2:a]volume=0.10,atrim=0:${audioDuration}[m];[1:a]volume=1.0[v];[v][m]amix=inputs=2:duration=first:dropout_transition=2[a]`,
      "-map", "0:v", "-map", "[a]", "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", outputPath,
    ], { timeout: 240000 });
  } else {
    await execFileAsync(ffmpegPath, [
      "-y", "-i", silentVideo, "-i", audioPath, "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", outputPath,
    ], { timeout: 240000 });
  }

  const reportName = outputName.replace(".mp4", "-source-report.txt");
  fs.writeFileSync(path.join(RENDER_DIR, reportName), sourceReport.join("\n"));
  return {
    duration: Math.round(audioDuration),
    scenes: scenes.length,
    outputUrl: `/renders/${outputName}`,
    reportUrl: `/renders/${reportName}`,
    riskFlags: [...new Set(scenes.flatMap((s) => s.riskFlags || []))],
  };
}

app.post("/api/parse-script", async (req, res) => {
  try {
    const { script = "", topic = "", niche = "documentary", audioDuration = 0 } = req.body || {};
    const scenes = parseTimestampedScript(script, Number(audioDuration) || 0, topic, niche);
    if (!scenes.length) return res.status(400).json({ error: "No valid timestamps found. Use lines like 00:00 Your sentence here or (0:00) Your sentence here." });
    res.json({ scenes, riskFlags: [...new Set(scenes.flatMap((s) => s.riskFlags || []))] });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not parse script." });
  }
});

app.post("/api/search-media", async (req, res) => {
  try {
    const { query = "", niche = "documentary", sources = [], count = 6 } = req.body || {};
    const cleanQuery = safeText(query);
    if (!cleanQuery) return res.status(400).json({ error: "Enter something to search." });
    const finalQuery = `${cleanQuery} ${nicheWords(niche)}`.trim();
    const data = await searchAllSources(finalQuery, Number(count) || 6, sources);
    res.json({ query: cleanQuery, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message || "Media search failed." });
  }
});

app.post("/api/suggest-media", async (req, res) => {
  try {
    const { script = "", topic = "", niche = "documentary", maxScenes = 25, sources = [] } = req.body || {};
    const scenes = parseTimestampedScript(script, 0, topic, niche).slice(0, Math.min(Number(maxScenes) || 25, 40));
    if (!scenes.length) return res.status(400).json({ error: "No valid timestamps found." });

    const output = [];
    for (const scene of scenes) {
      const data = await searchAllSources(scene.query, 3, sources);
      output.push({
        ...scene,
        media: data.results.slice(0, 12),
        groups: data.groups,
      });
    }
    res.json({ scenes: output, limitedTo: scenes.length });
  } catch (error) {
    res.status(500).json({ error: error.message || "Media suggestion failed." });
  }
});

app.post(
  "/api/build-video",
  upload.fields([
    { name: "voiceover", maxCount: 1 },
    { name: "music", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const voiceover = req.files?.voiceover?.[0];
      if (!voiceover) return res.status(400).json({ error: "Upload a voiceover audio file first." });

      const music = req.files?.music?.[0];
      const topic = String(req.body.topic || "").trim();
      const niche = String(req.body.niche || "documentary");
      const format = String(req.body.format || "landscape");
      const script = String(req.body.script || "");
      const useMusic = String(req.body.useMusic || "false");
      const photoMotion = String(req.body.photoMotion || "slow-zoom");

      const result = await renderVideo({
        audioPath: voiceover.path,
        musicPath: music?.path || "",
        topic,
        niche,
        format,
        script,
        useMusic,
        photoMotion,
      });

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || "Video build failed." });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Elias Media Studio running on http://localhost:${PORT}`);
});
