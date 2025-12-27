//
//  Server_for_animationsApp.swift
//  Server for animations
//
//  Created by Durrell Bishop on 25/12/2025.
//

import SwiftUI

@main
struct Server_for_animationsApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 800, minHeight: 600)
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .newItem) { }
        }
    }
}
