import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

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
    small { color: #8ea2bd; display: block; margin-top: 16px; }
  </style>
</head>
<body>
  <form class="card" method="post" action="/login">
    <h1>Elias Media</h1>
    <p>Enter your private login to access the media search dashboard.</p>
    <label>Username</label>
    <input name="username" autocomplete="username" required />
    <label>Password</label>
    <input name="password" type="password" autocomplete="current-password" required />
    <button type="submit">Login</button>
    ${error ? `<div class="error">${error}</div>` : ""}
    <small>Password protection is controlled from Render environment variables.</small>
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

function cleanFilename(value, fallback = "media") {
  const safe = String(value || fallback)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90)
    .replace(/^-|-$/g, "");
  return safe || fallback;
}

function isAllowedDownloadHost(url) {
  const host = url.hostname.toLowerCase();
  return (
    host === "images.pexels.com" ||
    host === "videos.pexels.com" ||
    host.endsWith(".pexels.com") ||
    host === "cdn.pixabay.com" ||
    host.endsWith(".pixabay.com") ||
    host === "images.unsplash.com" ||
    host === "plus.unsplash.com" ||
    host === "api.unsplash.com" ||
    host.endsWith("openverse.org") ||
    host.endsWith("wikimedia.org") ||
    host.endsWith("staticflickr.com") ||
    host.endsWith("giphy.com") ||
    host.endsWith("media.giphy.com") ||
    host.endsWith("archive.org") ||
    host.endsWith("nasa.gov")
  );
}

async function resolveUnsplashDownload(downloadLocation) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!downloadLocation || !key) return "";
  const url = new URL(downloadLocation);
  if (url.hostname !== "api.unsplash.com") return "";

  const response = await fetch(url.toString(), { headers: { Authorization: `Client-ID ${key}` } });
  if (!response.ok) return "";
  const data = await response.json();
  return data?.url || "";
}

app.get("/api/download", async (req, res) => {
  try {
    const source = String(req.query.source || "").toLowerCase();
    const requestedUrl = String(req.query.url || "");
    const downloadLocation = String(req.query.downloadLocation || "");
    const filename = cleanFilename(req.query.filename || "media-download");

    let mediaUrl = requestedUrl;

    if (source.includes("unsplash") && downloadLocation) {
      const resolved = await resolveUnsplashDownload(downloadLocation);
      if (resolved) mediaUrl = resolved;
    }

    if (!mediaUrl) return res.status(400).send("Missing download URL.");

    const parsed = new URL(mediaUrl);
    if (!isAllowedDownloadHost(parsed)) return res.status(403).send("This source is not allowed for direct download.");

    const response = await fetch(parsed.toString());
    if (!response.ok) return res.status(response.status).send("Could not fetch media file.");

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const ext = contentType.includes("video") ? ".mp4" : contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : contentType.includes("jpeg") || contentType.includes("jpg") ? ".jpg" : "";
    const finalName = filename.toLowerCase().endsWith(ext) || !ext ? filename : `${filename}${ext}`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${finalName}"`);

    if (!response.body) return res.status(500).send("No media stream available.");
    const reader = response.body.getReader();
    async function pump() {
      const { done, value } = await reader.read();
      if (done) return res.end();
      res.write(Buffer.from(value));
      return pump();
    }
    return pump();
  } catch (error) {
    return res.status(500).send(error.message || "Download failed.");
  }
});



const POLICIES = {
  FREE_DOWNLOAD: "Free download",
  LICENSE_CHECK: "License check",
  REFERENCE: "Reference only",
  PAID: "Paid license",
  SUBSCRIPTION: "Subscription",
  CANVA: "Canva manual search",
  ARCHIVE: "Archive rights vary",
  UNSPLASH: "Unsplash photo license",
  OPENVERSE: "Open license check",
  NASA: "NASA usage guidelines",
  COMMONS: "Commons license check",
  ARCHIVE: "Archive rights vary",
  FLICKR: "Flickr license check",
  GIPHY: "GIPHY API media",
};

function e(query) {
  return encodeURIComponent(query.trim());
}

function buildUrl(template, query) {
  return template.replaceAll("{q}", e(query));
}

const SOURCE_GROUPS = [
  {
    group: "Social & Video Platforms",
    note: "Use these for research, reference, style ideas, trends, and source checking. Do not download/reuse unless you own the video or have permission.",
    sources: [
      { name: "YouTube", policy: POLICIES.REFERENCE, action: "Open results", url: "https://www.youtube.com/results?search_query={q}" },
      { name: "Vimeo", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://vimeo.com/search?q={q}" },
      { name: "Dailymotion", policy: POLICIES.REFERENCE, action: "Open results", url: "https://www.dailymotion.com/search/{q}/videos" },
      { name: "TikTok", policy: POLICIES.REFERENCE, action: "Open trends", url: "https://www.tiktok.com/search/video?q={q}" },
      { name: "Twitch", policy: POLICIES.REFERENCE, action: "Open results", url: "https://www.twitch.tv/search?term={q}" },
      { name: "Facebook Watch", policy: POLICIES.REFERENCE, action: "Open results", url: "https://www.facebook.com/watch/search/?q={q}" },
      { name: "Instagram Reels", policy: POLICIES.REFERENCE, action: "Open search", url: "https://www.instagram.com/explore/search/keyword/?q={q}" },
      { name: "X / Twitter Video", policy: POLICIES.REFERENCE, action: "Open video search", url: "https://x.com/search?q={q}&src=typed_query&f=video" },
      { name: "Reddit", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://www.reddit.com/search/?q={q}&type=link" },
      { name: "Rumble", policy: POLICIES.REFERENCE, action: "Open results", url: "https://rumble.com/search/video?q={q}" },
      { name: "Kick", policy: POLICIES.REFERENCE, action: "Open results", url: "https://kick.com/search?query={q}" },
      { name: "Bilibili", policy: POLICIES.REFERENCE, action: "Open results", url: "https://search.bilibili.com/all?keyword={q}" },
      { name: "Youku", policy: POLICIES.REFERENCE, action: "Open results", url: "https://so.youku.com/search_video/q_{q}" },
      { name: "Veoh", policy: POLICIES.REFERENCE, action: "Open results", url: "https://www.veoh.com/find/?query={q}" },
      { name: "Snapchat Spotlight", policy: POLICIES.REFERENCE, action: "Open explore", url: "https://www.snapchat.com/explore?search={q}" },
      { name: "Threads", policy: POLICIES.REFERENCE, action: "Open search", url: "https://www.threads.net/search?q={q}" },
    ],
  },
  {
    group: "Free Stock Video Sites",
    note: "Best category for reusable b-roll. Still open the source page and check each clip license before publishing.",
    sources: [
      { name: "Pexels Videos", policy: POLICIES.FREE_DOWNLOAD, action: "API results below + open site", url: "https://www.pexels.com/search/videos/{q}/" },
      { name: "Pixabay Videos", policy: POLICIES.FREE_DOWNLOAD, action: "API results below if key added", url: "https://pixabay.com/videos/search/{q}/" },
      { name: "Videvo", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://www.videvo.net/search/{q}/" },
      { name: "Mixkit", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://mixkit.co/free-stock-video/?q={q}" },
      { name: "Coverr", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://coverr.co/search?q={q}" },
      { name: "Videezy", policy: "Attribution may apply", action: "Open results", url: "https://www.videezy.com/free-video/{q}" },
      { name: "Vidsplay", policy: "Attribution may apply", action: "Open results", url: "https://www.vidsplay.com/?s={q}" },
      { name: "Mazwai", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://mazwai.com/search/{q}" },
      { name: "Dareful", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://www.dareful.com/?s={q}" },
      { name: "Life of Vids", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://www.lifeofvids.com/?s={q}" },
      { name: "Stock Footage for Free", policy: "Free account may be needed", action: "Open results", url: "https://www.stockfootageforfree.com/?s={q}" },
    ],
  },
  {
    group: "Public Domain & Archive Video",
    note: "Useful for documentary, historical, aviation, space, government, public event, and archival clips. Rights vary by item.",
    sources: [
      { name: "Internet Archive", policy: POLICIES.ARCHIVE, action: "API results below + open site", url: "https://archive.org/search?query={q}&and%5B%5D=mediatype%3A%22movies%22" },
      { name: "Wikimedia Commons Videos", policy: "Creative Commons / public domain varies", action: "Open media search", url: "https://commons.wikimedia.org/w/index.php?search={q}&title=Special:MediaSearch&type=video" },
      { name: "NASA Image and Video Library", policy: "NASA usage rules apply", action: "API results below + open site", url: "https://images.nasa.gov/search?q={q}&media=video" },
      { name: "British Pathé", policy: POLICIES.PAID, action: "Open archive search", url: "https://www.britishpathe.com/search/query/{q}" },
      { name: "C-SPAN Video Library", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://www.c-span.org/search/?searchtype=Videos&query={q}" },
    ],
  },
  {
    group: "Premium Stock Video Sites",
    note: "Use these only when you have a subscription or license. This tool opens search pages; it does not bypass payment.",
    sources: [
      { name: "Shutterstock", policy: POLICIES.PAID, action: "Open results", url: "https://www.shutterstock.com/search/{q}?image_type=video" },
      { name: "Adobe Stock", policy: POLICIES.PAID, action: "Open results", url: "https://stock.adobe.com/search/video?k={q}" },
      { name: "Getty Images", policy: POLICIES.PAID, action: "Open results", url: "https://www.gettyimages.com/videos/{q}" },
      { name: "Pond5", policy: POLICIES.PAID, action: "Open results", url: "https://www.pond5.com/stock-footage/?kw={q}" },
      { name: "Storyblocks", policy: POLICIES.SUBSCRIPTION, action: "Open results", url: "https://www.storyblocks.com/video/search/{q}" },
      { name: "Envato Elements", policy: POLICIES.SUBSCRIPTION, action: "Open results", url: "https://elements.envato.com/stock-video/{q}" },
      { name: "Artgrid", policy: POLICIES.SUBSCRIPTION, action: "Open results", url: "https://artgrid.io/search?search={q}" },
      { name: "Motion Array", policy: POLICIES.SUBSCRIPTION, action: "Open results", url: "https://motionarray.com/browse/stock-video/?q={q}" },
      { name: "Motion Elements", policy: "Paid / subscription", action: "Open results", url: "https://www.motionelements.com/search/video/{q}" },
      { name: "Dissolve", policy: POLICIES.PAID, action: "Open results", url: "https://dissolve.com/stock-video-footage/{q}" },
      { name: "Filmsupply", policy: POLICIES.PAID, action: "Open results", url: "https://www.filmsupply.com/search/?q={q}" },
      { name: "FilmPac", policy: POLICIES.PAID, action: "Open results", url: "https://filmpac.com/search/{q}" },
      { name: "ProductionCrate", policy: "Free / paid account", action: "Open results", url: "https://vfx.productioncrate.com/search/#!/{q}" },
      { name: "VideoHive", policy: POLICIES.PAID, action: "Open results", url: "https://videohive.net/search/{q}" },
    ],
  },
  {
    group: "Canva & Google Helpers",
    note: "Canva stock must be searched and used inside Canva. Google is for finding source pages, not direct reuse.",
    sources: [
      { name: "Canva Videos Search", policy: POLICIES.CANVA, action: "Copy term into Canva", url: "https://www.canva.com/" },
      { name: "Google Videos", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://www.google.com/search?tbm=vid&q={q}" },
      { name: "Google Images", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://www.google.com/search?tbm=isch&q={q}" },
      { name: "Google Creative Commons Video", policy: POLICIES.LICENSE_CHECK, action: "Open results", url: "https://www.google.com/search?q={q}%20creative%20commons%20video" },
      { name: "Google Photos", policy: "Your own media only", action: "Open Google Photos", url: "https://photos.google.com/search/{q}" },
    ],
  },
];

function createSourceLinks(query) {
  return SOURCE_GROUPS.map((group) => ({
    ...group,
    sources: group.sources.map((source) => ({ ...source, url: buildUrl(source.url, query) })),
  }));
}

function createCanvaSearchSuggestions(query) {
  const base = query.trim();
  const terms = [
    base,
    `${base} video`,
    `${base} cinematic b-roll`,
    `${base} documentary footage`,
    `${base} background video`,
    `${base} aerial footage`,
    `${base} vertical video`,
    `${base} slow motion`,
    `${base} dramatic`,
  ];
  return [...new Set(terms)].map((term) => ({ term, note: "Copy this into Canva's Videos or Photos search bar." }));
}

function createCanvaToolkit(query, orientation = "any") {
  const base = query.trim();
  const formatHint = orientation === "portrait"
    ? "vertical"
    : orientation === "landscape"
      ? "horizontal"
      : orientation === "square"
        ? "square"
        : "any orientation";

  const unique = (items) => [...new Set(items.filter(Boolean))];
  const actions = [
    {
      name: "Open Canva",
      url: "https://www.canva.com/",
      description: "Open Canva and paste any copied term into the Videos or Photos search bar.",
    },
    {
      name: "Canva videos workflow",
      url: "https://www.canva.com/videos/",
      description: "Best for stock clips, b-roll, and motion backgrounds.",
    },
    {
      name: "Canva photo workflow",
      url: "https://www.canva.com/photos/",
      description: "Best for thumbnails, stills, cutaways, and overlays.",
    },
  ];

  const videoTerms = unique([
    `${base} video`,
    `${base} b roll`,
    `${base} cinematic footage`,
    `${base} documentary footage`,
    `${base} ${formatHint} video`,
    `${base} slow motion`,
    `${base} aerial footage`,
    `${base} background video`,
  ]);

  const photoTerms = unique([
    base,
    `${base} photo`,
    `${base} portrait`,
    `${base} close up`,
    `${base} landscape`,
    `${base} dramatic lighting`,
    `${base} background`,
    `${base} wallpaper`,
  ]);

  const keywordAngles = unique([
    `${base} wide shot`,
    `${base} medium shot`,
    `${base} close up`,
    `${base} aerial`,
    `${base} drone`,
    `${base} establishing shot`,
    `${base} people`,
    `${base} empty scene`,
  ]);

  const styles = unique([
    `${base} cinematic`,
    `${base} realistic`,
    `${base} moody`,
    `${base} clean background`,
    `${base} modern`,
    `${base} dramatic`,
    `${base} minimalist`,
    `${base} premium`,
  ]);

  const categories = [
    {
      title: "Video search terms",
      description: "Use these in Canva Videos for motion clips and b-roll.",
      terms: videoTerms,
    },
    {
      title: "Photo search terms",
      description: "Use these in Canva Photos for stills, thumbnails, and backgrounds.",
      terms: photoTerms,
    },
    {
      title: "Shot angles and variations",
      description: "Helpful when Canva's first results feel too generic.",
      terms: keywordAngles,
    },
    {
      title: "Style and mood helpers",
      description: "Add these when you want a more specific look and feel.",
      terms: styles,
    },
  ];

  const workflow = [
    `Start with "${base}" in Canva ${orientation === "portrait" ? "Videos" : "Videos or Photos"}.`,
    "If results are weak, try the Video search terms first.",
    "Use Shot angles and variations to broaden the result pool.",
    "Add Style and mood helpers when you need a more polished aesthetic.",
    "Keep Canva assets inside Canva unless your plan and license allow otherwise.",
  ];

  return {
    summary: `Best for ${formatHint}. Copy a term, open Canva, and paste it into the Videos or Photos search bar.`,
    actions,
    categories,
    workflow,
  };
}

function bestPexelsFile(files = [], orientation = "any") {
  const mp4 = files.filter((file) => file.file_type === "video/mp4");
  const list = mp4.length ? mp4 : files;
  if (!list.length) return null;
  const filtered = list.filter((file) => {
    if (orientation === "portrait") return (file.height || 0) > (file.width || 0);
    if (orientation === "landscape") return (file.width || 0) >= (file.height || 0);
    if (orientation === "square") return Math.abs((file.width || 0) - (file.height || 0)) < 250;
    return true;
  });
  const candidates = filtered.length ? filtered : list;
  return candidates.sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0];
}


function normalizeResultKey(item) {
  return String(item?.sourcePage || item?.directUrl || item?.thumbnail || item?.title || "")
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}
function uniqueResults(results = [], limit = 3) {
  const seen = new Set();
  const output = [];
  for (const item of results) {
    const key = normalizeResultKey(item);
    const titleKey = String(item?.title || "").toLowerCase().trim();
    const thumbKey = String(item?.thumbnail || "").replace(/[?#].*$/, "");
    const combined = key || titleKey || thumbKey;
    if (!combined || seen.has(combined) || seen.has(titleKey) || seen.has(thumbKey)) continue;
    seen.add(combined);
    if (titleKey) seen.add(titleKey);
    if (thumbKey) seen.add(thumbKey);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}
function withUniqueResults(sourceBlock, limit = 3) {
  return { ...sourceBlock, results: uniqueResults(sourceBlock?.results || [], limit) };
}
function directFileFromArchive(identifier, files = []) {
  const preferred = files.find((file) => /\.(mp4|mov|m4v|webm)$/i.test(file.name || ""));
  if (!preferred) return "";
  return `https://archive.org/download/${identifier}/${encodeURIComponent(preferred.name)}`;
}
function commonsImageUrl(title, width = 420) {
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(String(title || "").replace(/^File:/i, ""))}?width=${width}`;
}
function commonsFilePage(title) {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(title || "").replaceAll(" ", "_"))}`;
}

async function searchPexels({ query, orientation, perPage }) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return { source: "Pexels", error: "Missing PEXELS_API_KEY in .env", results: [] };
  const params = new URLSearchParams({ query, per_page: String(perPage), page: "1" });
  if (orientation && orientation !== "any") params.set("orientation", orientation);
  try {
    const response = await fetch(`https://api.pexels.com/v1/videos/search?${params}`, { headers: { Authorization: key } });
    if (!response.ok) return { source: "Pexels", error: `Pexels error ${response.status}`, results: [] };
    const data = await response.json();
    const results = (data.videos || []).map((video) => {
      const file = bestPexelsFile(video.video_files || [], orientation);
      return {
        id: `pexels-${video.id}`,
        source: "Pexels",
        policy: POLICIES.FREE_DOWNLOAD,
        title: `Pexels video ${video.id}`,
        creator: video.user?.name || "Unknown creator",
        sourcePage: video.url,
        duration: video.duration,
        width: file?.width || video.width,
        height: file?.height || video.height,
        thumbnail: video.image,
        directUrl: file?.link || "",
        actionLabel: "Open video file",
        attribution: video.user?.name ? `Video by ${video.user.name} on Pexels` : "Video from Pexels",
      };
    });
    return { source: "Pexels", error: null, results };
  } catch (error) {
    return { source: "Pexels", error: error.message, results: [] };
  }
}

async function searchPixabay({ query, orientation, perPage }) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return { source: "Pixabay", error: "PIXABAY_API_KEY is blank. Add it later to enable Pixabay API results.", results: [] };
  const params = new URLSearchParams({ key, q: query, video_type: "all", per_page: String(perPage), safesearch: "true" });
  try {
    const response = await fetch(`https://pixabay.com/api/videos/?${params}`);
    if (!response.ok) return { source: "Pixabay", error: `Pixabay error ${response.status}`, results: [] };
    const data = await response.json();
    const results = (data.hits || []).map((hit) => {
      const video = hit.videos?.large || hit.videos?.medium || hit.videos?.small || hit.videos?.tiny;
      return {
        id: `pixabay-${hit.id}`,
        source: "Pixabay",
        policy: POLICIES.FREE_DOWNLOAD,
        title: hit.tags || `Pixabay video ${hit.id}`,
        creator: hit.user || "Unknown creator",
        sourcePage: hit.pageURL,
        duration: hit.duration,
        width: video?.width || 0,
        height: video?.height || 0,
        thumbnail: video?.thumbnail || (hit.picture_id ? `https://i.vimeocdn.com/video/${hit.picture_id}_640x360.jpg` : ""),
        directUrl: video?.url || "",
        actionLabel: "Open video file",
        attribution: hit.user ? `Video by ${hit.user} on Pixabay` : "Video from Pixabay",
      };
    }).filter((item) => {
      if (!item.directUrl) return false;
      if (orientation === "portrait") return item.height > item.width;
      if (orientation === "landscape") return item.width >= item.height;
      if (orientation === "square") return Math.abs(item.width - item.height) < 250;
      return true;
    }).slice(0, perPage);
    return { source: "Pixabay", error: null, results };
  } catch (error) {
    return { source: "Pixabay", error: error.message, results: [] };
  }
}


async function searchUnsplash({ query, orientation, perPage }) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return { source: "Unsplash Photos", error: "UNSPLASH_ACCESS_KEY is blank. Add it later to enable Unsplash photo API results.", results: [] };

  const params = new URLSearchParams({ query, per_page: String(Math.min(perPage, 10)), page: "1", content_filter: "high" });
  if (orientation === "landscape") params.set("orientation", "landscape");
  if (orientation === "portrait") params.set("orientation", "portrait");
  if (orientation === "square") params.set("orientation", "squarish");

  try {
    const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${key}` },
    });
    if (!response.ok) return { source: "Unsplash Photos", error: `Unsplash error ${response.status}`, results: [] };

    const data = await response.json();
    const results = (data.results || []).map((photo) => ({
      id: `unsplash-${photo.id}`,
      source: "Unsplash Photos",
      policy: POLICIES.UNSPLASH,
      title: photo.alt_description || photo.description || `Unsplash photo ${photo.id}`,
      creator: photo.user?.name || "Unknown creator",
      sourcePage: `${photo.links?.html || "https://unsplash.com/"}?utm_source=elias_media&utm_medium=referral`,
      duration: "Photo",
      width: photo.width || 0,
      height: photo.height || 0,
      thumbnail: photo.urls?.small || photo.urls?.thumb || "",
      directUrl: photo.urls?.full || photo.urls?.regular || "",
      downloadLocation: photo.links?.download_location || "",
      actionLabel: "Open photo",
      attribution: photo.user?.name ? `Photo by ${photo.user.name} on Unsplash` : "Photo from Unsplash",
    }));

    return { source: "Unsplash Photos", error: null, results };
  } catch (error) {
    return { source: "Unsplash Photos", error: error.message, results: [] };
  }
}


async function searchOpenverse({ query, perPage }) {
  try {
    const params = new URLSearchParams({ q: query, page_size: String(Math.min(perPage, 6)), mature: "false" });
    const response = await fetch(`https://api.openverse.engineering/v1/images/?${params}`, { headers: { "User-Agent": "EliasMedia/1.0" } });
    if (!response.ok) return { source: "Openverse Images", error: `Openverse error ${response.status}`, results: [] };
    const data = await response.json();
    const results = (data.results || []).map((item) => ({
      id: `openverse-${item.id}`,
      source: "Openverse Images",
      policy: POLICIES.OPENVERSE,
      title: item.title || "Openverse image",
      creator: item.creator || item.provider || "Unknown creator",
      sourcePage: item.foreign_landing_url || item.url || "https://openverse.org/",
      duration: "Photo",
      width: item.width || 0,
      height: item.height || 0,
      thumbnail: item.thumbnail || item.url || "",
      directUrl: item.url || "",
      actionLabel: "Open image",
      attribution: item.attribution || `${item.title || "Image"} by ${item.creator || "Unknown"} via Openverse`,
    }));
    return { source: "Openverse Images", error: null, results: uniqueResults(results, perPage) };
  } catch (error) {
    return { source: "Openverse Images", error: error.message, results: [] };
  }
}
async function searchNasaLibrary({ query, perPage }) {
  try {
    const params = new URLSearchParams({ q: query, media_type: "image,video" });
    const response = await fetch(`https://images-api.nasa.gov/search?${params}`);
    if (!response.ok) return { source: "NASA Library", error: `NASA error ${response.status}`, results: [] };
    const data = await response.json();
    const items = data.collection?.items || [];
    const results = items.map((item, index) => {
      const meta = item.data?.[0] || {};
      const link = (item.links || []).find((l) => l.href)?.href || "";
      return {
        id: `nasa-${meta.nasa_id || index}`,
        source: "NASA Library",
        policy: POLICIES.NASA,
        title: meta.title || "NASA media",
        creator: meta.center || "NASA",
        sourcePage: item.href || "https://images.nasa.gov/",
        duration: meta.media_type === "video" ? "Video" : "Photo",
        width: 0,
        height: 0,
        thumbnail: link,
        directUrl: link,
        actionLabel: "Open media",
        attribution: `NASA: ${meta.title || "media"}`,
      };
    });
    return { source: "NASA Library", error: null, results: uniqueResults(results, perPage) };
  } catch (error) {
    return { source: "NASA Library", error: error.message, results: [] };
  }
}
async function searchWikimedia({ query, perPage }) {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: `${query} filetype:bitmap|drawing|video`,
      gsrnamespace: "6",
      gsrlimit: String(Math.min(perPage, 8)),
      prop: "imageinfo",
      iiprop: "url|mime|size|extmetadata",
      iiurlwidth: "420",
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!response.ok) return { source: "Wikimedia Commons", error: `Commons error ${response.status}`, results: [] };
    const data = await response.json();
    const pages = Object.values(data.query?.pages || {});
    const results = pages.map((page) => {
      const info = page.imageinfo?.[0] || {};
      const meta = info.extmetadata || {};
      return {
        id: `commons-${page.pageid}`,
        source: "Wikimedia Commons",
        policy: POLICIES.COMMONS,
        title: page.title || "Commons media",
        creator: meta.Artist?.value?.replace(/<[^>]+>/g, "") || "Wikimedia Commons",
        sourcePage: commonsFilePage(page.title),
        duration: (info.mime || "").includes("video") ? "Video" : "Photo",
        width: info.width || 0,
        height: info.height || 0,
        thumbnail: info.thumburl || commonsImageUrl(page.title),
        directUrl: info.url || "",
        actionLabel: "Open file",
        attribution: meta.Credit?.value?.replace(/<[^>]+>/g, "") || `Wikimedia Commons: ${page.title}`,
      };
    });
    return { source: "Wikimedia Commons", error: null, results: uniqueResults(results, perPage) };
  } catch (error) {
    return { source: "Wikimedia Commons", error: error.message, results: [] };
  }
}
async function searchInternetArchive({ query, perPage }) {
  try {
    const q = `(${query}) AND mediatype:(movies OR image)`;
    const params = new URLSearchParams({ q, fl: "identifier,title,creator,mediatype", rows: String(Math.min(perPage, 6)), page: "1", output: "json" });
    const response = await fetch(`https://archive.org/advancedsearch.php?${params}`);
    if (!response.ok) return { source: "Internet Archive", error: `Archive error ${response.status}`, results: [] };
    const data = await response.json();
    const docs = data.response?.docs || [];
    const results = await Promise.all(docs.map(async (doc) => {
      let directUrl = "";
      try {
        const meta = await fetch(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`).then((r) => r.json());
        directUrl = directFileFromArchive(doc.identifier, meta.files || []);
      } catch (_) {}
      return {
        id: `archive-${doc.identifier}`,
        source: "Internet Archive",
        policy: POLICIES.ARCHIVE,
        title: doc.title || doc.identifier,
        creator: Array.isArray(doc.creator) ? doc.creator.join(", ") : (doc.creator || "Internet Archive"),
        sourcePage: `https://archive.org/details/${doc.identifier}`,
        duration: doc.mediatype === "movies" ? "Video" : "Archive item",
        width: 0,
        height: 0,
        thumbnail: `https://archive.org/services/img/${doc.identifier}`,
        directUrl,
        actionLabel: "Open archive file",
        attribution: `Internet Archive: ${doc.title || doc.identifier}`,
      };
    }));
    return { source: "Internet Archive", error: null, results: uniqueResults(results, perPage) };
  } catch (error) {
    return { source: "Internet Archive", error: error.message, results: [] };
  }
}
async function searchFlickr({ query, perPage }) {
  const key = process.env.FLICKR_API_KEY;
  if (!key) return { source: "Flickr", error: "FLICKR_API_KEY is blank. Add it later to enable Flickr photo results.", results: [] };
  try {
    const params = new URLSearchParams({ method: "flickr.photos.search", api_key: key, text: query, per_page: String(Math.min(perPage, 6)), page: "1", format: "json", nojsoncallback: "1", safe_search: "1", content_type: "7", extras: "url_m,url_l,url_o,owner_name,license" });
    const response = await fetch(`https://www.flickr.com/services/rest/?${params}`);
    if (!response.ok) return { source: "Flickr", error: `Flickr error ${response.status}`, results: [] };
    const data = await response.json();
    const results = (data.photos?.photo || []).map((photo) => ({
      id: `flickr-${photo.id}`,
      source: "Flickr",
      policy: POLICIES.FLICKR,
      title: photo.title || "Flickr photo",
      creator: photo.ownername || photo.owner || "Flickr user",
      sourcePage: `https://www.flickr.com/photos/${photo.owner}/${photo.id}`,
      duration: "Photo",
      width: 0,
      height: 0,
      thumbnail: photo.url_m || photo.url_l || photo.url_o || "",
      directUrl: photo.url_o || photo.url_l || photo.url_m || "",
      actionLabel: "Open photo",
      attribution: `Flickr: ${photo.title || photo.id} by ${photo.ownername || photo.owner || "unknown"}`,
    }));
    return { source: "Flickr", error: null, results: uniqueResults(results, perPage) };
  } catch (error) {
    return { source: "Flickr", error: error.message, results: [] };
  }
}
async function searchGiphy({ query, perPage }) {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return { source: "GIPHY", error: "GIPHY_API_KEY is blank. Add it later to enable GIF results.", results: [] };
  try {
    const params = new URLSearchParams({ api_key: key, q: query, limit: String(Math.min(perPage, 6)), rating: "g", lang: "en" });
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
    if (!response.ok) return { source: "GIPHY", error: `GIPHY error ${response.status}`, results: [] };
    const data = await response.json();
    const results = (data.data || []).map((gif) => ({
      id: `giphy-${gif.id}`,
      source: "GIPHY",
      policy: POLICIES.GIPHY,
      title: gif.title || "GIPHY media",
      creator: gif.username || "GIPHY",
      sourcePage: gif.url || "https://giphy.com/",
      duration: "GIF",
      width: gif.images?.original?.width || 0,
      height: gif.images?.original?.height || 0,
      thumbnail: gif.images?.fixed_width_small?.url || gif.images?.preview_gif?.url || "",
      directUrl: gif.images?.original?.mp4 || gif.images?.original?.url || "",
      actionLabel: "Open GIF",
      attribution: `GIPHY: ${gif.title || gif.id}`,
    }));
    return { source: "GIPHY", error: null, results: uniqueResults(results, perPage) };
  } catch (error) {
    return { source: "GIPHY", error: error.message, results: [] };
  }
}

async function searchYouTube({ query, perPage }) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { source: "YouTube", error: "YOUTUBE_API_KEY is blank. Add it later to enable YouTube metadata results.", results: [] };
  const params = new URLSearchParams({ key, part: "snippet", q: query, type: "video", maxResults: String(Math.min(perPage, 10)), safeSearch: "moderate" });
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!response.ok) return { source: "YouTube", error: `YouTube error ${response.status}`, results: [] };
    const data = await response.json();
    const results = (data.items || []).map((item) => ({
      id: `youtube-${item.id?.videoId}`,
      source: "YouTube",
      policy: POLICIES.REFERENCE,
      title: item.snippet?.title || "YouTube video",
      creator: item.snippet?.channelTitle || "Unknown channel",
      sourcePage: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      duration: "N/A",
      width: 0,
      height: 0,
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || "",
      directUrl: "",
      actionLabel: "Open reference",
      attribution: "Reference only. Do not reuse unless you have rights.",
    }));
    return { source: "YouTube", error: null, results };
  } catch (error) {
    return { source: "YouTube", error: error.message, results: [] };
  }
}

async function searchNasa({ query, perPage }) {
  const params = new URLSearchParams({ q: query, media_type: "video" });
  try {
    const response = await fetch(`https://images-api.nasa.gov/search?${params}`);
    if (!response.ok) return { source: "NASA", error: `NASA error ${response.status}`, results: [] };
    const data = await response.json();
    const items = data.collection?.items || [];
    const results = items.slice(0, perPage).map((item, idx) => {
      const data0 = item.data?.[0] || {};
      const link = item.links?.find((l) => l.render === "image") || item.links?.[0] || {};
      return {
        id: `nasa-${idx}`,
        source: "NASA",
        policy: "NASA usage rules apply",
        title: data0.title || "NASA video",
        creator: data0.center || "NASA",
        sourcePage: item.href || "https://images.nasa.gov/",
        duration: "N/A",
        width: 0,
        height: 0,
        thumbnail: link.href || "",
        directUrl: item.href || "",
        actionLabel: "Open NASA metadata",
        attribution: "NASA media. Check NASA usage guidelines and item metadata before publishing.",
      };
    });
    return { source: "NASA", error: null, results };
  } catch (error) {
    return { source: "NASA", error: error.message, results: [] };
  }
}

async function searchArchive({ query, perPage }) {
  const fields = ["identifier", "title", "creator", "description", "date"].join(",");
  const params = new URLSearchParams({
    q: `${query} AND mediatype:movies`,
    fl: fields,
    rows: String(Math.min(perPage, 20)),
    output: "json",
  });
  try {
    const response = await fetch(`https://archive.org/advancedsearch.php?${params}`);
    if (!response.ok) return { source: "Internet Archive", error: `Archive error ${response.status}`, results: [] };
    const data = await response.json();
    const docs = data.response?.docs || [];
    const results = docs.map((doc) => ({
      id: `archive-${doc.identifier}`,
      source: "Internet Archive",
      policy: POLICIES.ARCHIVE,
      title: doc.title || doc.identifier,
      creator: Array.isArray(doc.creator) ? doc.creator.join(", ") : doc.creator || "Unknown creator",
      sourcePage: `https://archive.org/details/${doc.identifier}`,
      duration: "N/A",
      width: 0,
      height: 0,
      thumbnail: `https://archive.org/services/img/${doc.identifier}`,
      directUrl: `https://archive.org/details/${doc.identifier}`,
      actionLabel: "Open archive page",
      attribution: "Archive item. Check the item license and metadata before publishing.",
    }));
    return { source: "Internet Archive", error: null, results };
  } catch (error) {
    return { source: "Internet Archive", error: error.message, results: [] };
  }
}


function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseTimestampedScript(script) {
  const rawLines = String(script || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = [];
  let current = null;
  const timestampRegex = /^(\[?\(?\d{1,2}:\d{2}(?::\d{2})?(?:\s*[-–—]\s*\d{1,2}:\d{2}(?::\d{2})?)?\]?\)?)[\s:|-]*(.*)$/;

  for (const line of rawLines) {
    const match = line.match(timestampRegex);
    if (match) {
      if (current) rows.push(current);
      current = {
        timestamp: match[1].replace(/[()[\]]/g, ""),
        text: normalizeWhitespace(match[2] || ""),
      };
    } else if (current) {
      current.text = normalizeWhitespace(`${current.text} ${line}`);
    } else {
      current = { timestamp: "No timestamp", text: normalizeWhitespace(line) };
    }
  }

  if (current) rows.push(current);
  return rows.slice(0, 40);
}

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","because","as","to","of","in","on","at","by","for","with","from",
  "this","that","these","those","there","their","they","them","he","she","his","her","we","you","your","our",
  "is","are","was","were","be","been","being","it","its","into","over","under","about","after","before",
  "when","where","why","how","what","who","which","can","could","would","should","will","may","might",
  "not","no","do","does","did","just","very","really","like","one","two","three","first","last","new","old",
  "video","clip","footage","shot","scene","show","shows","use","screen","voice","line","viewer","viewers"
]);

function extractKeywordPhrase(text) {
  const cleaned = normalizeWhitespace(text)
    .replace(/["“”‘’]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .toLowerCase();

  const words = cleaned.split(/\s+/).filter((word) => word.length > 2 && !STOPWORDS.has(word));
  if (!words.length) return normalizeWhitespace(text).slice(0, 80);

  const priorityWords = words.filter((word) => !["said","says","think","look","feel","still","even","also","only"].includes(word));
  const chosen = (priorityWords.length ? priorityWords : words).slice(0, 6);
  return chosen.join(" ");
}

function inferMediaIntent(text) {
  const lower = text.toLowerCase();

  if (/(map|route|location|country|city|airport|island|ocean|border|flight path|radar)/.test(lower)) {
    return { type: "map / graphic", note: "Use a map, route graphic, or animated location card." };
  }
  if (/(car|cars|truck|trucks|pickup|suv|vehicle|vehicles|automotive|auto|motor|engine|recall|dealer|dealership|toyota|ford|chevy|chevrolet|honda|nissan|bmw|mercedes|tesla|tundra|tacoma|silverado|f-150|ram)/.test(lower)) {
    return { type: "automotive b-roll", note: "Use car, truck, dealership, engine, mechanic, road, dashboard, or factory visuals." };
  }
  if (/(cockpit|pilot|aircraft|plane|runway|airport|flight|aviation|airline|jet)/.test(lower)) {
    return { type: "aviation b-roll", note: "Use aircraft, cockpit, airport, radar, runway, or aviation system visuals." };
  }
  if (/(document|report|investigation|evidence|headline|newspaper|article|record|file)/.test(lower)) {
    return { type: "document / headline", note: "Use report pages, headlines, document close-ups, or text-on-screen graphics." };
  }
  if (/(people|crowd|walking|street|city|town|home|family|worker|driver)/.test(lower)) {
    return { type: "people / location b-roll", note: "Use realistic location footage with people, streets, homes, or workplaces." };
  }
  if (/(money|business|office|market|economy|company|profit|cost|price|sales)/.test(lower)) {
    return { type: "business b-roll", note: "Use office, charts, money, business meeting, market, or dashboard visuals." };
  }
  if (/(space|nasa|rocket|moon|mars|earth|satellite)/.test(lower)) {
    return { type: "space / NASA archive", note: "Use NASA, rocket launch, satellite, Mars, Earth-from-space, or archive footage." };
  }

  return { type: "general b-roll", note: "Use contextual stock footage, archive visuals, or a clean text card." };
}

function buildTimelineSearchTerms(text, orientation = "any", topic = "") {
  const phrase = extractKeywordPhrase(text);
  const cleanTopic = normalizeWhitespace(topic);
  const visual = inferMediaIntent(`${topic} ${text}`);
  const basePhrase = cleanTopic ? `${cleanTopic} ${phrase}` : phrase;

  let thirdTerm = `${basePhrase} cinematic b roll`;

  if (visual.type.includes("automotive")) thirdTerm = `${cleanTopic || phrase} car truck footage`;
  if (visual.type.includes("aviation")) thirdTerm = `${cleanTopic || phrase} aviation footage`;
  if (visual.type.includes("map")) thirdTerm = `${cleanTopic || phrase} map route graphic`;
  if (visual.type.includes("document")) thirdTerm = `${cleanTopic || phrase} document news headline`;
  if (visual.type.includes("business")) thirdTerm = `${cleanTopic || phrase} business office footage`;
  if (visual.type.includes("space")) thirdTerm = `${cleanTopic || phrase} space NASA footage`;

  return [
    basePhrase,
    `${basePhrase} b roll`,
    thirdTerm,
  ].map(normalizeWhitespace).filter(Boolean).slice(0, 3);
}

async function searchTimelineItem(item, orientation, perTimestamp, topic = "", guide = "") {
  const terms = buildTimelineSearchTerms(`${guide} ${item.text}`, orientation, topic);
  const primaryQuery = terms[0] || item.text;
  const [pexels, pixabay, youtube, unsplash, openverse, nasa, commons, archive, flickr, giphy] = await Promise.all([
    searchPexels({ query: primaryQuery, orientation, perPage: perTimestamp }),
    searchPixabay({ query: primaryQuery, orientation, perPage: perTimestamp }),
    searchYouTube({ query: primaryQuery, perPage: perTimestamp }),
    searchUnsplash({ query: primaryQuery, orientation, perPage: perTimestamp }),
    searchOpenverse({ query: primaryQuery, perPage: perTimestamp }),
    searchNasaLibrary({ query: primaryQuery, perPage: perTimestamp }),
    searchWikimedia({ query: primaryQuery, perPage: perTimestamp }),
    searchInternetArchive({ query: primaryQuery, perPage: perTimestamp }),
    searchFlickr({ query: primaryQuery, perPage: perTimestamp }),
    searchGiphy({ query: primaryQuery, perPage: perTimestamp }),
  ]);

  const visual = inferMediaIntent(`${topic} ${guide} ${item.text}`);
  return {
    timestamp: item.timestamp,
    scriptLine: item.text,
    visualType: visual.type,
    visualNote: visual.note,
    searchTerms: terms,
    canvaTerms: createCanvaToolkit(primaryQuery, orientation).categories.slice(0, 1).map((group) => ({ ...group, terms: group.terms.slice(0, 3) })),
    results: {
      pexels: withUniqueResults(pexels, perTimestamp),
      pixabay: withUniqueResults(pixabay, perTimestamp),
      youtube: withUniqueResults(youtube, perTimestamp),
      unsplash: withUniqueResults(unsplash, perTimestamp),
      openverse: withUniqueResults(openverse, perTimestamp),
      nasa: withUniqueResults(nasa, perTimestamp),
      commons: withUniqueResults(commons, perTimestamp),
      archive: withUniqueResults(archive, perTimestamp),
      flickr: withUniqueResults(flickr, perTimestamp),
      giphy: withUniqueResults(giphy, perTimestamp),
    },
  };
}

app.post("/api/timeline-search", async (req, res) => {
  const script = String(req.body?.script || "").trim();
  const orientation = String(req.body?.orientation || "any");
  const perTimestamp = Math.max(1, Math.min(Number(req.body?.perTimestamp || 3), 5));
  const topic = String(req.body?.topic || "").trim();
  const guide = String(req.body?.guide || "").trim();

  if (!script) return res.status(400).json({ error: "Paste a timestamped script first." });

  const items = parseTimestampedScript(script);
  if (!items.length) return res.status(400).json({ error: "No timestamped lines found." });

  try {
    const timeline = [];
    for (const item of items) {
      timeline.push(await searchTimelineItem(item, orientation, perTimestamp, topic, guide));
    }
    res.json({ count: timeline.length, orientation, timeline });
  } catch (error) {
    res.status(500).json({ error: error.message || "Timeline search failed." });
  }
});


app.get("/api/search", async (req, res) => {
  const query = String(req.query.q || "").trim();
  const orientation = String(req.query.orientation || "any");
  const perPage = Math.max(1, Math.min(Number(req.query.per_page || 8), 20));
  if (!query) return res.status(400).json({ error: "Missing search query." });

  const [pexels, pixabay, youtube, unsplash] = await Promise.all([
    searchPexels({ query, orientation, perPage }),
    searchPixabay({ query, orientation, perPage }),
    searchYouTube({ query, perPage }),
    searchUnsplash({ query, orientation, perPage }),
  ]);

  res.json({
    query,
    orientation,
    sourceLinks: createSourceLinks(query),
    canvaSuggestions: createCanvaSearchSuggestions(query),
    canvaToolkit: createCanvaToolkit(query, orientation),
    apiResults: { pexels, pixabay, youtube, unsplash },
  });
});

app.listen(PORT, () => {
  console.log(`Elias Media running on http://localhost:${PORT}`);
});
