//
//  RecognitionTechnique.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import AVFoundation
import CoreImage

enum RecognitionType: String, CaseIterable {
    case qrCode = "QR Code"
    case barcode = "Barcode"
    case text = "Text"
    case colorSample = "Color Sample"
}

protocol RecognitionTechniqueDelegate: AnyObject {
    func didDetectTarget()
    func didLoseTarget()
    func didDetectData(_ data: String)
}

protocol RecognitionTechnique: AnyObject {
    var delegate: RecognitionTechniqueDelegate? { get set }
    var isCurrentlyDetecting: Bool { get }

    func processFrame(_ pixelBuffer: CVPixelBuffer)
    func reset()
}
