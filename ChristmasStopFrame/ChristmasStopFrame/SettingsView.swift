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

                Section(header: Text("Camera")) {
                    Toggle("Kaleidoscope Effect", isOn: $settings.kaleidoscopeEnabled)

                    HStack {
                        Text("Zoom")
                        Spacer()
                        Text("\(settings.zoomFactor, specifier: "%.1f")x")
                            .foregroundColor(.gray)
                    }
                    Slider(value: $settings.zoomFactor, in: 1.0...3.0, step: 0.1)
                }

                Section(header: Text("Network Broadcasting")) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Server Address")
                        TextField("e.g. 192.168.1.10:8080", text: $settings.serverAddress)
                            .textFieldStyle(.roundedBorder)
                            .autocapitalization(.none)
                            .keyboardType(.URL)
                    }

                    Text("Enter the IP:port shown on the Mac server app")
                        .font(.caption)
                        .foregroundColor(.gray)
                }

                Section(header: Text("Frame Overlay")) {
                    HStack {
                        Text("Top Thickness")
                        Spacer()
                        Text("\(Int(settings.frameBottomThickness))px")
                            .foregroundColor(.gray)
                    }
                    Slider(value: $settings.frameBottomThickness, in: 0...200, step: 10)

                    HStack {
                        Text("Bottom Thickness")
                        Spacer()
                        Text("\(Int(settings.frameTopThickness))px")
                            .foregroundColor(.gray)
                    }
                    Slider(value: $settings.frameTopThickness, in: 0...200, step: 10)
                }

                Section(header: Text("Playback")) {
                    Toggle("6 FPS (slower)", isOn: Binding(
                        get: { settings.frameRate == 6.0 },
                        set: { settings.frameRate = $0 ? 6.0 : 12.0 }
                    ))
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
        .rotationEffect(.degrees(180))
    }
}
