//
//  HTTPServer.swift
//  Server for animations
//
//  Created by Claude Code on 25/12/2025.
//

import Foundation
import Network
import SwiftUI
import Combine

class HTTPServer: ObservableObject {
    @Published var receivedVideoURL: URL?
    @Published var isRunning = false
    @Published var serverAddress: String = ""
    @Published var connectionCount = 0

    private var listener: NWListener?
    private let port: UInt16 = 8080
    private let videoDirectory: URL

    init() {
        // Create directory for received videos
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        videoDirectory = documentsPath.appendingPathComponent("ReceivedVideos", isDirectory: true)

        try? FileManager.default.createDirectory(at: videoDirectory, withIntermediateDirectories: true)
        print("📁 Video directory: \(videoDirectory.path)")
    }

    func start() {
        do {
            listener = try NWListener(using: .tcp, on: NWEndpoint.Port(integerLiteral: port))

            listener?.stateUpdateHandler = { [weak self] state in
                DispatchQueue.main.async {
                    switch state {
                    case .ready:
                        self?.isRunning = true
                        self?.updateServerAddress()
                        print("✅ Server started on port \(self?.port ?? 0)")
                    case .failed(let error):
                        print("❌ Server failed: \(error)")
                        self?.isRunning = false
                    default:
                        break
                    }
                }
            }

            listener?.newConnectionHandler = { [weak self] connection in
                self?.handleConnection(connection)
            }

            listener?.start(queue: .global(qos: .userInitiated))

        } catch {
            print("❌ Failed to start server: \(error)")
        }
    }

    func stop() {
        listener?.cancel()
        listener = nil
        DispatchQueue.main.async {
            self.isRunning = false
        }
    }

    private func handleConnection(_ connection: NWConnection) {
        // Add state update handler to track connection lifecycle
        connection.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                print("🔌 CONN: Ready")
                DispatchQueue.main.async {
                    self?.connectionCount += 1
                }
                self?.receiveRequest(on: connection)
            case .failed(let error):
                print("🔌 CONN: Failed - \(error)")
                DispatchQueue.main.async {
                    self?.connectionCount -= 1
                }
            case .cancelled:
                print("🔌 CONN: Cancelled")
                DispatchQueue.main.async {
                    self?.connectionCount -= 1
                }
            default:
                break
            }
        }

        connection.start(queue: .global(qos: .userInitiated))
    }

    private func receiveRequest(on connection: NWConnection) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            if let error = error {
                print("📨 REQ: Error - \(error)")
                connection.cancel()
                return
            }

            guard let data = data, !data.isEmpty else {
                if isComplete {
                    connection.cancel()
                }
                return
            }

            print("📨 REQ: Received \(data.count) bytes")

            // Try to find the header/body boundary in the raw data
            // Headers end with \r\n\r\n (bytes: 13, 10, 13, 10)
            let headerSeparator = Data([13, 10, 13, 10]) // \r\n\r\n

            if let separatorRange = data.range(of: headerSeparator) {
                // Found the separator - split headers and body
                let headerData = data.subdata(in: 0..<separatorRange.lowerBound)
                let bodyStartIndex = separatorRange.upperBound
                let bodyData = data.subdata(in: bodyStartIndex..<data.count)

                print("📨 REQ: Headers=\(headerData.count)B, Body=\(bodyData.count)B")

                // Parse headers as UTF-8
                if let headerString = String(data: headerData, encoding: .utf8) {
                    if headerString.contains("POST /upload") {
                        // Extract Content-Length from headers
                        var contentLength: Int?
                        let lines = headerString.components(separatedBy: "\r\n")
                        for line in lines {
                            if line.lowercased().hasPrefix("content-length:") {
                                let value = line.components(separatedBy: ":")[1].trimmingCharacters(in: .whitespaces)
                                contentLength = Int(value)
                                break
                            }
                        }

                        if let expectedLength = contentLength {
                            print("📨 REQ: POST /upload, Content-Length=\(expectedLength)")
                            self?.receiveVideoData(on: connection, existingData: bodyData, expectedLength: expectedLength)
                        } else {
                            print("📨 REQ: POST /upload (no Content-Length)")
                            self?.receiveVideoData(on: connection, existingData: bodyData, expectedLength: nil)
                        }
                    } else if headerString.contains("GET /") {
                        print("📨 REQ: GET / detected")
                        self?.sendHTMLResponse(on: connection)
                    }
                }
            } else {
                // No separator found yet - might need to receive more data
                if let requestString = String(data: data, encoding: .utf8) {
                    if requestString.contains("GET /") {
                        self?.sendHTMLResponse(on: connection)
                    } else {
                        self?.receiveVideoData(on: connection, existingData: data, expectedLength: nil)
                    }
                } else {
                    self?.receiveVideoData(on: connection, existingData: data, expectedLength: nil)
                }
            }
        }
    }

    private func receiveVideoData(on connection: NWConnection, existingData: Data, expectedLength: Int?) {
        // Check if we already have all the data
        if let expected = expectedLength, existingData.count >= expected {
            print("📥 RECV: Complete! Got \(existingData.count)/\(expected) bytes")
            self.saveAndRespondWithVideo(data: existingData, on: connection)
            return
        }

        let receiveStart = Date()
        connection.receive(minimumIncompleteLength: 1, maximumLength: 1024 * 1024) { [weak self] data, _, isComplete, error in
            guard let self = self else { return }

            let receiveTime = Date().timeIntervalSince(receiveStart)
            var fullData = existingData
            let chunkSize = data?.count ?? 0
            if let data = data {
                fullData.append(data)
            }

            print("📥 RECV: Chunk=\(chunkSize)B, Total=\(fullData.count)B, Complete=\(isComplete), Time=\(String(format: "%.2f", receiveTime))s")

            // Check if we have all expected data
            if let expected = expectedLength, fullData.count >= expected {
                print("📥 RECV: Complete! Got \(fullData.count)/\(expected) bytes")
                self.saveAndRespondWithVideo(data: fullData, on: connection)
            } else if isComplete || error != nil {
                print("📥 RECV: Stream ended")
                self.saveAndRespondWithVideo(data: fullData, on: connection)
            } else {
                // Continue receiving
                print("📥 RECV: Continuing... (\(fullData.count)/\(expectedLength ?? 0))")
                self.receiveVideoData(on: connection, existingData: fullData, expectedLength: expectedLength)
            }
        }
    }

    private func saveAndRespondWithVideo(data: Data, on connection: NWConnection) {
        print("📥 SAVE: Processing \(data.count) bytes")

        // Save video file
        let filename = "animation_\(Date().timeIntervalSince1970).mov"
        let fileURL = self.videoDirectory.appendingPathComponent(filename)

        let saveStart = Date()
        do {
            try data.write(to: fileURL)
            let saveTime = Date().timeIntervalSince(saveStart)
            print("📥 SAVE: Success in \(String(format: "%.2f", saveTime))s - \(fileURL.lastPathComponent)")

            DispatchQueue.main.async {
                self.receivedVideoURL = fileURL
            }

            // Send success response
            let response = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK"
            print("📥 RESP: Sending 200 OK")
            connection.send(content: response.data(using: .utf8), completion: .contentProcessed { error in
                if let error = error {
                    print("📥 RESP: Send failed - \(error)")
                } else {
                    print("📥 RESP: Send complete")
                }
                connection.cancel()
            })
        } catch {
            print("📥 SAVE: Failed - \(error)")
            // Send error response
            let response = "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 5\r\n\r\nError"
            connection.send(content: response.data(using: .utf8), completion: .contentProcessed { _ in
                connection.cancel()
            })
        }
    }

    private func sendHTMLResponse(on connection: NWConnection) {
        let html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Animation Server</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: #1a1a1a;
                    color: white;
                }
                .container {
                    text-align: center;
                }
                h1 { font-size: 3em; margin-bottom: 0.5em; }
                p { font-size: 1.5em; opacity: 0.7; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎬 Animation Server</h1>
                <p>Server is running on port \(port)</p>
                <p>Send images from your iPhone app</p>
            </div>
        </body>
        </html>
        """

        let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: \(html.utf8.count)\r\n\r\n\(html)"
        connection.send(content: response.data(using: .utf8), completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    private func updateServerAddress() {
        // Get local IP address
        var address = "Unknown"
        var ifaddr: UnsafeMutablePointer<ifaddrs>?

        if getifaddrs(&ifaddr) == 0 {
            var ptr = ifaddr
            while ptr != nil {
                defer { ptr = ptr?.pointee.ifa_next }

                guard let interface = ptr?.pointee else { continue }
                let addrFamily = interface.ifa_addr.pointee.sa_family

                if addrFamily == UInt8(AF_INET) {
                    let name = String(cString: interface.ifa_name)
                    if name == "en0" || name == "en1" { // WiFi or Ethernet
                        var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                        if getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len),
                                      &hostname, socklen_t(hostname.count),
                                      nil, 0, NI_NUMERICHOST) == 0 {
                            address = String(cString: hostname)
                        }
                    }
                }
            }
            freeifaddrs(ifaddr)
        }

        DispatchQueue.main.async {
            self.serverAddress = "http://\(address):\(self.port)"
        }
    }
}
