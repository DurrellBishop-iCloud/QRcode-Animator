//
//  ColorSampleRecognizer.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import CoreImage
import AVFoundation
import UIKit

class ColorSampleRecognizer: RecognitionTechnique {
    weak var delegate: RecognitionTechniqueDelegate?
    private(set) var isCurrentlyDetecting = false

    private let context = CIContext()
    private let colorThreshold: CGFloat = 0.3

    var targetColor: (red: Double, green: Double, blue: Double) = (1.0, 0.0, 0.0)

    func processFrame(_ pixelBuffer: CVPixelBuffer) {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)

        let centerX = ciImage.extent.width / 2
        let centerY = ciImage.extent.height / 2
        let sampleSize: CGFloat = 50

        let sampleRect = CGRect(
            x: centerX - sampleSize / 2,
            y: centerY - sampleSize / 2,
            width: sampleSize,
            height: sampleSize
        )

        let croppedCIImage = ciImage.cropped(to: sampleRect)
        guard let croppedImage = context.createCGImage(croppedCIImage, from: sampleRect) else {
            return
        }

        let averageColor = getAverageColor(from: croppedImage)

        let colorMatch = isColorMatch(averageColor, target: targetColor)

        if colorMatch {
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

    private func getAverageColor(from cgImage: CGImage) -> (red: Double, green: Double, blue: Double) {
        let width = cgImage.width
        let height = cgImage.height
        let totalPixels = width * height

        guard let data = cgImage.dataProvider?.data,
              let bytes = CFDataGetBytePtr(data) else {
            return (0, 0, 0)
        }

        var totalRed: CGFloat = 0
        var totalGreen: CGFloat = 0
        var totalBlue: CGFloat = 0

        for y in 0..<height {
            for x in 0..<width {
                let offset = (y * width + x) * 4
                totalRed += CGFloat(bytes[offset])
                totalGreen += CGFloat(bytes[offset + 1])
                totalBlue += CGFloat(bytes[offset + 2])
            }
        }

        let avgRed = Double(totalRed) / Double(totalPixels) / 255.0
        let avgGreen = Double(totalGreen) / Double(totalPixels) / 255.0
        let avgBlue = Double(totalBlue) / Double(totalPixels) / 255.0

        return (avgRed, avgGreen, avgBlue)
    }

    private func isColorMatch(_ color: (red: Double, green: Double, blue: Double),
                              target: (red: Double, green: Double, blue: Double)) -> Bool {
        let redDiff = abs(color.red - target.red)
        let greenDiff = abs(color.green - target.green)
        let blueDiff = abs(color.blue - target.blue)

        return redDiff < colorThreshold && greenDiff < colorThreshold && blueDiff < colorThreshold
    }

    func reset() {
        isCurrentlyDetecting = false
    }
}
