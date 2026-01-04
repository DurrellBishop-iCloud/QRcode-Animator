# Lessons Learned - Claude Code Mistakes

A running log of mistakes made during development that wasted time.

---

## 1. Forgetting to Push to Git

**Date:** 2026-01-04

**What happened:** Made multiple edits to add bounce feature, bumped version numbers several times (v26 → v29), but never pushed to git. User was testing on a deployed server (GitHub Pages or similar) and kept seeing the old version.

**Time wasted:** Multiple refresh cycles, cache clearing, version bumps - all pointless because changes were local only.

**Fix:** Always ask or confirm where the user is testing from. If it's a deployed server, push after making changes.

**Prevention:** When user reports not seeing changes after refresh, immediately check if changes need to be pushed to remote.

---

## 2. WebRTC Connection Reuse Bug

**What happened:** Video sharing worked once, but subsequent videos showed the same content. Spent time adding debug logging to track down the issue.

**Root cause:** Sender wasn't cleaning up old WebRTC connections before creating new ones. The old dataChannel was still active.

**Fix:** Add cleanup code at start of `sendVideo()`:
```javascript
if (this.dataChannel) {
    this.dataChannel.close();
    this.dataChannel = null;
}
if (this.peerConnection) {
    this.peerConnection.close();
    this.peerConnection = null;
}
```

**Prevention:** Always clean up previous connections before establishing new ones.

---

## 3. iOS Save to Photos - Wrong Format

**What happened:** "Save to Photos" option wasn't appearing on iOS share sheet.

**Root cause:** iOS requires MP4 format for videos to be saved to Photos. The app was defaulting to WebM format.

**Fix:** Prioritize MP4 codec detection and use correct file extension:
```javascript
getSupportedMimeType() {
    // Check MP4 first (Safari/iOS)
    const mp4Types = ['video/mp4;codecs=avc1', 'video/mp4'];
    for (const type of mp4Types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    // Fall back to WebM...
}
```

**Prevention:** Research platform-specific requirements before implementing file saving features.

---

## 4. Web Share API Requires User Gesture

**What happened:** Tried to call `navigator.share()` programmatically after export completed. Failed with NotAllowedError.

**Root cause:** Web Share API must be triggered by a user gesture (click/tap), not programmatically.

**Fix:** Added a "Tap to Save" button overlay that appears after export, letting the user trigger the share.

**Prevention:** Read API documentation about security/permission requirements before implementing.

---

## 5. Settings Not Persisting on Clear

**What happened:** User cleared the channel name field and pressed Done, but the old value reappeared.

**Root cause:** Settings were only saved on input `change` events, not when the modal closed.

**Fix:** Added SETTINGS_CLOSED event and save settings when Done is pressed.

**Prevention:** Test the full user flow including clearing/resetting values.

---

## 6. Viewer Mode Toggle Enabled on Startup

**What happened:** The viewer mode toggle showed as checked when the app started, even though viewer mode wasn't actually enabled.

**Root cause:** The `viewerModeEnabled` setting was being persisted to localStorage and restored on load.

**Fix:** Force `viewerModeEnabled = false` after loading settings, and explicitly uncheck the toggle in setup.

**Prevention:** Some settings shouldn't persist between sessions. Identify these early.

---

## 7. Base64 Extraction Bug with Comma in MimeType

**Date:** 2026-01-04

**What happened:** Video sharing appeared to work but "Base64 len: 16" was logged when it should have been ~228000. The chunking logic wasn't working properly.

**Root cause:** The mimetype `video/mp4;codecs=avc1.424028,mp4a.40.2` contains a comma. Code used `base64Data.split(',')[1]` which returned `mp4a.40.2;base64` (16 chars) instead of the actual base64 data.

**Fix:** Find base64 data using the `;base64,` marker instead of splitting on comma:
```javascript
const base64Marker = ';base64,';
const markerIndex = base64Data.indexOf(base64Marker);
const base64Only = markerIndex >= 0
    ? base64Data.substring(markerIndex + base64Marker.length)
    : base64Data.split(',')[1];
```

**Prevention:** Don't assume data URL format. MimeTypes can contain special characters.

---

## 8. Copy Button Destroyed by innerHTML Reset

**Date:** 2026-01-04

**What happened:** Added a Copy button to debug area. Button worked on startup but stopped working after sharing (debug was populated with log messages).

**Root cause:** `broadcastVideo()` used `innerHTML = '...'` to reset the debug area, which destroyed the button element and its event listener.

**Fix:** Extract `setupCopyButton()` method and call it after each innerHTML reset.

**Prevention:** When using innerHTML to reset content, remember to re-attach event listeners to any interactive elements.

---

## 9. Tap Event Clash with Settings

**Date:** 2026-01-04

**What happened:** Tried to add tap-to-copy on debug area, but it kept opening settings instead.

**Root cause:** The ui-overlay has `pointer-events: none`, so clicks pass through to the video element below, which has a click handler to open settings.

**Fix:** Added `pointer-events: auto` to `.display-text` CSS so it captures its own clicks.

**Prevention:** Check CSS pointer-events when adding click handlers to overlay elements.

---

## General Prevention Strategies

1. **Ask about deployment setup early** - Local files? Dev server? GitHub Pages?
2. **Push after significant changes** - Don't wait for user to ask
3. **Test on actual target devices** - iOS has many quirks
4. **Read API docs thoroughly** - Especially security/permission sections
5. **Test edge cases** - Empty values, clearing fields, repeated operations
6. **Clean up resources** - Connections, timers, event listeners
