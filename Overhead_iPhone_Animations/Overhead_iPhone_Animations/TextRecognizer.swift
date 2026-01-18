//
//  TextRecognizer.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import Vision
import AVFoundation

class TextRecognizer: RecognitionTechnique {
    weak var delegate: RecognitionTechniqueDelegate?
    private(set) var isCurrentlyDetecting = false
    private var lastDetectedTrigger: String = ""

    // Trigger words that map to actions (same as QR code commands)
    private let triggerWords = ["play", "back", "forward", "delete", "save", "share", "kaleidoscope", "long", "background"]

    private lazy var textRequest: VNRecognizeTextRequest = {
        let request = VNRecognizeTextRequest { [weak self] request, error in
            self?.handleDetectionResults(request: request, error: error)
        }
        request.recognitionLevel = .fast
        request.usesLanguageCorrection = false
        return request
    }()

    func processFrame(_ pixelBuffer: CVPixelBuffer) {
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
        do {
            try handler.perform([textRequest])
        } catch {
            print("Failed to perform text detection: \(error)")
        }
    }

    private func handleDetectionResults(request: VNRequest, error: Error?) {
        guard let results = request.results as? [VNRecognizedTextObservation] else {
            if isCurrentlyDetecting {
                isCurrentlyDetecting = false
                delegate?.didLoseTarget()
            }
            return
        }

        // Extract all recognized text and look for trigger words
        var detectedTrigger: String? = nil

        for observation in results {
            guard let candidate = observation.topCandidates(1).first,
                  candidate.confidence > 0.5 else { continue }

            let recognizedText = candidate.string.lowercased()

            // Check if any trigger word is contained in the recognized text
            for trigger in triggerWords {
                if recognizedText.contains(trigger) {
                    detectedTrigger = trigger
                    break
                }
            }

            if detectedTrigger != nil { break }
        }

        if let trigger = detectedTrigger {
            if !isCurrentlyDetecting || trigger != lastDetectedTrigger {
                lastDetectedTrigger = trigger
                isCurrentlyDetecting = true
                delegate?.didDetectTarget()
                delegate?.didDetectData(trigger)
            }
        } else {
            if isCurrentlyDetecting {
                isCurrentlyDetecting = false
                lastDetectedTrigger = ""
                delegate?.didLoseTarget()
            }
        }
    }

    func reset() {
        isCurrentlyDetecting = false
        lastDetectedTrigger = ""
    }
}
