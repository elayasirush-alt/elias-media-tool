# Elias Media Render Dashboard

This is the Render + GitHub website version.

## What it does

- Paste timestamped scripts.
- No timestamp processing limit in the planning/suggestions tool.
- Search all selected sources.
- Max 20 media results per site.
- Avoid repeated links/results.
- Media search tab.
- Timestamp media suggestions.
- Two Canva search terms for every timestamp.
- Sound effect cue for every timestamp.
- Text callout suggestion for every timestamp.
- Download suggestion report.
- Lightweight automatic video maker for Render-safe MP4 drafts.

## Sources

Direct API sources:
- Pexels
- Pixabay
- Unsplash
- YouTube reference
- Openverse
- NASA
- Wikimedia
- Internet Archive
- Flickr
- GIPHY

Canva:
- Canva is included as a search-term/source-link workflow.
- Each timestamp gets 2 Canva search terms.
- Canva direct stock downloading is not included because Canva requires authorized account/design export workflows.

## Render environment variables

Add these in Render → Environment:

PEXELS_API_KEY=
PIXABAY_API_KEY=
UNSPLASH_ACCESS_KEY=
YOUTUBE_API_KEY=
FLICKR_API_KEY=
GIPHY_API_KEY=

Optional:
MAX_VIDEO_SECONDS=240
MAX_VIDEO_SCENES=45
MAX_SOURCE_RESULTS_PER_SITE=20

## GitHub upload

Upload:
- public
- server.js
- package.json
- README.md
- .env.example

Render:
- Build command: npm install
- Start command: npm start

## Important video note

The automatic video maker is Render-safe/lightweight. For very long 10–15 minute videos, use a paid worker/background-worker architecture later.


## Detailed sound effects and background music

This version adds:
- A sound-effect category for every timestamp.
- SFX timing guidance.
- SFX volume guidance.
- Two SFX search terms per timestamp.
- A music cue/mood per timestamp.
- A full background music plan for the whole script.
- Background music search terms.
- Music volume and structure instructions.
- These details also appear in the downloadable suggestion report.

Recommended mix:
- Voiceover: 100%
- Background music: 8–15%
- SFX: 8–18% depending on impact
- Use no-vocal instrumental music only.


## Background music source cards and SFX source cards

This version removes the correct-info notes from the user interface and report.

Background music is now added like media:
- The tool gives background music source cards.
- It gives music search links.
- It gives music mood and volume use.
- It includes music source links in the report.

Sound effects are also added like media:
- Each timestamp gets SFX source cards.
- Each timestamp gets SFX search links.
- Each timestamp gets timing and volume guidance.
- SFX source links are included in the report.
