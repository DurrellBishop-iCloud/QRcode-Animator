//
//  CameraManager.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import AVFoundation
import UIKit
import Combine
import CoreImage

class CameraManager: NSObject, ObservableObject {
    private var captureSession: AVCaptureSession?
    private var currentCamera: AVCaptureDevice?
    private var videoOutput: AVCaptureVideoDataOutput?
    var photoOutput: AVCapturePhotoOutput?

    @Published var previewLayer: AVCaptureVideoPreviewLayer?
    @Published var capturedPhotos: [UIImage] = []
    @Published var currentFrameIndex: Int = 0
    @Published var isViewingLiveFeed: Bool = true  // true = live feed, false = viewing static frame

    private let videoDataOutputQueue = DispatchQueue(label: "videoDataOutputQueue")
    private let settings = SettingsManager.shared
    private var cancellables = Set<AnyCancellable>()

    private let ciContext = CIContext()
    private var kaleidoscopeFilter: CIFilter?
    @Published var filteredPreviewImage: UIImage?
    private var currentKaleidoscopeRotation: Double = 0
    var isLongCapture: Bool = false

    var frameProcessor: ((CVPixelBuffer) -> Void)?

    override init() {
        super.init()
        setupKaleidoscopeFilter()
        setupCamera()
        observeSettings()
    }

    private func setupKaleidoscopeFilter() {
        // Try different kaleidoscope filters - TriangleKaleidoscope uses more of the image
        kaleidoscopeFilter = CIFilter(name: "CITriangleKaleidoscope")

        if kaleidoscopeFilter == nil {
            kaleidoscopeFilter = CIFilter(name: "CIKaleidoscope")
            kaleidoscopeFilter?.setValue(NSNumber(value: 6), forKey: "inputCount")
        } else {
            // Triangle kaleidoscope uses size and decay parameters
            kaleidoscopeFilter?.setValue(NSNumber(value: 700), forKey: "inputSize")
            kaleidoscopeFilter?.setValue(NSNumber(value: 0.85), forKey: "inputDecay")
        }
    }

    private func setupCamera() {
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
            print("No camera available")
            return
        }

        setupCameraWithDevice(camera)
    }

    private func setupCameraWithDevice(_ camera: AVCaptureDevice) {
        do {
            let captureSession = AVCaptureSession()
            captureSession.sessionPreset = .hd1920x1080

            let input = try AVCaptureDeviceInput(device: camera)

            if captureSession.canAddInput(input) {
                captureSession.addInput(input)
            } else {
                print("Failed to add camera input")
                return
            }

            let photoOutput = AVCapturePhotoOutput()
            if captureSession.canAddOutput(photoOutput) {
                captureSession.addOutput(photoOutput)
            }

            let videoOutput = AVCaptureVideoDataOutput()
            videoOutput.setSampleBufferDelegate(self, queue: videoDataOutputQueue)
            if captureSession.canAddOutput(videoOutput) {
                captureSession.addOutput(videoOutput)
            }

            let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
            previewLayer.videoGravity = .resizeAspect

            self.captureSession = captureSession
            self.currentCamera = camera
            self.photoOutput = photoOutput
            self.videoOutput = videoOutput
            self.previewLayer = previewLayer

            // Set initial zoom factor
            applyZoomFactor(settings.zoomFactor)

            print("✅ Camera setup complete - preview layer ready")

        } catch {
            print("Error setting up camera: \(error)")
        }
    }

    private func observeSettings() {
        settings.$zoomFactor
            .sink { [weak self] zoomFactor in
                self?.applyZoomFactor(zoomFactor)
            }
            .store(in: &cancellables)

        settings.$kaleidoscopeEnabled
            .sink { [weak self] enabled in
                if enabled {
                    // Generate new random rotation when kaleidoscope is enabled
                    self?.currentKaleidoscopeRotation = Double.random(in: 0...(2 * .pi))
                }
            }
            .store(in: &cancellables)
    }

    private func applyZoomFactor(_ zoomFactor: Double) {
        guard let camera = currentCamera else { return }

        do {
            try camera.lockForConfiguration()

            // Clamp zoom factor to device capabilities
            let maxZoom = min(camera.activeFormat.videoMaxZoomFactor, 5.0)
            let clampedZoom = min(max(zoomFactor, 1.0), maxZoom)

            camera.videoZoomFactor = clampedZoom
            print("🔍 Zoom set to \(clampedZoom)x (max: \(maxZoom)x)")

            camera.unlockForConfiguration()
        } catch {
            print("⚠️ Error setting zoom: \(error)")
        }
    }

    func startSession() {
        guard let captureSession = captureSession else {
            print("No capture session available")
            return
        }

        AVCaptureDevice.requestAccess(for: .video) { granted in
            if granted {
                DispatchQueue.global(qos: .userInitiated).async {
                    if !captureSession.isRunning {
                        captureSession.startRunning()
                    }
                }
            } else {
                print("Camera permission denied")
            }
        }
    }

    func stopSession() {
        guard let captureSession = captureSession else { return }

        if captureSession.isRunning {
            DispatchQueue.global(qos: .userInitiated).async {
                captureSession.stopRunning()
            }
        }
    }

    func capturePhoto() {
        guard let photoOutput = photoOutput else { return }

        let settings = AVCapturePhotoSettings()
        settings.flashMode = .off

        photoOutput.capturePhoto(with: settings, delegate: self)
    }
}

extension CameraManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }

        // Process frame for QR code recognition (always use original)
        frameProcessor?(pixelBuffer)

        // If kaleidoscope is enabled, process for preview display
        if settings.kaleidoscopeEnabled {
            let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
            if let filtered = applyKaleidoscopeFilter(to: ciImage) {
                DispatchQueue.main.async {
                    self.filteredPreviewImage = filtered
                }
            }
        } else {
            DispatchQueue.main.async {
                self.filteredPreviewImage = nil
            }
        }
    }

    private func applyKaleidoscopeFilter(to image: CIImage) -> UIImage? {
        guard let filter = kaleidoscopeFilter else { return nil }

        filter.setValue(image, forKey: kCIInputImageKey)

        // Different parameters for different filter types
        if filter.name == "CITriangleKaleidoscope" {
            let center = CIVector(x: image.extent.width / 2, y: image.extent.height / 2)
            filter.setValue(center, forKey: "inputPoint")
            filter.setValue(NSNumber(value: currentKaleidoscopeRotation), forKey: "inputRotation")
        } else {
            let center = CIVector(x: image.extent.width / 2, y: image.extent.height / 2)
            filter.setValue(center, forKey: "inputCenter")
            filter.setValue(NSNumber(value: currentKaleidoscopeRotation), forKey: "inputAngle")
        }

        guard let outputImage = filter.outputImage,
              let cgImage = ciContext.createCGImage(outputImage.cropped(to: image.extent), from: image.extent) else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }
}

extension CameraManager: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            print("Error capturing photo: \(error)")
            return
        }

        guard let imageData = photo.fileDataRepresentation(),
              var image = UIImage(data: imageData) else {
            print("Could not convert photo to image")
            return
        }

        // Apply kaleidoscope filter if enabled
        if settings.kaleidoscopeEnabled, let ciImage = CIImage(image: image) {
            if let filtered = applyKaleidoscopeFilter(to: ciImage) {
                image = filtered
            }
        }

        DispatchQueue.main.async {
            print("📸 Photo captured - size: \(image.size.width)x\(image.size.height), aspect ratio: \(image.size.width/image.size.height)")

            if self.isLongCapture {
                // Add the same photo 4 times
                for _ in 0..<4 {
                    self.capturedPhotos.append(image)
                }
                print("📸 Long capture: added 4 identical frames")
                self.isLongCapture = false
            } else {
                // Normal capture: add once
                self.capturedPhotos.append(image)
            }

            self.currentFrameIndex = self.capturedPhotos.count - 1
            self.isViewingLiveFeed = true  // Always return to live feed after capture
            print("📸 Total frames: \(self.capturedPhotos.count), returned to live feed")
        }
    }
}
