//
//  PlaybackManager.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 22/12/2025.
//

import UIKit
import Combine

class PlaybackManager: ObservableObject {
    @Published var currentFrame: UIImage?
    @Published var isPlaying = false

    private var playbackTimer: Timer?
    private var framesPerSecond: Double = 12.0
    private var playbackFrameIndex = 0

    var frames: [UIImage] = []
    var currentFrameIndex: Int = 0

    func setFrames(_ frames: [UIImage], startIndex: Int = 0) {
        self.frames = frames
        self.currentFrameIndex = startIndex
        if !frames.isEmpty && startIndex < frames.count {
            currentFrame = frames[startIndex]
            playbackFrameIndex = startIndex
        }
    }

    func showFrame(at index: Int) {
        guard !frames.isEmpty, index >= 0, index < frames.count else { return }
        currentFrameIndex = index
        currentFrame = frames[index]
    }

    func startPlayback() {
        guard !frames.isEmpty else { return }

        isPlaying = true
        playbackTimer?.invalidate()

        playbackTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / framesPerSecond, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            self.playbackFrameIndex = (self.playbackFrameIndex + 1) % self.frames.count
            self.currentFrameIndex = self.playbackFrameIndex

            DispatchQueue.main.async {
                self.currentFrame = self.frames[self.playbackFrameIndex]
            }
        }
    }

    func stopPlayback() {
        isPlaying = false
        playbackTimer?.invalidate()
        playbackTimer = nil
    }

    func reset() {
        stopPlayback()
        currentFrameIndex = 0
        if !frames.isEmpty {
            currentFrame = frames[0]
        }
    }
}
