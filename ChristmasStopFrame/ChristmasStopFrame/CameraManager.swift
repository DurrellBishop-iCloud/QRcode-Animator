//
//  CameraManager.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import AVFoundation
import UIKit
import Combine

class CameraManager: NSObject, ObservableObject {
    private var captureSession: AVCaptureSession?
    private var currentCamera: AVCaptureDevice?
    private var videoOutput: AVCaptureVideoDataOutput?
    private var photoOutput: AVCapturePhotoOutput?

    @Published var previewLayer: AVCaptureVideoPreviewLayer?
    @Published var capturedPhotos: [UIImage] = []
    @Published var currentFrameIndex: Int = 0
    @Published var isViewingLiveFeed: Bool = true  // true = live feed, false = viewing static frame

    private let videoDataOutputQueue = DispatchQueue(label: "videoDataOutputQueue")

    var frameProcessor: ((CVPixelBuffer) -> Void)?

    override init() {
        super.init()
        setupCamera()
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
            previewLayer.videoGravity = .resizeAspectFill

            self.captureSession = captureSession
            self.currentCamera = camera
            self.photoOutput = photoOutput
            self.videoOutput = videoOutput
            self.previewLayer = previewLayer

            print("✅ Camera setup complete - preview layer ready")

        } catch {
            print("Error setting up camera: \(error)")
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

        frameProcessor?(pixelBuffer)
    }
}

extension CameraManager: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            print("Error capturing photo: \(error)")
            return
        }

        guard let imageData = photo.fileDataRepresentation(),
              let image = UIImage(data: imageData) else {
            print("Could not convert photo to image")
            return
        }

        DispatchQueue.main.async {
            self.capturedPhotos.append(image)
            self.currentFrameIndex = self.capturedPhotos.count - 1
            self.isViewingLiveFeed = true  // Always return to live feed after capture
            print("📸 Photo captured - total: \(self.capturedPhotos.count), returned to live feed")
        }
    }
}
