//
//  BarcodeRecognizer.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import Vision
import AVFoundation

class BarcodeRecognizer: RecognitionTechnique {
    weak var delegate: RecognitionTechniqueDelegate?
    private(set) var isCurrentlyDetecting = false

    private lazy var barcodeRequest: VNDetectBarcodesRequest = {
        let request = VNDetectBarcodesRequest { [weak self] request, error in
            self?.handleDetectionResults(request: request, error: error)
        }
        request.symbologies = [.ean8, .ean13, .upce, .code39, .code93, .code128, .itf14]
        return request
    }()

    func processFrame(_ pixelBuffer: CVPixelBuffer) {
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
        do {
            try handler.perform([barcodeRequest])
        } catch {
            print("Failed to perform barcode detection: \(error)")
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
            if let firstBarcode = results.first,
               let payload = firstBarcode.payloadStringValue {
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
