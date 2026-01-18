//
//  ContentView.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import SwiftUI
import Photos

struct ContentView: View {
    @StateObject private var cameraManager = CameraManager()
    @StateObject private var recognitionManager = RecognitionManager()
    @StateObject private var playbackManager = PlaybackManager()
    @StateObject private var imageBroadcaster = ImageBroadcaster()
    @ObservedObject var settings = SettingsManager.shared
    @State private var showSettings = false
    @State private var shouldFlash = false
    @State private var sessionID = UUID().uuidString
    @State private var screenSize: CGSize = .zero

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Onion skin layer (last captured photo as reference)
                if settings.onionSkinEnabled && recognitionManager.currentMode == "Make" && cameraManager.isViewingLiveFeed && !cameraManager.capturedPhotos.isEmpty {
                    if let lastPhoto = cameraManager.capturedPhotos.last {
                        ZStack {
                            Color.black
                                .ignoresSafeArea()

                            Image(uiImage: lastPhoto)
                                .resizable()
                                .aspectRatio(9/16, contentMode: .fit)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                                .ignoresSafeArea()
                                .scaleEffect(x: -1, y: 1)
                                .offset(x: settings.onionSkinOffsetX, y: settings.onionSkinOffsetY)
                        }
                    }
                }

                // Camera preview ALWAYS present (never remove from hierarchy)
                if let previewLayer = cameraManager.previewLayer {
                    CameraPreview(previewLayer: previewLayer)
                        .id("camera-preview-stable")
                        .ignoresSafeArea()
                        .opacity(settings.kaleidoscopeEnabled ? 0 : (settings.onionSkinEnabled && recognitionManager.currentMode == "Make" && cameraManager.isViewingLiveFeed ? settings.onionSkinOpacity : 1))
                        .onTapGesture(count: 2) {
                            showSettings = true
                        }
                }

            // Kaleidoscope filtered preview overlay (when kaleidoscope is enabled and viewing live feed)
            if settings.kaleidoscopeEnabled && recognitionManager.currentMode == "Make" && cameraManager.isViewingLiveFeed {
                if let filteredImage = cameraManager.filteredPreviewImage {
                    ZStack {
                        Color.black
                            .ignoresSafeArea()

                        Image(uiImage: filteredImage)
                            .resizable()
                            .aspectRatio(9/16, contentMode: .fit)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .scaleEffect(x: -1, y: 1)
                    }
                    .onTapGesture(count: 2) {
                        showSettings = true
                    }
                }
            }

            // Static frame overlay (when viewing old frames in Make mode)
            if recognitionManager.currentMode == "Make" && !cameraManager.isViewingLiveFeed {
                Color.black
                    .ignoresSafeArea()

                if cameraManager.currentFrameIndex < cameraManager.capturedPhotos.count {
                    let img = cameraManager.capturedPhotos[cameraManager.currentFrameIndex]
                    Image(uiImage: img)
                        .resizable()
                        .aspectRatio(9/16, contentMode: .fit)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .ignoresSafeArea()
                        .scaleEffect(x: -1, y: 1)
                }
            }

            // Playback overlay for Play mode (must be BEFORE black frame overlay)
            if recognitionManager.currentMode == "Play" {
                Color.black
                    .ignoresSafeArea()

                if let currentFrame = playbackManager.currentFrame {
                    Image(uiImage: currentFrame)
                        .resizable()
                        .aspectRatio(9/16, contentMode: .fit)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .offset(y: -5)  // Shift up 5px to align with live feed
                        .ignoresSafeArea()
                        .scaleEffect(x: -1, y: 1)
                }
            }

            // Black frame overlay (hidden when settings open)
            if !showSettings {
                VStack(spacing: 0) {
                    Rectangle()
                        .fill(Color.black)
                        .frame(height: settings.frameTopThickness)

                    Spacer()

                    Rectangle()
                        .fill(Color.black)
                        .frame(height: settings.frameBottomThickness)
                }
                .ignoresSafeArea()
                .allowsHitTesting(false)
            }

            // Flash overlay for Make mode
            if shouldFlash && recognitionManager.currentMode == "Make" {
                Color.white
                    .ignoresSafeArea()
                    .opacity(0.8)
            }

            // UI overlay (always present)
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center) {
                    Text(recognitionManager.currentMode)
                        .font(.custom("Helvetica", size: 20))
                        .foregroundColor(.white)
                        .padding(.leading, 20)

                    Spacer()

                    if recognitionManager.currentMode == "Make" {
                        if cameraManager.isViewingLiveFeed {
                            Text("\(cameraManager.capturedPhotos.count) frames")
                                .font(.custom("Helvetica", size: 16))
                                .foregroundColor(.white)
                                .padding(.trailing, 20)
                        } else {
                            Text("\(cameraManager.currentFrameIndex + 1)/\(cameraManager.capturedPhotos.count)")
                                .font(.custom("Helvetica", size: 16))
                                .foregroundColor(.white)
                                .padding(.trailing, 20)
                        }
                    } else {
                        Text("\(playbackManager.currentFrameIndex + 1)/\(playbackManager.frames.count)")
                            .font(.custom("Helvetica", size: 16))
                            .foregroundColor(.white)
                            .padding(.trailing, 20)
                    }
                }
                .padding(.top, 10)

                Text(recognitionManager.displayText)
                    .font(.custom("Helvetica", size: 40))
                    .foregroundColor(.white)
                    .padding(.top, 20)
                    .frame(maxWidth: .infinity, alignment: .center)

                Spacer()
                    .frame(minHeight: 380)
            }
            .rotationEffect(.degrees(180))
            .onAppear {
                // Use full window size (not safe area) since black frames use .ignoresSafeArea()
                if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                   let window = windowScene.windows.first {
                    screenSize = window.bounds.size
                } else {
                    screenSize = geometry.size
                }
                print("📐 Captured screen size: \(screenSize) (full window)")
                print("🟡 HELLO DEBUG - ContentView loaded")
                print("🟡 Frame top: \(settings.frameTopThickness), bottom: \(settings.frameBottomThickness)")
            }

            // DEBUG: Yellow rect showing the cropped area between black frames
            VStack(spacing: 0) {
                Color.clear
                    .frame(height: settings.frameTopThickness)

                Rectangle()
                    .stroke(Color.yellow, lineWidth: 4)

                Color.clear
                    .frame(height: settings.frameBottomThickness)
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)
            }
        }
        .onAppear {
            cameraManager.startSession()
            setupRecognition()
            saveAnyPreviousSession()
        }
        .onDisappear {
            cameraManager.stopSession()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("SaveToPhotos"))) { _ in
            saveToPhotosAndResetSession()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("ShareToServer"))) { _ in
            shareToServer()
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)) { _ in
            saveToPhotosOnAppClose()
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .onChange(of: recognitionManager.shouldFlash) { newValue in
            if newValue {
                withAnimation(.easeInOut(duration: 0.2)) {
                    shouldFlash = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        shouldFlash = false
                    }
                }
            }
        }
        .onChange(of: recognitionManager.currentMode) { newMode in
            if newMode == "Play" {
                if !cameraManager.capturedPhotos.isEmpty {
                    MovieExporter.saveToDocuments(
                        frames: cameraManager.capturedPhotos,
                        sessionID: sessionID,
                        frameRate: settings.frameRate,
                        cropTop: settings.frameTopThickness,
                        cropBottom: settings.frameBottomThickness,
                        screenSize: screenSize,
                        reverse: settings.reverseMovie
                    ) { _, _ in }
                }

                cameraManager.resetToLastFrame()
                playbackManager.setFrames(cameraManager.capturedPhotos, startIndex: cameraManager.currentFrameIndex)
                playbackManager.startPlayback()
            } else {
                playbackManager.stopPlayback()
                cameraManager.returnToLiveFeed()
            }
        }
    }

    private func setupRecognition() {
        recognitionManager.delegate = cameraManager

        cameraManager.frameProcessor = { pixelBuffer in
            recognitionManager.processFrame(pixelBuffer)
        }
    }

    private func saveToPhotosAndResetSession() {
        guard !cameraManager.capturedPhotos.isEmpty else { return }

        let currentSessionID = sessionID

        MovieExporter.saveToDocuments(
            frames: cameraManager.capturedPhotos,
            sessionID: currentSessionID,
            frameRate: settings.frameRate,
            cropTop: settings.frameTopThickness,
            cropBottom: settings.frameBottomThickness,
            screenSize: screenSize,
            reverse: settings.reverseMovie
        ) { success, error in
            if success {
                // Upload to server
                let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                let videoURL = documentsURL.appendingPathComponent("session_\(currentSessionID).mov")

                if FileManager.default.fileExists(atPath: videoURL.path) {
                    self.imageBroadcaster.sendVideo(fileURL: videoURL)
                }

                // Export to Photos
                MovieExporter.exportDocumentsFileToPhotos(sessionID: currentSessionID) { success, _ in
                    if success {
                        DispatchQueue.main.async {
                            self.sessionID = UUID().uuidString
                            self.cameraManager.capturedPhotos.removeAll()
                            self.cameraManager.currentFrameIndex = 0
                            self.cameraManager.isViewingLiveFeed = true
                        }
                    }
                }
            }
        }
    }

    private func shareToServer() {
        guard !cameraManager.capturedPhotos.isEmpty else { return }

        let shareStartTime = Date()
        print("📤 SHARE: Starting share process with \(cameraManager.capturedPhotos.count) frames")

        let currentSessionID = sessionID
        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let videoURL = documentsURL.appendingPathComponent("session_\(currentSessionID).mov")

        // Always regenerate video to apply current frame overlay settings
        try? FileManager.default.removeItem(at: videoURL)

        let exportStartTime = Date()
        print("📤 SHARE: Starting video export...")

        MovieExporter.saveToDocuments(
            frames: cameraManager.capturedPhotos,
            sessionID: currentSessionID,
            frameRate: settings.frameRate,
            cropTop: settings.frameTopThickness,
            cropBottom: settings.frameBottomThickness,
            screenSize: screenSize,
            reverse: settings.reverseMovie
        ) { success, _ in
            let exportDuration = Date().timeIntervalSince(exportStartTime)
            print("📤 SHARE: Video export completed in \(String(format: "%.2f", exportDuration))s")

            if success {
                let uploadStartTime = Date()
                print("📤 SHARE: Starting upload to server...")
                self.imageBroadcaster.sendVideo(fileURL: videoURL)

                // Note: We can't measure upload completion time here since sendVideo is async
                // But we can see the export time vs total time
                let totalDuration = Date().timeIntervalSince(shareStartTime)
                print("📤 SHARE: Upload initiated. Total time so far: \(String(format: "%.2f", totalDuration))s")
            }
        }
    }

    private func saveToPhotosOnAppClose() {
        // Session saved on next app launch
    }

    private func saveAnyPreviousSession() {
        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]

        do {
            let files = try FileManager.default.contentsOfDirectory(at: documentsURL, includingPropertiesForKeys: nil)
            let sessionFiles = files.filter { $0.pathExtension == "mov" && $0.lastPathComponent.starts(with: "session_") }

            for fileURL in sessionFiles {
                PHPhotoLibrary.requestAuthorization { status in
                    guard status == .authorized else { return }

                    PHPhotoLibrary.shared().performChanges({
                        PHAssetCreationRequest.creationRequestForAssetFromVideo(atFileURL: fileURL)
                    }, completionHandler: { success, _ in
                        if success {
                            try? FileManager.default.removeItem(at: fileURL)
                        }
                    })
                }
            }
        } catch { }
    }

}

extension CameraManager: RecognitionManagerDelegate {
    func didCapturePhoto() {
        capturePhoto()
    }

    func didCaptureLongPhoto() {
        captureLongPhoto()
    }

    func didMoveBack() {
        moveBack()
    }

    func didMoveForward() {
        moveForward()
    }

    func didDeleteFrame() {
        deleteCurrentFrame()
    }

    func didRequestSave() {
        // This will be handled in ContentView
        NotificationCenter.default.post(name: NSNotification.Name("SaveToPhotos"), object: nil)
    }

    func didRequestShare() {
        // This will be handled in ContentView
        NotificationCenter.default.post(name: NSNotification.Name("ShareToServer"), object: nil)
    }

    func didSetBackground() {
        // Set flag to capture next photo as background
        isCapturingBackground = true
        // Trigger photo capture
        capturePhoto()
    }
}
