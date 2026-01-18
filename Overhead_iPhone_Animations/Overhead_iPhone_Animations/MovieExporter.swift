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
    static func saveToDocuments(frames: [UIImage], sessionID: String, frameRate: Double = 12.0, cropTop: Double = 0, cropBottom: Double = 0, screenSize: CGSize, reverse: Bool = false, completion: @escaping (Bool, Error?) -> Void) {
        guard !frames.isEmpty else {
            completion(false, NSError(domain: "MovieExporter", code: 1, userInfo: [NSLocalizedDescriptionKey: "No frames to export"]))
            return
        }

        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let outputURL = documentsURL.appendingPathComponent("session_\(sessionID).mov")

        // Calculate crop based on frame overlay masks only
        // The camera preview maintains its native 9:16 aspect ratio on screen
        // Frame overlays hide portions of the camera feed (in screen pixels)
        // We need to convert screen pixels to camera pixels

        guard let firstFrame = frames.first else {
            completion(false, NSError(domain: "MovieExporter", code: 1, userInfo: [NSLocalizedDescriptionKey: "No frames to export"]))
            return
        }
        let photoWidth = firstFrame.size.width
        let photoHeight = firstFrame.size.height
        let photoAspectRatio = photoWidth / photoHeight

        // Camera preview fills screen width in portrait mode, calculate scale factor
        let screenWidth = screenSize.width
        let baseScaleRatio = photoWidth / screenWidth

        // No calibration multiplier needed - use direct ratio
        let scaleRatio = baseScaleRatio

        // Convert frame overlay pixels to camera pixels
        let calculatedCropTop = cropTop * scaleRatio
        let calculatedCropBottom = cropBottom * scaleRatio

        // Calculate the ACTUAL camera preview display size on screen
        // Camera preview uses .resizeAspect, so it maintains aspect ratio
        let cameraAspectRatio = photoWidth / photoHeight  // e.g. 1920/1080 = 1.78 or 1080/1920 = 0.56
        let screenHeight = screenSize.height
        let screenAspectRatio = screenWidth / screenHeight

        // Determine displayed camera size (with .resizeAspect)
        var displayedWidth: CGFloat
        var displayedHeight: CGFloat
        if cameraAspectRatio > screenAspectRatio {
            // Camera is wider than screen, fits to width
            displayedWidth = screenWidth
            displayedHeight = screenWidth / cameraAspectRatio
        } else {
            // Camera is taller than screen, fits to height
            displayedHeight = screenHeight
            displayedWidth = screenHeight * cameraAspectRatio
        }

        // Camera is centered, calculate offset from top of screen
        let cameraOffsetY = (screenHeight - displayedHeight) / 2

        print("📐 SCREEN: \(screenWidth)x\(screenHeight), aspect=\(String(format: "%.3f", screenAspectRatio))")
        print("📐 PHOTO: \(photoWidth)x\(photoHeight), aspect=\(String(format: "%.3f", cameraAspectRatio))")
        print("📐 DISPLAYED CAMERA: \(String(format: "%.1f", displayedWidth))x\(String(format: "%.1f", displayedHeight)), offsetY=\(String(format: "%.1f", cameraOffsetY))")
        print("📐 FRAME OVERLAY: top=\(cropTop), bottom=\(cropBottom)")

        // Calculate how much of the frame overlay actually overlaps with the camera preview
        let effectiveCropTop = max(0, cropTop - cameraOffsetY)  // Subtract offset since camera doesn't start at y=0
        let effectiveCropBottom = max(0, cropBottom - cameraOffsetY)  // Same for bottom

        // Scale from displayed camera size to actual photo size
        let displayToPhotoScale = photoHeight / displayedHeight

        let calculatedCropTopNew = effectiveCropTop * displayToPhotoScale
        let calculatedCropBottomNew = effectiveCropBottom * displayToPhotoScale

        print("📐 EFFECTIVE CROP (screen px): top=\(String(format: "%.1f", effectiveCropTop)), bottom=\(String(format: "%.1f", effectiveCropBottom))")
        print("📐 DISPLAY→PHOTO scale: \(String(format: "%.3f", displayToPhotoScale))")
        print("📐 CROP (photo px) NEW: top=\(Int(calculatedCropTopNew)), bottom=\(Int(calculatedCropBottomNew))")
        print("📐 CROP (photo px) OLD: top=\(Int(calculatedCropTop)), bottom=\(Int(calculatedCropBottom))")

        // Use the NEW correct calculation that accounts for letterbox offset
        let finalCropTop = calculatedCropTopNew
        let finalCropBottom = calculatedCropBottomNew

        let finalHeight = photoHeight - finalCropTop - finalCropBottom
        let finalAspectRatio = photoWidth / finalHeight

        print("📐 EXPORT: Photo=\(photoWidth)x\(photoHeight), Crop (camera px): top=\(Int(finalCropTop)), bottom=\(Int(finalCropBottom))")
        print("📐 EXPORT: Final video=\(Int(photoWidth))x\(Int(finalHeight)), Aspect=\(String(format: "%.3f", finalAspectRatio))")

        // Reverse frames if setting is enabled
        let framesToExport = reverse ? frames.reversed() : Array(frames)
        print("📐 EXPORT: Reverse=\(reverse), frame count=\(framesToExport.count)")

        createVideo(from: framesToExport, outputURL: outputURL, frameRate: frameRate, cropTop: finalCropTop, cropBottom: finalCropBottom) { success, error in
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
                    try? FileManager.default.removeItem(at: videoURL)
                }
                completion(success, error)
            })
        }
    }

    static func exportToPhotos(frames: [UIImage], sessionID: String, frameRate: Double = 12.0, cropTop: Double = 0, cropBottom: Double = 0, screenSize: CGSize, reverse: Bool = false, replacingAsset: String? = nil, completion: @escaping (Bool, Error?, String?) -> Void) {
        guard !frames.isEmpty else {
            completion(false, NSError(domain: "MovieExporter", code: 1, userInfo: [NSLocalizedDescriptionKey: "No frames to export"]), nil)
            return
        }

        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("temp_\(sessionID).mov")

        // Calculate crop based on frame overlay masks only
        guard let firstFrame = frames.first else {
            completion(false, NSError(domain: "MovieExporter", code: 1, userInfo: [NSLocalizedDescriptionKey: "No frames to export"]), nil)
            return
        }
        let photoWidth = firstFrame.size.width
        let photoHeight = firstFrame.size.height

        // Calculate the ACTUAL camera preview display size on screen
        let screenWidth = screenSize.width
        let screenHeight = screenSize.height
        let cameraAspectRatio = photoWidth / photoHeight
        let screenAspectRatio = screenWidth / screenHeight

        var displayedHeight: CGFloat
        if cameraAspectRatio > screenAspectRatio {
            displayedHeight = screenWidth / cameraAspectRatio
        } else {
            displayedHeight = screenHeight
        }

        let cameraOffsetY = (screenHeight - displayedHeight) / 2
        let effectiveCropTop = max(0, cropTop - cameraOffsetY)
        let effectiveCropBottom = max(0, cropBottom - cameraOffsetY)
        let displayToPhotoScale = photoHeight / displayedHeight

        let finalCropTop = effectiveCropTop * displayToPhotoScale
        let finalCropBottom = effectiveCropBottom * displayToPhotoScale

        print("📐 CROP: UI values - top=\(cropTop), bottom=\(cropBottom), effective: top=\(effectiveCropTop), bottom=\(effectiveCropBottom)")

        // Reverse frames if setting is enabled
        let framesToExport = reverse ? frames.reversed() : Array(frames)

        createVideo(from: framesToExport, outputURL: tempURL, frameRate: frameRate, cropTop: finalCropTop, cropBottom: finalCropBottom) { success, error in
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
                        }, completionHandler: { _, _ in })
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

        UIGraphicsPushContext(context)
        // Draw the image at offset to crop top portion
        let drawRect = CGRect(x: 0, y: -cropTop, width: CGFloat(originalWidth), height: CGFloat(originalHeight))
        draw(in: drawRect)
        UIGraphicsPopContext()

        CVPixelBufferUnlockBaseAddress(buffer, [])

        return buffer
    }
}
