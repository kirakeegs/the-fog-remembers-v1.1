# Story Comic Assets

Movie-comic mode checks this folder first for per-scene illustrations.

Use the `assetSlug` from `game/storyScenes.ts`:

```text
public/assets/story/comic-scene-01-title-prologue.png
public/assets/story/comic-scene-04-abandoned-apartment-radio.png
public/assets/story/comic-ending-redemption.png
```

If a file is missing, `components/CinematicStoryMode.tsx` falls back to the existing chapter art in `public/assets/scenes`, `public/assets/characters`, or `public/assets/monsters`.

Generate the first key batch:

```bash
npm run generate:story-images
```

Generate selected scenes:

```bash
npm run generate:story-images -- --ids scene-01-title-prologue,ending-redemption
```

Set `IMAGE_GEN_API_KEY`, `IMAGE_GEN_BASE_URL`, and `IMAGE_GEN_MODEL=gpt-image-2` in `.env.local`. Optional fallback variables are `IMAGE_GEN_FALLBACK_API_KEY`, `IMAGE_GEN_FALLBACK_BASE_URL`, and `IMAGE_GEN_FALLBACK_MODEL`. Do not commit real keys.
