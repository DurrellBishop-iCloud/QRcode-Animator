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

        let hasText = results.contains { observation in
            guard let candidate = observation.topCandidates(1).first else { return false }
            return candidate.confidence > 0.5
        }

        if hasText {
            if !isCurrentlyDetecting {
                isCurrentlyDetecting = true
                delegate?.didDetectTarget()
                delegate?.didDetectData("")
            }
        } else {
            if isCurrentlyDetecting {
                isCurrentlyDetecting = false
                delegate?.didLoseTarget()
            }
        }
    }

    func reset() {
        isCurrentlyDetecting = false
    }
}
