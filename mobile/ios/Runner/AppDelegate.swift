import Flutter
import UIKit
import Vision

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "KcplTextRecognition") {
      TextRecognition.register(with: registrar.messenger())
    }
  }
}

/// Reads the text in a photo on the phone, with Apple's Vision: a container
/// number painted on a door, a reference on a document. Nothing leaves the
/// phone. The Android side is in MainActivity.kt.
enum TextRecognition {
  static func register(with messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: "kcpl/text", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      guard call.method == "recognize" else {
        result(FlutterMethodNotImplemented)
        return
      }
      guard
        let arguments = call.arguments as? [String: Any],
        let path = arguments["path"] as? String,
        let image = UIImage(contentsOfFile: path),
        let cgImage = image.cgImage
      else {
        result([String]())
        return
      }
      let orientation = CGImagePropertyOrientation(image.imageOrientation)
      DispatchQueue.global(qos: .userInitiated).async {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        // Container numbers and references are codes, not words.
        request.usesLanguageCorrection = false
        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
        var lines: [String] = []
        if (try? handler.perform([request])) != nil {
          lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
        }
        DispatchQueue.main.async { result(lines) }
      }
    }
  }
}

extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .down: self = .down
    case .left: self = .left
    case .right: self = .right
    case .upMirrored: self = .upMirrored
    case .downMirrored: self = .downMirrored
    case .leftMirrored: self = .leftMirrored
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
