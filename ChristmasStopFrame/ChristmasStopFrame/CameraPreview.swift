//
//  CameraPreview.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import SwiftUI
import AVFoundation

struct CameraPreview: UIViewRepresentable {
    let previewLayer: AVCaptureVideoPreviewLayer

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .black

        previewLayer.frame = view.bounds
        previewLayer.videoGravity = .resizeAspect
        view.layer.addSublayer(previewLayer)

        print("📹 CameraPreview makeUIView:")
        print("📹   - Initial frame: \(view.bounds)")
        print("📹   - Layer frame: \(previewLayer.frame)")
        print("📹   - VideoGravity: \(previewLayer.videoGravity)")
        if let session = previewLayer.session {
            print("📹   - Session preset: \(session.sessionPreset.rawValue)")
        }

        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        DispatchQueue.main.async {
            self.previewLayer.frame = uiView.bounds

            if let session = self.previewLayer.session {
                print("📹 CameraPreview updateUIView:")
                print("📹   - View bounds: \(uiView.bounds)")
                print("📹   - Layer frame: \(self.previewLayer.frame)")
                print("📹   - VideoGravity: \(self.previewLayer.videoGravity)")
                if let connection = self.previewLayer.connection {
                    print("📹   - Video orientation: \(connection.videoOrientation.rawValue)")
                }
                print("📹   - Session preset: \(session.sessionPreset.rawValue)")
                print("📹   - Session running: \(session.isRunning)")
            }
        }
    }
}
