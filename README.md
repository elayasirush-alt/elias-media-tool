# Elias Media Timestamped Script + Audio Video Generator

This version is built for the free, accurate workflow.

## Workflow

1. Upload voiceover MP3/WAV.
2. Paste timestamped script.
3. Click Preview scene plan.
4. Click Build video draft.
5. Download MP4 and source report.

## Timestamp format

Use one sentence per line:

00:00 Toyota thought it had built one of the toughest trucks in America.
00:07 But then owners started reporting serious engine problems.
00:15 The question is, how did this happen?

## What this version removes

- No Canva section.
- No visible search terms.
- No normal captions/subtitles.
- No transcription API required.

## What this version does

- Reads your timestamps.
- Uses each timestamped script line as a scene.
- Uses the next timestamp to calculate scene length.
- Selects stock clips from Pexels and Pixabay.
- Adds important text callouts only when needed.
- Mixes voiceover as main audio.
- Adds optional background music quietly.
- Exports MP4.
- Exports a source report.

## Environment variables

PEXELS_API_KEY=
PIXABAY_API_KEY=
APP_USERNAME=admin
APP_PASSWORD=

## Render note

Rendering video uses CPU. Test with 30 seconds to 1 minute first, then longer videos.
