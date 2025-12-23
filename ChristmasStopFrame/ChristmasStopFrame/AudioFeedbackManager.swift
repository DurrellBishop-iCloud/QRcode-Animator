//
//  AudioFeedbackManager.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import AVFoundation
import AudioToolbox

class AudioFeedbackManager {
    static let shared = AudioFeedbackManager()

    private var hummingPlayer: AVAudioPlayer?
    private var isHumming = false

    private init() {
        setupAudioSession()
    }

    private func setupAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to setup audio session: \(error)")
        }
    }

    func startHumming() {
        guard !isHumming else { return }
        isHumming = true

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            AudioServicesPlaySystemSound(1104)
        }
    }

    func stopHummingAndPlayTickClick() {
        guard isHumming else { return }
        isHumming = false

        DispatchQueue.global(qos: .userInitiated).async {
            AudioServicesPlaySystemSound(1103)

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                AudioServicesPlaySystemSound(1108)
            }
        }
    }

    func playClickSound() {
        DispatchQueue.global(qos: .userInitiated).async {
            AudioServicesPlaySystemSound(1108)
        }
    }

    func playShutterSound() {
        AudioServicesPlaySystemSound(1108)
    }

    func reset() {
        isHumming = false
        hummingPlayer?.stop()
    }
}
