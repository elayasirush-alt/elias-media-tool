# Elias Media Studio: Video Generator + Media Search + Timestamp Suggestions

This version combines the two workflows the user requested:

1. Build a video from uploaded voiceover + timestamped script.
2. Search anything and get media results from different sources.
3. Paste timestamped text and get suggested media types/results for each timestamp.

## Removed

- Canva
- Visible search-term generator
- Full captions/subtitles
- OpenAI/transcription requirement

## Sources supported

- Pexels
- Pixabay
- YouTube reference only
- Unsplash
- Openverse
- NASA Image Library
- Wikimedia Commons
- Internet Archive
- Flickr
- GIPHY

## Environment variables

PEXELS_API_KEY=
PIXABAY_API_KEY=
UNSPLASH_ACCESS_KEY=
YOUTUBE_API_KEY=
FLICKR_API_KEY=
GIPHY_API_KEY=
APP_USERNAME=admin
APP_PASSWORD=

## Notes

- Video rendering uses Pexels/Pixabay video clips because those are easiest to render reliably.
- Search and timestamp suggestions can show results from all supported sources.
- YouTube is reference only and not downloadable.
- Important text callouts are saved in the scene/source report. They are not burned into MP4 because Render's ffmpeg-static build may not include drawtext.


## Render stable long-script fix

This version fixes:
- Empty JSON errors when Render returns an empty/error response.
- Very long scripts with 100+ timestamp lines overwhelming Render.
- The renderer now merges many short timestamp lines into fewer render scenes.

Optional Render environment variables:
MAX_RENDER_SCENES=45
RENDER_TARGET_SCENE_SECONDS=10

For Render Free, keep MAX_RENDER_SCENES around 35-45.


## 500 Scene Mode

This version adds background render jobs and live progress polling so the page does not depend on one long request.

New behavior:
- High detail mode can render every timestamp line up to MAX_RENDER_SCENES.
- Default MAX_RENDER_SCENES is 500.
- The browser polls `/api/job/:id` every few seconds.
- Keep the page open until the render finishes.
- Fast mode is still available for Render Free by merging short lines.

Recommended Render variables:
MAX_RENDER_SCENES=500
RENDER_TARGET_SCENE_SECONDS=10

Important: 500 scenes is heavy. It may take a long time on Render Free, and a stronger server is recommended for daily long-form production.


## Auto Music and Sound Effects

This version adds:
- Auto free cinematic background music generated inside the tool.
- Auto subtle sound effects generated inside the tool.
- Music moods: serious documentary, dark corporate tension, energetic modern, warm emotional.
- Uploaded music option still available.
- Voiceover-first mixing: voice stays primary, music and SFX are mixed low.

Why generated audio instead of Pexels/Pixabay auto-download?
- Pexels API provides photos and videos, not a music/SFX API.
- Pixabay has music and sound effects on its website, but the official API documentation is primarily for images and videos.
- Generated audio is more reliable for automatic rendering and avoids fragile scraping.


## Render Safe Lite

This version is safer for Render Free/small instances:
- Default output is 1280x720 instead of 1920x1080.
- Default render mode merges many timestamp lines into about 35 render scenes.
- Auto SFX is limited to about 25 cues.
- High detail is disabled unless ALLOW_HEAVY_RENDER=true.
- Use MAX_RENDER_SCENES=35 and RENDER_TARGET_SCENE_SECONDS=12 on Render Free.

For true 500 separate rendered scenes, use a paid server or local desktop renderer.


## Download buttons and source visibility

This version restores media download buttons:
- Open
- Media file
- Download

It also adds:
- Results per source control for Search media.
- Media per timestamp control for Timestamp suggestions.
- Timestamps to process control.
- De-duplication per timestamp.
- Every selected source appears. If an API key is missing or a source returns no direct results, the tool shows a source-search fallback link.

Reminder:
- YouTube is reference only, not downloadable.
- Pixabay requires PIXABAY_API_KEY for direct Pixabay API results.
- Flickr and GIPHY require their own API keys.
