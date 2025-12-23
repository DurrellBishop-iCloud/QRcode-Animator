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
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)

        print("📹 CameraPreview makeUIView - frame: \(view.bounds), layer frame: \(previewLayer.frame)")
        print("📹 Preview layer connection: \(previewLayer.connection?.isEnabled ?? false), session running: \(previewLayer.session?.isRunning ?? false)")

        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        DispatchQueue.main.async {
            self.previewLayer.frame = uiView.bounds
            print("📹 CameraPreview updateUIView - view bounds: \(uiView.bounds), layer frame: \(self.previewLayer.frame)")
            print("📹 View isHidden: \(uiView.isHidden), alpha: \(uiView.alpha), superview: \(uiView.superview != nil)")
            print("📹 Session running: \(self.previewLayer.session?.isRunning ?? false)")

            if let session = self.previewLayer.session {
                print("📹 Session inputs: \(session.inputs.count), outputs: \(session.outputs.count)")
            }
        }
    }
}
