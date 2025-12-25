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
    @ObservedObject var settings = SettingsManager.shared
    @State private var showSettings = false
    @State private var shouldFlash = false
    @State private var sessionID = UUID().uuidString

    var body: some View {
        ZStack {
            // Camera preview ALWAYS present (never remove from hierarchy)
            if let previewLayer = cameraManager.previewLayer {
                CameraPreview(previewLayer: previewLayer)
                    .id("camera-preview-stable")  // Stable ID prevents recreation
                    .ignoresSafeArea()
                    .opacity(settings.kaleidoscopeEnabled ? 0 : 1)  // Hide when kaleidoscope active
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
                        .onAppear {
                            print("🖼️ Static frame - image size: \(img.size), aspect: \(img.size.width/img.size.height)")
                        }
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
                        .onAppear {
                            print("🎬 Playback - image size: \(currentFrame.size), aspect: \(currentFrame.size.width/currentFrame.size.height)")
                        }
                }
            }

            // Black frame overlay (always present, on top of camera/playback, behind UI)
            GeometryReader { geometry in
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
                .allowsHitTesting(false)  // Let touches pass through to elements below
            }

            // Flash overlay for Make mode
            if shouldFlash && recognitionManager.currentMode == "Make" {
                Color.white
                    .ignoresSafeArea()
                    .opacity(0.8)
            }

            // UI overlay (always present)
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text(recognitionManager.currentMode)
                        .font(.custom("Helvetica", size: 20))
                        .foregroundColor(.white)
                        .padding(.leading, 20)
                        .padding(.top, 20)

                    Spacer()

                    if recognitionManager.currentMode == "Make" {
                        if cameraManager.isViewingLiveFeed {
                            Text("\(cameraManager.capturedPhotos.count) frames")
                                .font(.custom("Helvetica", size: 16))
                                .foregroundColor(.white)
                                .padding(.trailing, 20)
                                .padding(.top, 20)
                        } else {
                            Text("\(cameraManager.currentFrameIndex + 1)/\(cameraManager.capturedPhotos.count)")
                                .font(.custom("Helvetica", size: 16))
                                .foregroundColor(.white)
                                .padding(.trailing, 20)
                                .padding(.top, 20)
                        }
                    } else {
                        Text("\(playbackManager.currentFrameIndex + 1)/\(playbackManager.frames.count)")
                            .font(.custom("Helvetica", size: 16))
                            .foregroundColor(.white)
                            .padding(.trailing, 20)
                            .padding(.top, 20)
                    }
                }

                Text(recognitionManager.displayText)
                    .font(.custom("Helvetica", size: 40))
                    .foregroundColor(.white)
                    .padding(.top, 20)
                    .frame(maxWidth: .infinity, alignment: .center)

                Spacer()
            }
            .rotationEffect(.degrees(180))
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
                // Save to Documents directory (overwrites previous version)
                if !cameraManager.capturedPhotos.isEmpty {
                    print("📹 Saving \(cameraManager.capturedPhotos.count) frames to Documents (session: \(sessionID))...")
                    MovieExporter.saveToDocuments(
                        frames: cameraManager.capturedPhotos,
                        sessionID: sessionID,
                        frameRate: settings.frameRate,
                        cropTop: settings.frameBottomThickness,
                        cropBottom: settings.frameTopThickness
                    ) { success, error in
                        if success {
                            print("✅ Movie saved to Documents (session: \(sessionID))")
                        } else {
                            print("❌ Movie save failed: \(error?.localizedDescription ?? "Unknown error")")
                        }
                    }
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
        print("💾 Save QR code detected - saving to Photos and starting new session")

        guard !cameraManager.capturedPhotos.isEmpty else {
            print("⚠️ No frames to save")
            return
        }

        // Capture current session ID before async operations
        let currentSessionID = sessionID

        // First, create the movie file in Documents
        print("📹 Creating movie from \(cameraManager.capturedPhotos.count) frames...")
        MovieExporter.saveToDocuments(
            frames: cameraManager.capturedPhotos,
            sessionID: currentSessionID,
            frameRate: settings.frameRate,
            cropTop: settings.frameBottomThickness,
            cropBottom: settings.frameTopThickness
        ) { success, error in
            if success {
                print("✅ Movie created in Documents")
                // Now export to Photos
                MovieExporter.exportDocumentsFileToPhotos(sessionID: currentSessionID) { success, error in
                    if success {
                        print("✅ Session \(currentSessionID) saved to Photos")
                        // Start new session
                        DispatchQueue.main.async {
                            self.sessionID = UUID().uuidString
                            self.cameraManager.capturedPhotos.removeAll()
                            self.cameraManager.currentFrameIndex = 0
                            self.cameraManager.isViewingLiveFeed = true
                            print("🆕 New session started: \(self.sessionID)")
                        }
                    } else {
                        print("❌ Save to Photos failed: \(error?.localizedDescription ?? "Unknown error")")
                    }
                }
            } else {
                print("❌ Movie creation failed: \(error?.localizedDescription ?? "Unknown error")")
            }
        }
    }

    private func saveToPhotosOnAppClose() {
        // Note: This is unreliable for force quits, so we save on next app launch instead
        print("💾 App backgrounded - session will be saved on next launch")
    }

    private func saveAnyPreviousSession() {
        // Find any existing session files in Documents and save them to Photos
        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]

        do {
            let files = try FileManager.default.contentsOfDirectory(at: documentsURL, includingPropertiesForKeys: nil)
            let sessionFiles = files.filter { $0.pathExtension == "mov" && $0.lastPathComponent.starts(with: "session_") }

            for fileURL in sessionFiles {
                // Extract session ID from filename
                let filename = fileURL.deletingPathExtension().lastPathComponent
                if let sessionID = filename.split(separator: "_").last {
                    print("💾 Found previous session file: \(filename)")

                    PHPhotoLibrary.requestAuthorization { status in
                        guard status == .authorized else { return }

                        PHPhotoLibrary.shared().performChanges({
                            PHAssetCreationRequest.creationRequestForAssetFromVideo(atFileURL: fileURL)
                        }, completionHandler: { success, error in
                            if success {
                                try? FileManager.default.removeItem(at: fileURL)
                                print("✅ Previous session \(sessionID) saved to Photos and deleted")
                            } else {
                                print("❌ Failed to save previous session: \(error?.localizedDescription ?? "Unknown")")
                            }
                        })
                    }
                }
            }
        } catch {
            print("⚠️ Error checking for previous sessions: \(error)")
        }
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
}
