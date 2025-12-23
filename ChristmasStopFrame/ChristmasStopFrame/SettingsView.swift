//
//  SettingsView.swift
//  ChristmasStopFrame
//
//  Created by Durrell Bishop on 21/12/2025.
//

import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) var dismiss
    @ObservedObject var settings = SettingsManager.shared

    var body: some View {
        NavigationView {
            List {
                Section(header: Text("Recognition")) {
                    Picker("Recognition Type", selection: $settings.recognitionType) {
                        ForEach(RecognitionType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(.menu)

                    HStack {
                        Text("Capture Delay")
                        Spacer()
                        Text("\(settings.captureDelay, specifier: "%.1f")s")
                            .foregroundColor(.gray)
                    }

                    Slider(value: $settings.captureDelay, in: 0.1...3.0, step: 0.1)
                }

                if settings.recognitionType == .colorSample {
                    Section(header: Text("Color Target")) {
                        ColorPicker("Target Color",
                                  selection: Binding(
                                    get: {
                                        Color(
                                            red: settings.targetColor.red,
                                            green: settings.targetColor.green,
                                            blue: settings.targetColor.blue
                                        )
                                    },
                                    set: { newColor in
                                        let components = UIColor(newColor).cgColor.components ?? [1, 0, 0, 1]
                                        settings.targetColor = (
                                            red: Double(components[0]),
                                            green: Double(components[1]),
                                            blue: Double(components[2])
                                        )
                                    }
                                  ))
                    }
                }

                Section(header: Text("About")) {
                    HStack {
                        Text("App Name")
                        Spacer()
                        Text("Christmas Stop Frame")
                            .foregroundColor(.gray)
                    }
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0")
                            .foregroundColor(.gray)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}
