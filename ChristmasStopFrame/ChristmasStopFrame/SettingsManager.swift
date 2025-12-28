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
        static let frameTopThickness = "frameTopThickness"
        static let frameBottomThickness = "frameBottomThickness"
        static let frameRate = "frameRate"
        static let zoomFactor = "zoomFactor"
        static let kaleidoscopeEnabled = "kaleidoscopeEnabled"
        static let serverAddress = "serverAddress"
        static let onionSkinEnabled = "onionSkinEnabled"
        static let onionSkinOffsetX = "onionSkinOffsetX"
        static let onionSkinOffsetY = "onionSkinOffsetY"
        static let onionSkinOpacity = "onionSkinOpacity"
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

    @Published var frameTopThickness: Double {
        didSet {
            UserDefaults.standard.set(frameTopThickness, forKey: Keys.frameTopThickness)
        }
    }

    @Published var frameBottomThickness: Double {
        didSet {
            UserDefaults.standard.set(frameBottomThickness, forKey: Keys.frameBottomThickness)
        }
    }

    @Published var frameRate: Double {
        didSet {
            UserDefaults.standard.set(frameRate, forKey: Keys.frameRate)
        }
    }

    @Published var zoomFactor: Double {
        didSet {
            UserDefaults.standard.set(zoomFactor, forKey: Keys.zoomFactor)
        }
    }

    @Published var kaleidoscopeEnabled: Bool {
        didSet {
            UserDefaults.standard.set(kaleidoscopeEnabled, forKey: Keys.kaleidoscopeEnabled)
        }
    }

    @Published var serverAddress: String {
        didSet {
            UserDefaults.standard.set(serverAddress, forKey: Keys.serverAddress)
        }
    }

    @Published var onionSkinEnabled: Bool {
        didSet {
            UserDefaults.standard.set(onionSkinEnabled, forKey: Keys.onionSkinEnabled)
        }
    }

    @Published var onionSkinOffsetX: Double {
        didSet {
            UserDefaults.standard.set(onionSkinOffsetX, forKey: Keys.onionSkinOffsetX)
        }
    }

    @Published var onionSkinOffsetY: Double {
        didSet {
            UserDefaults.standard.set(onionSkinOffsetY, forKey: Keys.onionSkinOffsetY)
        }
    }

    @Published var onionSkinOpacity: Double {
        didSet {
            UserDefaults.standard.set(onionSkinOpacity, forKey: Keys.onionSkinOpacity)
        }
    }

    private init() {
        let savedTypeString = UserDefaults.standard.string(forKey: Keys.recognitionType) ?? RecognitionType.qrCode.rawValue
        self.recognitionType = RecognitionType(rawValue: savedTypeString) ?? .qrCode

        self.captureDelay = UserDefaults.standard.object(forKey: Keys.captureDelay) as? Double ?? 0.5

        let red = UserDefaults.standard.object(forKey: Keys.targetColorRed) as? Double ?? 1.0
        let green = UserDefaults.standard.object(forKey: Keys.targetColorGreen) as? Double ?? 0.0
        let blue = UserDefaults.standard.object(forKey: Keys.targetColorBlue) as? Double ?? 0.0
        self.targetColor = (red, green, blue)

        self.frameTopThickness = UserDefaults.standard.object(forKey: Keys.frameTopThickness) as? Double ?? 80.0
        self.frameBottomThickness = UserDefaults.standard.object(forKey: Keys.frameBottomThickness) as? Double ?? 80.0
        self.frameRate = UserDefaults.standard.object(forKey: Keys.frameRate) as? Double ?? 12.0
        self.zoomFactor = UserDefaults.standard.object(forKey: Keys.zoomFactor) as? Double ?? 1.3
        self.kaleidoscopeEnabled = UserDefaults.standard.bool(forKey: Keys.kaleidoscopeEnabled)
        self.serverAddress = UserDefaults.standard.string(forKey: Keys.serverAddress) ?? "192.168.1.198:8080"
        self.onionSkinEnabled = UserDefaults.standard.object(forKey: Keys.onionSkinEnabled) as? Bool ?? true
        self.onionSkinOffsetX = UserDefaults.standard.object(forKey: Keys.onionSkinOffsetX) as? Double ?? 0.0
        self.onionSkinOffsetY = UserDefaults.standard.object(forKey: Keys.onionSkinOffsetY) as? Double ?? 0.0
        self.onionSkinOpacity = UserDefaults.standard.object(forKey: Keys.onionSkinOpacity) as? Double ?? 0.6
    }
}
