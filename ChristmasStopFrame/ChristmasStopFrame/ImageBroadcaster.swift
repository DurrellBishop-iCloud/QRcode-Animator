//
//  ImageBroadcaster.swift
//  ChristmasStopFrame
//
//  Created by Claude Code on 25/12/2025.
//

import UIKit
import Combine

class ImageBroadcaster: ObservableObject {
    @Published var isConnected = false
    @Published var lastError: String?

    private var serverAddress: String = ""
    private var cancellables = Set<AnyCancellable>()
    private let settings = SettingsManager.shared

    init() {
        observeSettings()
        // Trigger local network permission on init
        triggerLocalNetworkPermission()
    }

    private func triggerLocalNetworkPermission() {
        // Make a test connection to trigger the permission prompt
        guard let url = URL(string: "http://192.168.1.198:8080") else { return }
        var request = URLRequest(url: url)
        request.timeoutInterval = 1.0
        URLSession.shared.dataTask(with: request) { _, _, _ in }.resume()
    }

    private func observeSettings() {
        settings.$serverAddress
            .sink { [weak self] address in
                self?.serverAddress = address
            }
            .store(in: &cancellables)
    }

    func sendVideo(fileURL: URL) {
        guard !serverAddress.isEmpty else {
            print("📡 ImageBroadcaster: No server address set")
            return
        }
        print("📡 ImageBroadcaster: Uploading video to \(serverAddress)")

        // Ensure we have a valid URL
        var urlString = serverAddress
        if !urlString.hasPrefix("http://") && !urlString.hasPrefix("https://") {
            urlString = "http://\(urlString)"
        }

        guard let url = URL(string: "\(urlString)/upload") else {
            DispatchQueue.main.async {
                self.lastError = "Invalid server address"
                self.isConnected = false
            }
            return
        }

        // Read video file data
        guard let videoData = try? Data(contentsOf: fileURL) else {
            DispatchQueue.main.async {
                self.lastError = "Failed to read video file"
            }
            return
        }

        print("📡 ImageBroadcaster: Video file size: \(videoData.count) bytes")

        // Create POST request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("video/quicktime", forHTTPHeaderField: "Content-Type")
        request.httpBody = videoData
        request.timeoutInterval = 30.0  // Longer timeout for video files

        // Send video
        print("📡 ImageBroadcaster: Starting upload task")
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            print("📡 ImageBroadcaster: Upload completed")
            if let error = error {
                print("📡 ImageBroadcaster: Error - \(error.localizedDescription)")
            }
            if let httpResponse = response as? HTTPURLResponse {
                print("📡 ImageBroadcaster: Response status: \(httpResponse.statusCode)")
            }
            if let data = data, let responseString = String(data: data, encoding: .utf8) {
                print("📡 ImageBroadcaster: Response body: \(responseString)")
            }

            DispatchQueue.main.async {
                if let error = error {
                    self?.lastError = error.localizedDescription
                    self?.isConnected = false
                } else if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        self?.isConnected = true
                        self?.lastError = nil
                        print("📡 ImageBroadcaster: Upload successful!")
                    } else {
                        self?.lastError = "Server error: \(httpResponse.statusCode)"
                        self?.isConnected = false
                    }
                }
            }
        }
        task.resume()
        print("📡 ImageBroadcaster: Task resumed")
    }

    func sendImage(_ image: UIImage) {
        guard !serverAddress.isEmpty else {
            print("📡 ImageBroadcaster: No server address set")
            return
        }
        print("📡 ImageBroadcaster: Sending image to \(serverAddress)")

        // Ensure we have a valid URL
        var urlString = serverAddress
        if !urlString.hasPrefix("http://") && !urlString.hasPrefix("https://") {
            urlString = "http://\(urlString)"
        }

        guard let url = URL(string: "\(urlString)/upload") else {
            DispatchQueue.main.async {
                self.lastError = "Invalid server address"
                self.isConnected = false
            }
            return
        }

        // Convert image to JPEG data
        guard let imageData = image.jpegData(compressionQuality: 0.8) else {
            DispatchQueue.main.async {
                self.lastError = "Failed to encode image"
            }
            return
        }

        // Create POST request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        request.httpBody = imageData
        request.timeoutInterval = 10.0  // Increased from 2.0 to allow more time for transfer

        // Send image
        print("📡 ImageBroadcaster: Starting upload task, image size: \(imageData.count) bytes")
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            print("📡 ImageBroadcaster: Upload completed")
            if let error = error {
                print("📡 ImageBroadcaster: Error - \(error.localizedDescription)")
            }
            if let httpResponse = response as? HTTPURLResponse {
                print("📡 ImageBroadcaster: Response status: \(httpResponse.statusCode)")
            }
            if let data = data, let responseString = String(data: data, encoding: .utf8) {
                print("📡 ImageBroadcaster: Response body: \(responseString)")
            }

            DispatchQueue.main.async {
                if let error = error {
                    self?.lastError = error.localizedDescription
                    self?.isConnected = false
                } else if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        self?.isConnected = true
                        self?.lastError = nil
                        print("📡 ImageBroadcaster: Upload successful!")
                    } else {
                        self?.lastError = "Server error: \(httpResponse.statusCode)"
                        self?.isConnected = false
                    }
                }
            }
        }
        task.resume()
        print("📡 ImageBroadcaster: Task resumed")
    }
}
