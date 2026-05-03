# E-ink Image Converter

A browser-based image converter for e-paper / e-ink displays. Drop or paste images, compose multiple layers, dither, and export a BMP that drops straight onto the device.

> **Live tool:** _(coming soon — GitHub Pages link goes here)_

## Fully local · zero data collection

Everything happens **inside your browser tab**.

- 🚫 **Nothing is uploaded.** Images you drop, paste, or pick stay on your machine — they're handled with `URL.createObjectURL` blob URLs and never travel over the network.
- 🚫 **No telemetry, no analytics, no tracking, no cookies.** The tool makes zero outbound requests of any kind. There is no backend.
- 🚫 **No accounts, no sign-up.** Open the file, use it, close the tab. That's the entire lifecycle.
- 💾 **Settings only**, stored in your browser's `localStorage` on your own device, so your dither choice / display preset / etc. survive a reload. **Layers are not persisted.** Clearing your browser data removes them.
- 📜 **Source is open** ([MIT](LICENSE)) — every line that runs is in this repo. You can read it, fork it, audit it, host it yourself.

If you'd rather not trust *any* hosted copy, clone the repo and double-click `index.html` — you don't even need a network connection after that.

## Features

- **Five output modes** for different panels:
  - **1-bit B&W** (TRMNL, plain monochrome e-paper)
  - **4-gray** (Waveshare 4-grayscale mode)
  - **B+W+Red** / **B+W+Yellow** (tri-colour Waveshare panels — encoded as 4-bit indexed BMP)
  - **7-color** (PhotoPainter, 5.65" 7-color, Spectra panels — 24-bit BMP)
- **14 display presets** (TRMNL 800×480, Waveshare 5.65", PhotoPainter, 9.7", 10.3", 13.3" Spectra 6, etc.) plus a portrait-orientation toggle.
- **One-click device profiles** that apply a curated settings stack (TRMNL B&W, Waveshare 7.5" B+W+Red, PhotoPainter 7-color, Waveshare 5.65" 7-color).
- **Multi-layer composition** — drop, paste, or click. Layers are draggable on the canvas, draggable in the list to reorder, scalable, rotatable, and trim-able with a chroma-key background remover (auto / eyedropper).
- **11 dither algorithms** across error-diffusion (Floyd-Steinberg, Atkinson, Jarvis-Judice-Ninke, Stucki, Burkes, Sierra, Sierra Lite), ordered (Bayer 4×4, Bayer 8×8, blue noise via IGN), and plain (none / threshold).
- **Perceptual palette matching** in OkLab (much better skin tones, foliage, skies on colour panels).
- **Gamma-correct error diffusion** for cleaner gradients.
- **Tone controls** — brightness, contrast, saturation (auto-hidden in grayscale modes), invert.
- **Per-layer transform** — scale (1–500%), rotation (free angle or 90° step), centre / fit-canvas.
- **Per-layer background removal** — chroma-key with adjustable tolerance and feather, auto-detect or eyedropper.
- **Layer-level undo / redo** with a 50-step history.
- **Spacebar peek** — hold to compare the un-dithered composite against the dither output.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl/Cmd-V` | Paste image from clipboard |
| `Ctrl/Cmd-Z` | Undo |
| `Ctrl/Cmd-Shift-Z` / `Ctrl-Y` | Redo |
| `R` / `Shift-R` | Rotate selected layer ±90° |
| `Del` / `Backspace` | Delete selected layer |
| `Space` (held) | Peek un-dithered composite |
| `Esc` | Close the preset menu |

## Supported devices

The BMP output is standard, so it should work with anything that ingests BMPs. Targets the tool was specifically tuned for:

- **TRMNL** ([usetrmnl.com](https://usetrmnl.com/) / [Terminus](https://github.com/usetrmnl/terminus)) — 800×480 1-bit.
- **Waveshare PhotoPainter** — 800×480 7-color, 24-bit BMP.
- **Waveshare 5.65" 7-color** (and the 4.01" 7-color) — 24-bit BMP.
- **Waveshare tri-color panels** (7.5" V2 B+W+R, 4.2" V2 B+W+R, 2.13" V3 B+W+Y, …) — 4-bit indexed BMP.
- Most plain monochrome e-paper modules (1.54", 2.13", 2.7", 2.9", 4.2", 5.83", 7.5", 9.7", 10.3", 13.3" Spectra 6) via the size-preset list.

## Run it locally

```sh
git clone https://github.com/<your-username>/eink-image-converter.git
cd eink-image-converter
# macOS / Linux
open index.html
# Windows
start index.html
```

No build step, no `npm install`, no dev server. Works offline once cloned.

## Host your own copy on GitHub Pages

1. Push the repo to your GitHub.
2. **Settings → Pages.**
3. Source: **Deploy from a branch**, branch: **main**, folder: **/** (root).
4. ~30 seconds later it's live at `https://<your-username>.github.io/eink-image-converter/`.

No CI/CD needed — GitHub Pages serves `index.html` directly. Same privacy guarantees apply: a fork on GitHub Pages doesn't add any tracking; what you see in the source is exactly what runs.

## License

[MIT](LICENSE) — do whatever you want, just keep the notice.
