//
//  MovieExporter.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 22/12/2025.
//

import AVFoundation
import UIKit
import Photos

class MovieExporter {
    static func exportToPhotos(frames: [UIImage], sessionID: String, frameRate: Double = 12.0, completion: @escaping (Bool, Error?) -> Void) {
        guard !frames.isEmpty else {
            completion(false, NSError(domain: "MovieExporter", code: 1, userInfo: [NSLocalizedDescriptionKey: "No frames to export"]))
            return
        }

        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("temp_\(sessionID).mov")

        createVideo(from: frames, outputURL: tempURL, frameRate: frameRate) { success, error in
            guard success, error == nil else {
                completion(false, error)
                return
            }

            PHPhotoLibrary.requestAuthorization { status in
                guard status == .authorized else {
                    completion(false, NSError(domain: "MovieExporter", code: 2, userInfo: [NSLocalizedDescriptionKey: "Photos permission denied"]))
                    return
                }

                PHPhotoLibrary.shared().performChanges({
                    let request = PHAssetCreationRequest.forAsset()
                    request.addResource(with: .video, fileURL: tempURL, options: nil)
                }, completionHandler: { success, error in
                    try? FileManager.default.removeItem(at: tempURL)
                    completion(success, error)
                })
            }
        }
    }

    private static func createVideo(from frames: [UIImage], outputURL: URL, frameRate: Double, completion: @escaping (Bool, Error?) -> Void) {
        try? FileManager.default.removeItem(at: outputURL)

        guard let firstFrame = frames.first else {
            completion(false, NSError(domain: "MovieExporter", code: 3, userInfo: [NSLocalizedDescriptionKey: "No frames"]))
            return
        }

        let size = firstFrame.size
        let videoWriter: AVAssetWriter
        do {
            videoWriter = try AVAssetWriter(outputURL: outputURL, fileType: .mov)
        } catch {
            completion(false, error)
            return
        }

        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: size.width,
            AVVideoHeightKey: size.height
        ]

        let videoWriterInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        let pixelBufferAdaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: videoWriterInput,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
                kCVPixelBufferWidthKey as String: size.width,
                kCVPixelBufferHeightKey as String: size.height
            ]
        )

        videoWriter.add(videoWriterInput)

        videoWriter.startWriting()
        videoWriter.startSession(atSourceTime: .zero)

        let frameDuration = CMTime(value: 1, timescale: Int32(frameRate))
        var frameCount = 0

        let mediaInputQueue = DispatchQueue(label: "mediaInputQueue")

        videoWriterInput.requestMediaDataWhenReady(on: mediaInputQueue) {
            while videoWriterInput.isReadyForMoreMediaData && frameCount < frames.count {
                let presentationTime = CMTime(value: Int64(frameCount), timescale: Int32(frameRate))

                if let pixelBuffer = frames[frameCount].pixelBuffer() {
                    pixelBufferAdaptor.append(pixelBuffer, withPresentationTime: presentationTime)
                }

                frameCount += 1
            }

            if frameCount >= frames.count {
                videoWriterInput.markAsFinished()
                videoWriter.finishWriting {
                    if videoWriter.status == .completed {
                        completion(true, nil)
                    } else {
                        completion(false, videoWriter.error)
                    }
                }
            }
        }
    }
}

extension UIImage {
    func pixelBuffer() -> CVPixelBuffer? {
        let width = Int(size.width)
        let height = Int(size.height)

        let attributes: [String: Any] = [
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
        ]

        var pixelBuffer: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_32ARGB,
            attributes as CFDictionary,
            &pixelBuffer
        )

        guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
            return nil
        }

        CVPixelBufferLockBaseAddress(buffer, [])
        let pixelData = CVPixelBufferGetBaseAddress(buffer)

        let rgbColorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: pixelData,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: rgbColorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
        ) else {
            CVPixelBufferUnlockBaseAddress(buffer, [])
            return nil
        }

        // Rotate 180 degrees and flip horizontal
        context.translateBy(x: CGFloat(width), y: 0)
        context.scaleBy(x: -1.0, y: 1.0)

        UIGraphicsPushContext(context)
        draw(in: CGRect(x: 0, y: 0, width: width, height: height))
        UIGraphicsPopContext()

        CVPixelBufferUnlockBaseAddress(buffer, [])

        return buffer
    }
}
