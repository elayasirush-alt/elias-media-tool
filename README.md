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
