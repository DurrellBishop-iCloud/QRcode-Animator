# QRcode-Animator - Stop Motion Animation Studio

## What This Is

A browser-based stop-motion animation app. You point a top-down camera at a scene, trigger frame captures via QR codes or barcodes (hands-free), and it stitches the frames into an animation you can play back and export as MP4.

**Live URL:** https://dbgh.uk/QRcode-Animator/
**Repo:** https://github.com/DurrellBishop-iCloud/QRcode-Animator
**Created:** January 2026
**Latest version:** v54 (as of Jan 19, 2026)

## Tech Stack

- **Vanilla JavaScript** (no framework) - modular architecture with ES modules
- **HTML5** - single `index.html` entry point
- **CSS** - single `css/styles.css`
- **No build step** - served directly via GitHub Pages with custom domain (dbgh.uk)

### Libraries (in `/lib`)
- `jsqr.min.js` - QR code reading
- `peerjs.min.js` - WebRTC peer-to-peer connections (for viewer/collaboration mode)
- `qrcode-generator.min.js` - QR code generation (for sharing group codes)

## Architecture

```
index.html              # Entry point, all UI markup
css/styles.css          # All styles
js/
  app.js                # Main app initialization
  core/
    EventBus.js         # Pub/sub event system
  managers/
    AudioManager.js     # Sound effects
    BroadcastManager.js # WebRTC broadcasting to viewer devices
    CameraManager.js    # Camera access, zoom, video stream
    FirebaseSignaling.js # Signaling for WebRTC connections
    FrameManager.js     # Captured frames storage and management
    PlaybackManager.js  # Animation playback (FPS, bounce, reverse)
    RecognitionManager.js # Coordinates QR/barcode/color recognition
    SettingsManager.js  # User preferences and settings state
  recognition/
    RecognitionTechnique.js # Base class for recognizers
    QRCodeRecognizer.js     # QR code detection (jsQR)
    BarcodeRecognizer.js    # Barcode detection (QuaggaJS fallback for iOS)
    ColorSampleRecognizer.js # Color-based trigger detection
  filters/
    FilterPipeline.js    # Chains filters together
    BrightnessFilter.js
    ContrastFilter.js
    SaturationFilter.js
    InvertFilter.js
    KaleidoscopeFilter.js
    TransparencyFilter.js
  export/
    MovieExporter.js    # Renders frames to MP4 video
    ServerUploader.js   # Upload functionality
  ui/
    UIController.js     # DOM manipulation and UI state
    SettingsPanel.js    # Settings modal controls
```

## Key Features

- **QR code / barcode triggered capture** - scan a code to snap a frame (hands-free)
- **Single-char barcode shortcuts** (v54) - p=play, c=capture, s=save, etc.
- **Onion skin** - ghost of previous frame overlaid for alignment
- **Camera controls** - zoom (1-3x), brightness, contrast, saturation
- **Filter pipeline** - brightness, contrast, saturation, invert, kaleidoscope, transparency
- **Playback** - configurable FPS (6-24), bounce mode, reverse-first
- **Viewer/collaboration mode** - one device captures, others display via PeerJS WebRTC
- **Group sessions** - share a QR code to join a group
- **MP4 export** - iOS compatible (not WebM)
- **Mobile optimized** - portrait locked, no-zoom, touch-friendly

## Known Issues / Lessons Learned

See `LESSONS_LEARNED.md` for detailed history. Key gotchas:
- iOS requires MP4 format (not WebM) for videos to appear in Photos app
- Web Share API needs user gesture, not programmatic trigger
- Base64 extraction breaks when codec strings contain commas
- `innerHTML` resets destroy event listeners on dynamic buttons
- WebRTC connections need cleanup between uses
- Always push to git when testing on deployed server (GitHub Pages)

## Recent Development History

**Jan 19, 2026 (latest):**
- v54: Single-character barcode shortcuts
- v53: QuaggaJS fallback barcode reader for iOS
- v52-50: Barcode debug tooling
- v49-44: Experimented with Tesseract.js OCR text recognition, then removed in favor of barcodes

**Jan 4, 2026:**
- iOS MP4 export fix
- Bounce playback mode
- Viewer mode redesign
- Clipboard and share improvements
- Debug logging improvements

## Deployment

GitHub Pages with custom domain. Push to `main` branch to deploy:
```bash
git push origin main
```
The site is served at https://dbgh.uk/QRcode-Animator/

## Development

No build tools needed. Just edit files and open `index.html` in a browser, or push to deploy.
To test locally, use a local server (camera API requires HTTPS or localhost):
```bash
python3 -m http.server 8000
# Then open http://localhost:8000
```

## Related Assets

The parent directory (`Top Down Camera/`) contains related design assets:
- SVG icons (Play, Snap, Save, Delete, Undo, Back, Forward, Share, New)
- Laser QR code designs (.ai files)
- Cutlery SVGs (for stop-motion subjects)
