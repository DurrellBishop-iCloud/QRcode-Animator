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

    // Background image for transparent mode
    var backgroundImage: UIImage?
    var isCapturingBackground: Bool = false
    private var transparencyThreshold: Float = 0.7 // Auto-calibrated threshold
    private var hasCalibrated: Bool = false // Track if we've calibrated yet

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

            // Set initial zoom factor and exposure
            applyZoomFactor(settings.zoomFactor)
            applyExposureBias(settings.exposureBias)

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

        settings.$exposureBias
            .sink { [weak self] exposureBias in
                self?.applyExposureBias(exposureBias)
            }
            .store(in: &cancellables)

        settings.$backgroundTransparent
            .sink { [weak self] enabled in
                if enabled {
                    print("🎯 Transparent background enabled - will calibrate on next frame")
                    self?.hasCalibrated = false // Reset calibration flag
                } else {
                    self?.hasCalibrated = false // Reset when disabled too
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

    private func applyExposureBias(_ exposureBias: Double) {
        guard let camera = currentCamera else { return }

        do {
            try camera.lockForConfiguration()

            // Clamp exposure bias to device capabilities
            let minBias = camera.minExposureTargetBias
            let maxBias = camera.maxExposureTargetBias
            let clampedBias = Float(min(max(exposureBias, Double(minBias)), Double(maxBias)))

            camera.setExposureTargetBias(clampedBias)
            print("☀️ Exposure bias set to \(clampedBias)")

            camera.unlockForConfiguration()
        } catch {
            print("⚠️ Error setting exposure: \(error)")
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

        // Calibrate transparency threshold from live feed if enabled and not yet calibrated
        if settings.backgroundTransparent && !hasCalibrated {
            calibrateTransparencyFromLiveFeed(pixelBuffer)
            hasCalibrated = true
        }

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

    private func applyAdaptiveThreshold(to ciImage: CIImage) -> CIImage? {
        // Sample the image to find brightness distribution
        let extent = ciImage.extent
        guard extent.width > 0 && extent.height > 0 else { return nil }

        // Convert to grayscale first
        guard let grayscaleFilter = CIFilter(name: "CIColorControls"),
              let monoFilter = CIFilter(name: "CIPhotoEffectMono") else { return nil }

        monoFilter.setValue(ciImage, forKey: kCIInputImageKey)
        guard let monoImage = monoFilter.outputImage else { return nil }

        // Sample brightness at multiple points to find the median
        let samplePoints = 100
        var brightnesses: [CGFloat] = []

        let stepX = extent.width / CGFloat(samplePoints)
        let stepY = extent.height / CGFloat(samplePoints)

        // Create a small context for sampling
        let sampleContext = CIContext(options: [.workingColorSpace: NSNull()])

        for i in 0..<10 {
            for j in 0..<10 {
                let x = extent.minX + CGFloat(i) * stepX + extent.width/20
                let y = extent.minY + CGFloat(j) * stepY + extent.height/20
                let rect = CGRect(x: x, y: y, width: 1, height: 1)

                if let cgImage = sampleContext.createCGImage(monoImage, from: rect) {
                    if let data = cgImage.dataProvider?.data,
                       let bytes = CFDataGetBytePtr(data) {
                        let brightness = CGFloat(bytes[0]) / 255.0
                        brightnesses.append(brightness)
                    }
                }
            }
        }

        // Find median brightness
        brightnesses.sort()
        let medianBrightness = brightnesses.isEmpty ? 0.5 : brightnesses[brightnesses.count / 2]

        print("📊 Auto-threshold: median brightness = \(medianBrightness)")

        // Apply threshold using tone curve - invert around the median
        guard let toneCurveFilter = CIFilter(name: "CIToneCurve") else { return nil }
        toneCurveFilter.setValue(ciImage, forKey: kCIInputImageKey)

        // Create a steep S-curve centered at the median to create binary black/white
        // Points below median → black (0), points above median → white (1)
        let point0 = CIVector(x: 0, y: 1) // Black input → White output (inverted)
        let point1 = CIVector(x: medianBrightness - 0.1, y: 0.9) // Just below median → nearly white
        let point2 = CIVector(x: medianBrightness, y: 0.5) // Median → middle
        let point3 = CIVector(x: medianBrightness + 0.1, y: 0.1) // Just above median → nearly black
        let point4 = CIVector(x: 1, y: 0) // White input → Black output (inverted)

        toneCurveFilter.setValue(point0, forKey: "inputPoint0")
        toneCurveFilter.setValue(point1, forKey: "inputPoint1")
        toneCurveFilter.setValue(point2, forKey: "inputPoint2")
        toneCurveFilter.setValue(point3, forKey: "inputPoint3")
        toneCurveFilter.setValue(point4, forKey: "inputPoint4")

        return toneCurveFilter.outputImage
    }

    func calibrateTransparencyFromLiveFeed(_ pixelBuffer: CVPixelBuffer) {
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)

        guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else { return }
        let buffer = baseAddress.assumingMemoryBound(to: UInt8.self)

        var brightnesses: [Float] = []

        // Sample 100 points across the live feed
        for i in 0..<10 {
            for j in 0..<10 {
                let x = width * i / 10
                let y = height * j / 10
                let offset = y * bytesPerRow + x * 4

                let b = Float(buffer[offset]) / 255.0
                let g = Float(buffer[offset + 1]) / 255.0
                let r = Float(buffer[offset + 2]) / 255.0
                let brightness = (r + g + b) / 3.0
                brightnesses.append(brightness)
            }
        }

        // Sort to find the majority brightness (should be white background)
        brightnesses.sort()

        // Find the median - this is the majority color (white background)
        let medianIndex = brightnesses.count / 2
        let backgroundBrightness = brightnesses[medianIndex]

        // Set threshold slightly below the background brightness
        // Everything at or above this brightness becomes transparent
        transparencyThreshold = backgroundBrightness * 0.9

        print("🎯 Calibrated transparency from live feed: background = \(backgroundBrightness), threshold = \(transparencyThreshold)")
    }

    private func applyTransparency(to ciImage: CIImage) -> CIImage? {
        // Use the threshold calibrated from live feed + user adjustment
        let brightnessThreshold = transparencyThreshold + Float(settings.transparencyAdjust)

        print("🎨 Applying transparency with threshold: \(brightnessThreshold) (base: \(transparencyThreshold), adjust: \(settings.transparencyAdjust))")

        // Make white/light gray areas transparent
        guard let chromaKeyFilter = CIFilter(name: "CIColorCube") else { return nil }

        // Create a color cube that maps white → transparent, dark → opaque
        let cubeSize = 64
        var cubeData = [Float](repeating: 0, count: cubeSize * cubeSize * cubeSize * 4)

        for b in 0..<cubeSize {
            for g in 0..<cubeSize {
                for r in 0..<cubeSize {
                    let index = (b * cubeSize * cubeSize + g * cubeSize + r) * 4
                    let red = Float(r) / Float(cubeSize - 1)
                    let green = Float(g) / Float(cubeSize - 1)
                    let blue = Float(b) / Float(cubeSize - 1)

                    // Calculate brightness
                    let brightness = (red + green + blue) / 3.0

                    // White/light areas → transparent, dark areas → opaque
                    // Use threshold calibrated from live feed
                    let alpha: Float = brightness > brightnessThreshold ? 0.0 : 1.0

                    cubeData[index] = red
                    cubeData[index + 1] = green
                    cubeData[index + 2] = blue
                    cubeData[index + 3] = alpha
                }
            }
        }

        let data = Data(bytes: cubeData, count: cubeData.count * MemoryLayout<Float>.size)
        chromaKeyFilter.setValue(ciImage, forKey: kCIInputImageKey)
        chromaKeyFilter.setValue(cubeSize, forKey: "inputCubeDimension")
        chromaKeyFilter.setValue(data, forKey: "inputCubeData")

        return chromaKeyFilter.outputImage
    }

    private func compositeWithBackground(_ foreground: CIImage) -> CIImage {
        // Get or create background
        let bgImage: CIImage
        if let storedBg = backgroundImage, let ciBg = CIImage(image: storedBg) {
            bgImage = ciBg
        } else {
            // Create orange background
            let orangeColor = CIColor(red: 1.0, green: 0.55, blue: 0.0) // #FF8C00
            bgImage = CIImage(color: orangeColor).cropped(to: foreground.extent)
        }

        // Composite foreground over background
        guard let compositeFilter = CIFilter(name: "CISourceOverCompositing") else { return foreground }
        compositeFilter.setValue(foreground, forKey: kCIInputImageKey)
        compositeFilter.setValue(bgImage, forKey: kCIInputBackgroundImageKey)

        return compositeFilter.outputImage ?? foreground
    }

    private func applyColorAdjustments(to uiImage: UIImage) -> UIImage? {
        guard let ciImage = CIImage(image: uiImage) else { return nil }
        var outputImage = ciImage

        print("🔍 applyColorAdjustments called - backgroundTransparent: \(settings.backgroundTransparent), isCapturingBackground: \(isCapturingBackground)")

        // FIRST: Apply transparent background mode if enabled (but NOT when capturing background)
        if settings.backgroundTransparent && !isCapturingBackground {
            print("✅ Applying transparency filter...")
            if let transparent = applyTransparency(to: outputImage) {
                // Only composite with background if useBackground is enabled
                let finalImage: CIImage
                if settings.useBackground {
                    print("✅ Transparency applied, compositing with background...")
                    finalImage = compositeWithBackground(transparent)
                } else {
                    print("✅ Transparency applied, no background compositing")
                    finalImage = transparent
                }

                // Render and return
                guard let cgImage = ciContext.createCGImage(finalImage, from: ciImage.extent) else {
                    print("❌ Failed to create CGImage from result")
                    return nil
                }
                print("✅ Transparent background complete!")
                return UIImage(cgImage: cgImage, scale: uiImage.scale, orientation: uiImage.imageOrientation)
            } else {
                print("❌ applyTransparency returned nil")
            }
        } else {
            print("⏭️  Skipping transparency (not enabled or capturing background)")
        }

        // SECOND: Apply adaptive threshold if Invert is enabled
        if settings.invertColors {
            if let thresholded = applyAdaptiveThreshold(to: outputImage) {
                outputImage = thresholded

                // Render and return immediately - adaptive threshold is the final effect
                guard let cgImage = ciContext.createCGImage(outputImage, from: ciImage.extent) else {
                    return nil
                }
                return UIImage(cgImage: cgImage, scale: uiImage.scale, orientation: uiImage.imageOrientation)
            }
        }

        // Apply contrast and saturation using CIColorControls filter
        if let colorControlsFilter = CIFilter(name: "CIColorControls") {
            colorControlsFilter.setValue(outputImage, forKey: kCIInputImageKey)
            colorControlsFilter.setValue(NSNumber(value: settings.saturation), forKey: kCIInputSaturationKey)
            colorControlsFilter.setValue(NSNumber(value: settings.contrast), forKey: kCIInputContrastKey)

            if let filteredImage = colorControlsFilter.outputImage {
                outputImage = filteredImage
            }
        }

        // Render with original image extent
        guard let cgImage = ciContext.createCGImage(outputImage, from: ciImage.extent) else {
            return nil
        }

        // FIXED: Preserve original image orientation and scale
        return UIImage(cgImage: cgImage, scale: uiImage.scale, orientation: uiImage.imageOrientation)
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

        // Apply color adjustments (contrast, saturation, invert)
        if let adjusted = applyColorAdjustments(to: image) {
            image = adjusted
        }

        DispatchQueue.main.async {
            print("📸 Photo captured - size: \(image.size.width)x\(image.size.height), aspect ratio: \(image.size.width/image.size.height)")

            if self.isCapturingBackground {
                // Set as background image
                self.backgroundImage = image
                self.isCapturingBackground = false
                print("🖼️ Background image set")
            } else if self.isLongCapture {
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

            if !self.isCapturingBackground {
                self.currentFrameIndex = self.capturedPhotos.count - 1
                self.isViewingLiveFeed = true  // Always return to live feed after capture
                print("📸 Total frames: \(self.capturedPhotos.count), returned to live feed")
            }
        }
    }
}
