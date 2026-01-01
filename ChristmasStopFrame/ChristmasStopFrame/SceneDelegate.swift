//
//  SceneDelegate.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import UIKit
import SwiftUI

// Custom hosting controller that always fills its parent
class FullScreenHostingController<Content: View>: UIHostingController<Content> {
    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        if let parent = view.superview {
            view.frame = parent.bounds
        }
    }

    override var preferredContentSize: CGSize {
        get {
            return view.superview?.bounds.size ?? super.preferredContentSize
        }
        set {
            // Ignore attempts to set content size
        }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        print("🚀 SceneDelegate: scene willConnectTo called")
        guard let windowScene = (scene as? UIWindowScene) else {
            print("❌ SceneDelegate: Failed to cast scene to UIWindowScene")
            return
        }
        print("🚀 SceneDelegate: Creating ContentView")
        let contentView = ContentView()

        print("🚀 SceneDelegate: Creating window and setting root view controller")
        let window = UIWindow(windowScene: windowScene)
        let hostingController = FullScreenHostingController(rootView: contentView)

        window.rootViewController = hostingController
        self.window = window
        window.makeKeyAndVisible()

        print("🚀 SceneDelegate: Window made key and visible with FullScreenHostingController")
    }

    func sceneDidDisconnect(_ scene: UIScene) {
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
    }

    func sceneWillResignActive(_ scene: UIScene) {
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
    }
}

