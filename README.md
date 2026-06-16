# Elias Media

A cleaner branded media search dashboard for finding stock, archive, social, premium, Canva, and reference media.

## What it does

- Searches direct API sources where keys are available.
- Shows Canva search terms.
- Opens official search pages for social, archive, premium, free stock, and reference platforms.
- Labels sources as free download, reference only, paid license, subscription, Canva manual search, or license check.

## Run locally

```bash
npm install
copy /Y .env.example .env
npm start
```

Then open:

```text
http://localhost:3000
```

## API keys

Add your keys to `.env`:

```bash
PEXELS_API_KEY=your_pexels_key
PIXABAY_API_KEY=
YOUTUBE_API_KEY=your_youtube_key
PORT=3000
```

Keep API keys private. Do not post screenshots that reveal them.


## Canva Stock Helper

This version adds a Canva Stock Helper panel with categorized video terms, photo terms, shot variations, mood/style helpers, copy-all buttons, and quick links to Canva workflows.


## Timestamped Script Mode

Paste a timestamped script such as:

00:00 The city is quiet before sunrise.
00:08 Crowds begin moving through a busy downtown street.
00:16 An old bridge appears as the story shifts to the past.

The tool creates scene-by-scene media searches with only 3 strong search terms, plus Pexels video results, Pixabay video results, YouTube reference results, Unsplash photo results, and copy buttons.


## Main topic / niche

Use the Main topic field to keep results accurate. For example, if your script says "Tundra", add:

Toyota Tundra truck recall automotive

This stops Pixabay or stock sites from treating "tundra" as nature/wildlife.


## Unsplash photo API

Add this to `.env` to enable photo results:

UNSPLASH_ACCESS_KEY=your_unsplash_access_key


## New downloader features

This version adds:
- Password protection using `APP_USERNAME` and `APP_PASSWORD`.
- Official download buttons for Pexels, Pixabay, and Unsplash results.
- Unsplash download tracking via `download_location` when available.
- A `Download media guide CSV` button for timestamped script results.
- An Editing guide / visual instructions box to help keep results on topic.

YouTube is still reference-only. Do not download or reuse YouTube videos unless you own the content or have permission.

Canva is still handled as a helper/search workflow. Full Canva account integration requires Canva Connect API OAuth setup and is a separate integration step.


## Ultimate workflow extras

This version adds source checkboxes, local project history, a simple local admin dashboard, multi-select media downloads, Word/PDF/CSV guide export, thumbnail suggestions, CapCut editing notes, Canva search links per timestamp, and music/sound helper links.


## Complete 10-source version

This version reduces repeated media results and adds up to 10 direct result sources: Pexels, Pixabay, YouTube references, Unsplash, Openverse, NASA Image and Video Library, Wikimedia Commons, Internet Archive, Flickr, and GIPHY. Flickr and GIPHY require optional API keys. YouTube remains reference-only. Always check each source license before publishing.


Fix note: both Start a search and Timestamped script mode now return all 10 source panels.


## Auto Video Builder Settings

This version adds a planning panel for the future auto-video renderer:
- Voiceover upload field
- No full captions by default
- Selective text callouts only for main points/questions/numbers
- Clean invisible transitions
- Photo movement rules
- Low music and light sound effects rules
- Downloadable video build plan CSV

This is the blueprint stage. The next stage is the real FFmpeg video renderer that exports MP4.
