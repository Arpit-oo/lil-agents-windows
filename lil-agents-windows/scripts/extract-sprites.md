# Adding Character Sprite Sheets

The app expects PNG sprite frames in:
- `assets/sprites/bruce/bruce-001.png` through `bruce-NNN.png`
- `assets/sprites/jazz/jazz-001.png` through `jazz-NNN.png`

## Extracting from HEVC .mov files

Use FFmpeg to extract frames:

```bash
# Extract Bruce frames (30fps from a 10-second video = 300 frames)
ffmpeg -i walk-bruce-01.mov -vf "fps=30" -pix_fmt rgba assets/sprites/bruce/bruce-%03d.png

# Extract Jazz frames
ffmpeg -i walk-jazz-01.mov -vf "fps=30" -pix_fmt rgba assets/sprites/jazz/jazz-%03d.png
```

## After adding sprites

Update the `totalFrames` value in `src/main/characters/character-config.ts`
to match the actual number of PNG files extracted.
