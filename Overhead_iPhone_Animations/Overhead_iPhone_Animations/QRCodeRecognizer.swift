//
//  QRCodeRecognizer.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import Vision
import AVFoundation

class QRCodeRecognizer: RecognitionTechnique {
    weak var delegate: RecognitionTechniqueDelegate?
    private(set) var isCurrentlyDetecting = false

    private lazy var qrCodeRequest: VNDetectBarcodesRequest = {
        let request = VNDetectBarcodesRequest { [weak self] request, error in
            self?.handleDetectionResults(request: request, error: error)
        }
        request.symbologies = [.qr]
        return request
    }()

    func processFrame(_ pixelBuffer: CVPixelBuffer) {
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
        do {
            try handler.perform([qrCodeRequest])
        } catch {
            print("Failed to perform QR code detection: \(error)")
        }
    }

    private func handleDetectionResults(request: VNRequest, error: Error?) {
        guard let results = request.results as? [VNBarcodeObservation] else {
            if isCurrentlyDetecting {
                isCurrentlyDetecting = false
                delegate?.didLoseTarget()
            }
            return
        }

        if !results.isEmpty {
            if let firstQR = results.first,
               let payload = firstQR.payloadStringValue {
                delegate?.didDetectData(payload)
            }

            if !isCurrentlyDetecting {
                isCurrentlyDetecting = true
                delegate?.didDetectTarget()
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
