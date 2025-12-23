//
//  SettingsManager.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import Foundation
import Combine

class SettingsManager: ObservableObject {
    static let shared = SettingsManager()

    private enum Keys {
        static let recognitionType = "recognitionType"
        static let captureDelay = "captureDelay"
        static let targetColorRed = "targetColorRed"
        static let targetColorGreen = "targetColorGreen"
        static let targetColorBlue = "targetColorBlue"
    }

    @Published var recognitionType: RecognitionType {
        didSet {
            UserDefaults.standard.set(recognitionType.rawValue, forKey: Keys.recognitionType)
        }
    }

    @Published var captureDelay: Double {
        didSet {
            UserDefaults.standard.set(captureDelay, forKey: Keys.captureDelay)
        }
    }

    @Published var targetColor: (red: Double, green: Double, blue: Double) {
        didSet {
            UserDefaults.standard.set(targetColor.red, forKey: Keys.targetColorRed)
            UserDefaults.standard.set(targetColor.green, forKey: Keys.targetColorGreen)
            UserDefaults.standard.set(targetColor.blue, forKey: Keys.targetColorBlue)
        }
    }

    private init() {
        let savedTypeString = UserDefaults.standard.string(forKey: Keys.recognitionType) ?? RecognitionType.qrCode.rawValue
        self.recognitionType = RecognitionType(rawValue: savedTypeString) ?? .qrCode

        self.captureDelay = UserDefaults.standard.object(forKey: Keys.captureDelay) as? Double ?? 1.0

        let red = UserDefaults.standard.object(forKey: Keys.targetColorRed) as? Double ?? 1.0
        let green = UserDefaults.standard.object(forKey: Keys.targetColorGreen) as? Double ?? 0.0
        let blue = UserDefaults.standard.object(forKey: Keys.targetColorBlue) as? Double ?? 0.0
        self.targetColor = (red, green, blue)
    }
}
