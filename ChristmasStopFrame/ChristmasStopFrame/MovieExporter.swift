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
    static func saveToDocuments(frames: [UIImage], sessionID: String, frameRate: Double = 12.0, cropTop: Double = 0, cropBottom: Double = 0, completion: @escaping (Bool, Error?) -> Void) {
        guard !frames.isEmpty else {
            completion(false, NSError(domain: "MovieExporter", code: 1, userInfo: [NSLocalizedDescriptionKey: "No frames to export"]))
            return
        }

        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let outputURL = documentsURL.appendingPathComponent("session_\(sessionID).mov")

        createVideo(from: frames, outputURL: outputURL, frameRate: frameRate, cropTop: cropTop, cropBottom: cropBottom) { success, error in
            completion(success, error)
        }
    }

    static func exportDocumentsFileToPhotos(sessionID: String, completion: @escaping (Bool, Error?) -> Void) {
        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let videoURL = documentsURL.appendingPathComponent("session_\(sessionID).mov")

        guard FileManager.default.fileExists(atPath: videoURL.path) else {
            completion(false, NSError(domain: "MovieExporter", code: 4, userInfo: [NSLocalizedDescriptionKey: "No session movie file found"]))
            return
        }

        PHPhotoLibrary.requestAuthorization { status in
            guard status == .authorized else {
                completion(false, NSError(domain: "MovieExporter", code: 2, userInfo: [NSLocalizedDescriptionKey: "Photos permission denied"]))
                return
            }

            PHPhotoLibrary.shared().performChanges({
                PHAssetCreationRequest.creationRequestForAssetFromVideo(atFileURL: videoURL)
            }, completionHandler: { success, error in
                if success {
                    // Delete the Documents file after successful save to Photos
                    try? FileManager.default.removeItem(at: videoURL)
                    print("💾 Saved session \(sessionID) to Photos and deleted local file")
                }
                completion(success, error)
            })
        }
    }

    static func exportToPhotos(frames: [UIImage], sessionID: String, frameRate: Double = 12.0, cropTop: Double = 0, cropBottom: Double = 0, replacingAsset: String? = nil, completion: @escaping (Bool, Error?, String?) -> Void) {
        guard !frames.isEmpty else {
            completion(false, NSError(domain: "MovieExporter", code: 1, userInfo: [NSLocalizedDescriptionKey: "No frames to export"]), nil)
            return
        }

        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("temp_\(sessionID).mov")

        createVideo(from: frames, outputURL: tempURL, frameRate: frameRate, cropTop: cropTop, cropBottom: cropBottom) { success, error in
            guard success, error == nil else {
                completion(false, error, nil)
                return
            }

            PHPhotoLibrary.requestAuthorization { status in
                guard status == .authorized else {
                    completion(false, NSError(domain: "MovieExporter", code: 2, userInfo: [NSLocalizedDescriptionKey: "Photos permission denied"]), nil)
                    return
                }

                // Delete previous asset if it exists
                if let assetID = replacingAsset {
                    let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [assetID], options: nil)
                    if let assetToDelete = fetchResult.firstObject {
                        PHPhotoLibrary.shared().performChanges({
                            PHAssetChangeRequest.deleteAssets([assetToDelete] as NSArray)
                        }, completionHandler: { success, error in
                            if success {
                                print("🗑️ Deleted previous movie (asset: \(assetID))")
                            } else {
                                print("⚠️ Failed to delete previous movie: \(error?.localizedDescription ?? "Unknown error")")
                            }
                        })
                    }
                }

                // Save new asset
                var newAssetIdentifier: String?
                PHPhotoLibrary.shared().performChanges({
                    let request = PHAssetCreationRequest.forAsset()
                    request.addResource(with: .video, fileURL: tempURL, options: nil)
                    newAssetIdentifier = request.placeholderForCreatedAsset?.localIdentifier
                }, completionHandler: { success, error in
                    try? FileManager.default.removeItem(at: tempURL)
                    completion(success, error, newAssetIdentifier)
                })
            }
        }
    }

    private static func createVideo(from frames: [UIImage], outputURL: URL, frameRate: Double, cropTop: Double, cropBottom: Double, completion: @escaping (Bool, Error?) -> Void) {
        try? FileManager.default.removeItem(at: outputURL)

        guard let firstFrame = frames.first else {
            completion(false, NSError(domain: "MovieExporter", code: 3, userInfo: [NSLocalizedDescriptionKey: "No frames"]))
            return
        }

        let originalSize = firstFrame.size
        let croppedHeight = originalSize.height - cropTop - cropBottom
        let size = CGSize(width: originalSize.width, height: croppedHeight)

        print("🎬 Creating video:")
        print("   - Original size: \(originalSize)")
        print("   - Crop top: \(cropTop), bottom: \(cropBottom)")
        print("   - Output size: \(size)")
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

                if let pixelBuffer = frames[frameCount].pixelBuffer(cropTop: cropTop, cropBottom: cropBottom) {
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
    func pixelBuffer(cropTop: Double = 0, cropBottom: Double = 0) -> CVPixelBuffer? {
        let originalWidth = Int(size.width)
        let originalHeight = Int(size.height)
        let croppedHeight = originalHeight - Int(cropTop) - Int(cropBottom)

        let width = originalWidth
        let height = croppedHeight

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

        // Flip horizontal to match on-screen display
        context.translateBy(x: CGFloat(width), y: 0)
        context.scaleBy(x: -1.0, y: 1.0)

        UIGraphicsPushContext(context)
        // Draw the image at offset to crop top portion
        let drawRect = CGRect(x: 0, y: -cropTop, width: CGFloat(originalWidth), height: CGFloat(originalHeight))
        draw(in: drawRect)
        UIGraphicsPopContext()

        print("   - Drawing: offset y: \(-cropTop), rect: \(drawRect)")
        print("   - Transform: translate(\(width), 0), scale(-1, 1)")

        CVPixelBufferUnlockBaseAddress(buffer, [])

        return buffer
    }
}
