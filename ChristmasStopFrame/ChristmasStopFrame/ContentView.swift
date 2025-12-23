//
//  ContentView.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import SwiftUI

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
                    .onTapGesture(count: 2) {
                        showSettings = true
                    }
            }

            // Static frame overlay (when viewing old frames in Make mode)
            if recognitionManager.currentMode == "Make" && !cameraManager.isViewingLiveFeed {
                Color.black
                    .ignoresSafeArea()

                if cameraManager.currentFrameIndex < cameraManager.capturedPhotos.count {
                    Image(uiImage: cameraManager.capturedPhotos[cameraManager.currentFrameIndex])
                        .resizable()
                        .scaledToFit()
                        .ignoresSafeArea()
                        .scaleEffect(x: -1, y: 1)
                }
            }

            // Flash overlay for Make mode
            if shouldFlash && recognitionManager.currentMode == "Make" {
                Color.white
                    .ignoresSafeArea()
                    .opacity(0.8)
            }

            // Playback overlay for Play mode
            if recognitionManager.currentMode == "Play" {
                Color.black
                    .ignoresSafeArea()

                if let currentFrame = playbackManager.currentFrame {
                    Image(uiImage: currentFrame)
                        .resizable()
                        .scaledToFit()
                        .ignoresSafeArea()
                        .scaleEffect(x: -1, y: 1)
                }
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
        }
        .onDisappear {
            cameraManager.stopSession()
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
                    print("📹 Exporting \(cameraManager.capturedPhotos.count) frames to Photos...")
                    MovieExporter.exportToPhotos(frames: cameraManager.capturedPhotos, sessionID: sessionID, frameRate: 12.0) { success, error in
                        if success {
                            print("✅ Movie saved to Photos (session: \(sessionID))")
                        } else {
                            print("❌ Movie export failed: \(error?.localizedDescription ?? "Unknown error")")
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
}

extension CameraManager: RecognitionManagerDelegate {
    func didCapturePhoto() {
        capturePhoto()
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
}
