//
//  RecognitionManager.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import AVFoundation
import Combine

protocol RecognitionManagerDelegate: AnyObject {
    func didCapturePhoto()
    func didCaptureLongPhoto()
    func didMoveBack()
    func didMoveForward()
    func didDeleteFrame()
    func didRequestSave()
    func didRequestShare()
    var isViewingLiveFeed: Bool { get }
}

class RecognitionManager: ObservableObject {
    weak var delegate: RecognitionManagerDelegate?

    @Published var currentStatus: String = ""
    @Published var shouldFlash: Bool = false
    @Published var detectedData: String = ""
    @Published var displayText: String = ""

    private var qrCodeRecognizer = QRCodeRecognizer()
    private var barcodeRecognizer = BarcodeRecognizer()
    private var textRecognizer = TextRecognizer()
    private var colorSampleRecognizer = ColorSampleRecognizer()

    private var currentRecognizer: RecognitionTechnique?
    private var lostTargetTimer: Timer?
    private var cancellables = Set<AnyCancellable>()
    @Published var currentMode: String = "Make"
    private var lastDetectedCode: String = ""

    private let audioManager = AudioFeedbackManager.shared
    private let settings = SettingsManager.shared

    private var qrCodeLookup: [String: String] = [:]
    private var longCaptureCount: Int = 0
    private var longCaptureTimer: Timer?

    init() {
        setupLookupTable()
        setupRecognizers()
        observeSettings()
        switchToRecognizer(settings.recognitionType)
    }

    private func setupLookupTable() {
        qrCodeLookup = [
            "save": "Saved - Start again"
        ]
    }

    private func lookupDisplayText(for qrCode: String) -> String {
        let code = qrCode.lowercased()

        // Hide system codes from display (except "save" which has custom text)
        if ["play", "back", "forward", "delete", "kaleidoscope", "long", "share"].contains(code) {
            return ""
        }

        if currentMode == "Play" {
            return ""
        }

        return qrCodeLookup[code] ?? qrCode
    }

    private func setupRecognizers() {
        qrCodeRecognizer.delegate = self
        barcodeRecognizer.delegate = self
        textRecognizer.delegate = self
        colorSampleRecognizer.delegate = self
    }

    private func observeSettings() {
        settings.$recognitionType
            .sink { [weak self] type in
                self?.switchToRecognizer(type)
            }
            .store(in: &cancellables)

        settings.$targetColor
            .sink { [weak self] color in
                self?.colorSampleRecognizer.targetColor = color
            }
            .store(in: &cancellables)
    }

    private func switchToRecognizer(_ type: RecognitionType) {
        currentRecognizer?.reset()
        lostTargetTimer?.invalidate()
        audioManager.reset()

        switch type {
        case .qrCode:
            currentRecognizer = qrCodeRecognizer
        case .barcode:
            currentRecognizer = barcodeRecognizer
        case .text:
            currentRecognizer = textRecognizer
        case .colorSample:
            currentRecognizer = colorSampleRecognizer
        }

        currentStatus = ""
        displayText = ""
    }

    func processFrame(_ pixelBuffer: CVPixelBuffer) {
        currentRecognizer?.processFrame(pixelBuffer)
    }

    func reset() {
        currentRecognizer?.reset()
        lostTargetTimer?.invalidate()
        audioManager.reset()
        currentStatus = "Ready"
    }
}

extension RecognitionManager: RecognitionTechniqueDelegate {
    func didDetectTarget() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.lostTargetTimer?.invalidate()

            if self.lastDetectedCode.lowercased() == "play" {
                self.currentMode = "Play"
            } else {
                self.audioManager.startHumming()
            }
        }
    }

    func didLoseTarget() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            let code = self.lastDetectedCode.lowercased()

            if code == "play" {
                print("📷 Switching back to Make mode")
                self.currentMode = "Make"

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.detectedData = ""
                    self.displayText = ""
                }
            } else if code == "back" {
                self.delegate?.didMoveBack()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.detectedData = ""
                    self.displayText = ""
                }
            } else if code == "forward" {
                self.delegate?.didMoveForward()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.detectedData = ""
                    self.displayText = ""
                }
            } else if code == "delete" {
                self.delegate?.didDeleteFrame()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.detectedData = ""
                    self.displayText = ""
                }
            } else if code == "save" {
                self.delegate?.didRequestSave()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.detectedData = ""
                    self.displayText = ""
                }
            } else if code == "share" {
                self.delegate?.didRequestShare()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.detectedData = ""
                    self.displayText = ""
                }
            } else if code == "kaleidoscope" {
                self.settings.kaleidoscopeEnabled.toggle()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.detectedData = ""
                    self.displayText = ""
                }
            } else if code == "long" {
                // Use timer like normal capture
                self.lostTargetTimer = Timer.scheduledTimer(withTimeInterval: self.settings.captureDelay, repeats: false) { [weak self] _ in
                    guard let self = self else { return }
                    self.startLongCapture()
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.detectedData = ""
                    self.displayText = ""
                }
            } else if self.currentMode == "Make" && (self.delegate?.isViewingLiveFeed ?? true) {
                // Only capture when viewing live feed
                self.lostTargetTimer = Timer.scheduledTimer(withTimeInterval: self.settings.captureDelay, repeats: false) { [weak self] _ in
                    guard let self = self else { return }

                    self.shouldFlash = true
                    self.audioManager.playShutterSound()

                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        self.delegate?.didCapturePhoto()

                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            self.shouldFlash = false
                            self.detectedData = ""
                            self.displayText = ""
                        }
                    }
                }
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.detectedData = ""
                    self.displayText = ""
                }
            }
        }
    }

    func didDetectData(_ data: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.detectedData = data
            self.lastDetectedCode = data

            if data.lowercased() == "play" {
                self.displayText = ""
                if self.currentMode != "Play" {
                    print("🎬 Switching to Play mode")
                    self.currentMode = "Play"
                }
            } else {
                let lookupText = self.lookupDisplayText(for: data)
                self.displayText = lookupText
            }
        }
    }

    private func startLongCapture() {
        guard currentMode == "Make", delegate?.isViewingLiveFeed ?? true else { return }

        // Capture one photo, then duplicate it 3 more times
        self.shouldFlash = true
        self.audioManager.playShutterSound()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.delegate?.didCaptureLongPhoto()

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.shouldFlash = false
            }
        }
    }
}
