//
//  CameraManager+Navigation.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 22/12/2025.
//

import UIKit

extension CameraManager {
    func moveBack() {
        guard !capturedPhotos.isEmpty else { return }

        if isViewingLiveFeed {
            // From live feed, go to last captured frame
            currentFrameIndex = capturedPhotos.count - 1
            isViewingLiveFeed = false
            print("⬅️ Moved back from live feed to frame \(currentFrameIndex + 1)/\(capturedPhotos.count)")
        } else if currentFrameIndex > 0 {
            // Move to previous frame
            currentFrameIndex -= 1
            print("⬅️ Moved back to frame \(currentFrameIndex + 1)/\(capturedPhotos.count)")
        } else {
            // At first frame, loop to last frame
            currentFrameIndex = capturedPhotos.count - 1
            print("⬅️ Looped back to frame \(currentFrameIndex + 1)/\(capturedPhotos.count)")
        }
    }

    func moveForward() {
        guard !capturedPhotos.isEmpty else { return }

        if isViewingLiveFeed {
            // Already at live feed, can't go forward
            print("➡️ Already at live feed")
            return
        }

        if currentFrameIndex < capturedPhotos.count - 1 {
            // Move to next frame
            currentFrameIndex += 1
            print("➡️ Moved forward to frame \(currentFrameIndex + 1)/\(capturedPhotos.count)")
        } else {
            // At last frame, move to live feed
            isViewingLiveFeed = true
            print("➡️ Moved forward to live feed")
        }
    }

    func deleteCurrentFrame() {
        // Can only delete if viewing a static frame (not live feed)
        guard !isViewingLiveFeed else {
            print("🗑️ Cannot delete live feed")
            return
        }

        guard !capturedPhotos.isEmpty else { return }
        guard currentFrameIndex < capturedPhotos.count else { return }

        let deletedIndex = currentFrameIndex
        capturedPhotos.remove(at: currentFrameIndex)

        print("🗑️ Deleted frame \(deletedIndex + 1)")

        if capturedPhotos.isEmpty {
            // No more frames, return to live feed
            currentFrameIndex = 0
            isViewingLiveFeed = true
            print("📍 No frames left, returning to live feed")
        } else if currentFrameIndex >= capturedPhotos.count {
            // Was at last frame, move to new last frame
            currentFrameIndex = capturedPhotos.count - 1
            print("📍 Now at frame \(currentFrameIndex + 1)/\(capturedPhotos.count)")
        } else {
            // Stay at same index (now showing next frame)
            print("📍 Now at frame \(currentFrameIndex + 1)/\(capturedPhotos.count)")
        }
    }

    func returnToLiveFeed() {
        isViewingLiveFeed = true
        print("📹 Returned to live feed")
    }

    func resetToLastFrame() {
        if !capturedPhotos.isEmpty {
            currentFrameIndex = capturedPhotos.count - 1
            isViewingLiveFeed = false
        }
    }
}
