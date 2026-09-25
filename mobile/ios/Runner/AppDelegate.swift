import Flutter
import UIKit
import Vision
#if canImport(ActivityKit)
import ActivityKit
#endif

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
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "KcplLiveActivity") {
      LiveActivityChannel.register(with: registrar.messenger())
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

// MARK: - Live Activities

#if canImport(ActivityKit)
/// A shipment on the Lock Screen and in the Dynamic Island.
///
/// The same type is declared in ios/KCPLWidget/KCPLWidget.swift, which draws
/// it: ActivityKit matches the two by name and by their Codable shape, so
/// the fields must stay identical in both files. ContentState is what KCPL's
/// push updates carry (app/mobile-push-policy.ts, liveActivityState).
@available(iOS 16.1, *)
struct ShipmentActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var status: String
    var detail: String
    var progress: Double
    var attention: Bool
  }

  var reference: String
  var route: String
}
#endif

/// "kcpl/live_activity": start, update and end a shipment's Live Activity,
/// and hand back the push token KCPL updates it through. Reports itself
/// unsupported before iOS 16.2, or when Live Activities are off in Settings.
enum LiveActivityChannel {
  static func register(with messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: "kcpl/live_activity", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        LiveActivityBridge.handle(call, result: result)
        return
      }
      #endif
      switch call.method {
      case "supported": result(false)
      case "running": result([[String: Any]]())
      default: result(nil)
      }
    }
  }
}

#if canImport(ActivityKit)
@available(iOS 16.2, *)
enum LiveActivityBridge {
  typealias Shipment = Activity<ShipmentActivityAttributes>

  static func state(_ arguments: [String: Any]) -> ShipmentActivityAttributes.ContentState {
    ShipmentActivityAttributes.ContentState(
      status: arguments["status"] as? String ?? "",
      detail: arguments["detail"] as? String ?? "",
      progress: (arguments["progress"] as? NSNumber)?.doubleValue ?? 0,
      attention: arguments["attention"] as? Bool ?? false)
  }

  static func row(_ activity: Shipment, token: Data?) -> [String: Any] {
    var row: [String: Any] = ["id": activity.id, "reference": activity.attributes.reference]
    if let token { row["token"] = token.map { String(format: "%02x", $0) }.joined() }
    return row
  }

  static func find(_ arguments: [String: Any]) -> Shipment? {
    let id = arguments["id"] as? String
    return Shipment.activities.first { $0.id == id }
  }

  static func reply(_ result: @escaping FlutterResult, _ value: Any?) {
    DispatchQueue.main.async { result(value) }
  }

  static func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let arguments = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "supported":
      result(ActivityAuthorizationInfo().areActivitiesEnabled)
    case "running":
      result(Shipment.activities.map { row($0, token: $0.pushToken) })
    case "start":
      guard let reference = arguments["reference"] as? String else {
        result(nil)
        return
      }
      let content = ActivityContent(state: state(arguments), staleDate: nil)
      // One activity per shipment: following it again brings it up to date.
      if let existing = Shipment.activities.first(where: { $0.attributes.reference == reference }) {
        Task {
          await existing.update(content)
          reply(result, row(existing, token: await firstToken(existing)))
        }
        return
      }
      do {
        let activity = try Activity.request(
          attributes: ShipmentActivityAttributes(reference: reference, route: arguments["route"] as? String ?? ""),
          content: content,
          pushType: .token)
        Task { reply(result, row(activity, token: await firstToken(activity))) }
      } catch {
        result(FlutterError(code: "unavailable", message: error.localizedDescription, details: nil))
      }
    case "update":
      guard let activity = find(arguments) else {
        result(nil)
        return
      }
      Task {
        await activity.update(ActivityContent(state: state(arguments), staleDate: nil))
        reply(result, nil)
      }
    case "end":
      guard let activity = find(arguments) else {
        result(nil)
        return
      }
      Task {
        await activity.end(nil, dismissalPolicy: .immediate)
        reply(result, nil)
      }
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  /// The push token arrives a moment after the activity starts. Waits up to
  /// ten seconds; without one the activity still runs, updated by the app.
  static func firstToken(_ activity: Shipment) async -> Data? {
    if let token = activity.pushToken { return token }
    return await withTaskGroup(of: Data?.self) { group in
      group.addTask {
        for await token in activity.pushTokenUpdates { return token }
        return nil
      }
      group.addTask {
        try? await Task.sleep(nanoseconds: 10_000_000_000)
        return nil
      }
      let first = await group.next() ?? nil
      group.cancelAll()
      return first
    }
  }
}
#endif
