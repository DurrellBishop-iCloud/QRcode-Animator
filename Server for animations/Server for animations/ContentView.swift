//
//  ContentView.swift
//  Server for animations
//
//  Created by Durrell Bishop on 25/12/2025.
//

import SwiftUI
import AVKit

struct ContentView: View {
    @StateObject private var server = HTTPServer()
    @State private var showInfo = true
    @State private var hideInfoTimer: Timer?
    @State private var player: AVPlayer?
    @State private var videoFiles: [URL] = []
    @State private var selectedVideoURL: URL?
    @State private var columnVisibility: NavigationSplitViewVisibility = .detailOnly

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // Sidebar (left panel)
            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("Video Library")
                        .font(.headline)
                    Spacer()
                }
                .padding()

                Divider()

                // Video list
                if videoFiles.isEmpty {
                    VStack(spacing: 12) {
                        Spacer()
                        Image(systemName: "film.stack")
                            .font(.system(size: 48))
                            .foregroundColor(.gray.opacity(0.5))
                        Text("No videos yet")
                            .font(.headline)
                            .foregroundColor(.gray)
                        Text("Upload from iPhone")
                            .font(.caption)
                            .foregroundColor(.gray)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    List(videoFiles, id: \.self, selection: $selectedVideoURL) { videoURL in
                        VideoLibraryRow(
                            videoURL: videoURL,
                            isSelected: selectedVideoURL == videoURL,
                            onPlay: {
                                playVideo(url: videoURL)
                                selectedVideoURL = videoURL
                            },
                            onDelete: {
                                deleteVideo(url: videoURL)
                            }
                        )
                        .listRowInsets(EdgeInsets(top: 4, leading: 8, bottom: 4, trailing: 8))
                    }
                    .listStyle(.sidebar)
                }

                Divider()

                // Footer
                HStack {
                    Text("\(videoFiles.count) video\(videoFiles.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundColor(.gray)

                    Spacer()

                    Button(action: loadVideoFiles) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.plain)
                    .help("Refresh")
                }
                .padding(8)
            }
            .navigationSplitViewColumnWidth(min: 250, ideal: 300, max: 400)
        } detail: {
            // Main content area
            ZStack {
                // Display received video fullscreen OR white background when waiting
                if let player = player {
                    Color.black
                        .ignoresSafeArea()

                    VideoPlayer(player: player)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .ignoresSafeArea()
                } else {
                    // White background with server address when no video
                    Color.white
                        .ignoresSafeArea()

                    VStack(spacing: 40) {
                        Text("Animation Server")
                            .font(.system(size: 60, weight: .bold))
                            .foregroundColor(.black)

                        Text("Enter this address on your iPhone:")
                            .font(.system(size: 30))
                            .foregroundColor(.black.opacity(0.7))

                        Text(server.serverAddress)
                            .font(.system(size: 80, weight: .bold, design: .monospaced))
                            .foregroundColor(.black)
                            .padding(40)
                            .background(Color.black.opacity(0.1))
                            .cornerRadius(20)

                        if server.connectionCount > 0 {
                            Text("✓ \(server.connectionCount) iPhone(s) connected")
                                .font(.system(size: 25))
                                .foregroundColor(.green)
                        }
                    }
                }

                // Connection info overlay (top-left corner)
                if showInfo {
                    VStack {
                        HStack {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Circle()
                                        .fill(server.isRunning ? Color.green : Color.red)
                                        .frame(width: 12, height: 12)

                                    Text(server.isRunning ? "Server Running" : "Server Stopped")
                                        .font(.headline)
                                }

                                if server.isRunning {
                                    Text("Connect from iPhone:")
                                        .font(.caption)
                                        .opacity(0.7)

                                    Text(server.serverAddress)
                                        .font(.system(.body, design: .monospaced))
                                        .textSelection(.enabled)
                                        .padding(8)
                                        .background(Color.white.opacity(0.1))
                                        .cornerRadius(4)

                                    if server.connectionCount > 0 {
                                        Text("\(server.connectionCount) active connection(s)")
                                            .font(.caption)
                                            .opacity(0.7)
                                    }
                                }

                                Text("Press 'i' to toggle info")
                                    .font(.caption)
                                    .opacity(0.5)
                            }
                            .padding()
                            .background(Color.black.opacity(0.7))
                            .cornerRadius(12)
                            .padding()

                            Spacer()
                        }

                        Spacer()
                    }
                    .transition(.opacity)
                }
            }
        }
        .onAppear {
            server.start()
            loadVideoFiles()

            // Hide info after 10 seconds
            hideInfoTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: false) { _ in
                withAnimation {
                    showInfo = false
                }
            }
        }
        .onDisappear {
            server.stop()
            hideInfoTimer?.invalidate()
        }
        .onTapGesture {
            // Toggle info on tap
            withAnimation {
                showInfo.toggle()
            }

            // Reset hide timer
            hideInfoTimer?.invalidate()
            if showInfo {
                hideInfoTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: false) { _ in
                    withAnimation {
                        showInfo = false
                    }
                }
            }
        }
        .onKeyPress(.init("i")) {
            withAnimation {
                showInfo.toggle()
            }
            return .handled
        }
        .onChange(of: server.receivedVideoURL) { newURL in
            guard let url = newURL else { return }

            print("🎬 New video received: \(url.lastPathComponent)")

            // Play the new video
            playVideo(url: url)
            selectedVideoURL = url

            // Refresh library
            loadVideoFiles()
        }
    }

    private func loadVideoFiles() {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let videosPath = documentsPath.appendingPathComponent("ReceivedVideos", isDirectory: true)

        do {
            let files = try FileManager.default.contentsOfDirectory(at: videosPath, includingPropertiesForKeys: [.creationDateKey], options: [.skipsHiddenFiles])
            videoFiles = files
                .filter { $0.pathExtension == "mov" }
                .sorted { (url1, url2) -> Bool in
                    let date1 = (try? url1.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? Date.distantPast
                    let date2 = (try? url2.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? Date.distantPast
                    return date1 > date2  // Newest first
                }
            print("📚 Loaded \(videoFiles.count) videos from library")
        } catch {
            print("⚠️ Error loading video files: \(error)")
            videoFiles = []
        }
    }

    private func playVideo(url: URL) {
        print("▶️ Playing video: \(url.lastPathComponent)")

        // Create player with video
        let newPlayer = AVPlayer(url: url)

        // Loop video
        NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: newPlayer.currentItem,
            queue: .main
        ) { _ in
            newPlayer.seek(to: .zero)
            newPlayer.play()
        }

        // Set player and start playback
        player = newPlayer
        newPlayer.play()
    }

    private func deleteVideo(url: URL) {
        print("🗑️ Deleting video: \(url.lastPathComponent)")

        do {
            try FileManager.default.removeItem(at: url)

            // If this was the currently playing video, stop playback
            if selectedVideoURL == url {
                player?.pause()
                player = nil
                selectedVideoURL = nil
            }

            // Refresh the list
            loadVideoFiles()

            print("✅ Video deleted")
        } catch {
            print("❌ Error deleting video: \(error)")
        }
    }
}

struct VideoLibraryRow: View {
    let videoURL: URL
    let isSelected: Bool
    let onPlay: () -> Void
    let onDelete: () -> Void

    @State private var showDeleteConfirm = false

    var body: some View {
        HStack(spacing: 12) {
            // Thumbnail placeholder
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.gray.opacity(0.3))
                .frame(width: 60, height: 80)
                .overlay(
                    Image(systemName: "play.circle.fill")
                        .font(.title)
                        .foregroundColor(.white.opacity(0.8))
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(videoURL.deletingPathExtension().lastPathComponent)
                    .font(.body)
                    .lineLimit(1)

                if let creationDate = try? videoURL.resourceValues(forKeys: [.creationDateKey]).creationDate {
                    Text(formatDate(creationDate))
                        .font(.caption)
                        .foregroundColor(.gray)
                }

                if let fileSize = try? videoURL.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                    Text(formatFileSize(fileSize))
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }

            Spacer()

            // Delete button
            Button(action: {
                showDeleteConfirm = true
            }) {
                Image(systemName: "trash")
                    .foregroundColor(.red)
            }
            .buttonStyle(.plain)
            .confirmationDialog("Delete this video?", isPresented: $showDeleteConfirm) {
                Button("Delete", role: .destructive) {
                    onDelete()
                }
                Button("Cancel", role: .cancel) {}
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(isSelected ? Color.accentColor.opacity(0.2) : Color.clear)
        .contentShape(Rectangle())
        .onTapGesture {
            onPlay()
        }
        .contextMenu {
            Button(action: {
                NSWorkspace.shared.activateFileViewerSelecting([videoURL])
            }) {
                Label("Show in Finder", systemImage: "folder")
            }

            Divider()

            Button(role: .destructive, action: {
                showDeleteConfirm = true
            }) {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func formatFileSize(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
}

#Preview {
    ContentView()
}
