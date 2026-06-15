import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const POLICIES = {
  FREE_DOWNLOAD: "Free download",
  LICENSE_CHECK: "License check",
  REFERENCE: "Reference only",
  PAID: "Paid license",
  SUBSCRIPTION: "Subscription",
  CANVA: "Canva manual search",
  ARCHIVE: "Archive rights vary",
  UNSPLASH: "Unsplash photo license",
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
      actionLabel: "Open photo",
      attribution: photo.user?.name ? `Photo by ${photo.user.name} on Unsplash` : "Photo from Unsplash",
    }));

    return { source: "Unsplash Photos", error: null, results };
  } catch (error) {
    return { source: "Unsplash Photos", error: error.message, results: [] };
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

async function searchTimelineItem(item, orientation, perTimestamp, topic = "") {
  const terms = buildTimelineSearchTerms(item.text, orientation, topic);
  const primaryQuery = terms[0] || item.text;
  const [pexels, pixabay, youtube, unsplash] = await Promise.all([
    searchPexels({ query: primaryQuery, orientation, perPage: perTimestamp }),
    searchPixabay({ query: primaryQuery, orientation, perPage: perTimestamp }),
    searchYouTube({ query: primaryQuery, perPage: perTimestamp }),
    searchUnsplash({ query: primaryQuery, orientation, perPage: perTimestamp }),
  ]);

  const visual = inferMediaIntent(`${topic} ${item.text}`);
  return {
    timestamp: item.timestamp,
    scriptLine: item.text,
    visualType: visual.type,
    visualNote: visual.note,
    searchTerms: terms,
    canvaTerms: createCanvaToolkit(primaryQuery, orientation).categories.slice(0, 1).map((group) => ({ ...group, terms: group.terms.slice(0, 3) })),
    results: { pexels, pixabay, youtube, unsplash },
  };
}

app.post("/api/timeline-search", async (req, res) => {
  const script = String(req.body?.script || "").trim();
  const orientation = String(req.body?.orientation || "any");
  const perTimestamp = Math.max(1, Math.min(Number(req.body?.perTimestamp || 3), 5));
  const topic = String(req.body?.topic || "").trim();

  if (!script) return res.status(400).json({ error: "Paste a timestamped script first." });

  const items = parseTimestampedScript(script);
  if (!items.length) return res.status(400).json({ error: "No timestamped lines found." });

  try {
    const timeline = [];
    for (const item of items) {
      timeline.push(await searchTimelineItem(item, orientation, perTimestamp, topic));
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
