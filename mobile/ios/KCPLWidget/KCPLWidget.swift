// KCPL's home screen and lock screen widget.
//
// Not part of the Runner target: it is the source of a Widget Extension
// target that is added once in Xcode (see mobile/README.md, "Home screen
// widget"). The app writes the fields below through the home_widget package
// (lib/platform/home_widget_bridge.dart) into the shared App Group, already
// in the reader's language; this only draws them.

import ActivityKit
import SwiftUI
import WidgetKit

private let appGroup = "group.np.com.kapileshworcargo.kcpl"
private let crimson = Color(red: 220 / 255, green: 20 / 255, blue: 60 / 255)

struct ShipmentEntry: TimelineEntry {
  let date: Date
  let reference: String?
  let route: String
  let status: String
  let detail: String
  let progress: Double
  let attention: Bool
  let summary: String

  static let placeholder = ShipmentEntry(
    date: .now, reference: "KCPL-S-24091", route: "Kolkata – Birgunj ICD", status: "Customs clearance",
    detail: "Now at Birgunj ICD", progress: 0.66, attention: false, summary: "4 shipments on the way")

  static func read() -> ShipmentEntry {
    let data = UserDefaults(suiteName: appGroup)
    return ShipmentEntry(
      date: .now,
      reference: data?.string(forKey: "kcpl_reference"),
      route: data?.string(forKey: "kcpl_route") ?? "Open KCPL to see your shipments",
      status: data?.string(forKey: "kcpl_status") ?? "",
      detail: data?.string(forKey: "kcpl_detail") ?? "",
      progress: Double(data?.integer(forKey: "kcpl_progress") ?? 0) / 100,
      attention: data?.bool(forKey: "kcpl_attention") ?? false,
      summary: data?.string(forKey: "kcpl_summary") ?? "")
  }
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> ShipmentEntry { .placeholder }

  func getSnapshot(in context: Context, completion: @escaping (ShipmentEntry) -> Void) {
    completion(context.isPreview ? .placeholder : .read())
  }

  // The app reloads the widget whenever it learns something new, so the
  // timeline never polls.
  func getTimeline(in context: Context, completion: @escaping (Timeline<ShipmentEntry>) -> Void) {
    completion(Timeline(entries: [.read()], policy: .never))
  }
}

struct ShipmentView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ShipmentEntry

  private var link: URL? {
    entry.reference.flatMap { URL(string: "kcpl://shipment/\($0)") }
  }

  var body: some View {
    Group {
      switch family {
      case .accessoryInline:
        Text(entry.status.isEmpty ? entry.route : "\(entry.route) · \(entry.status)")
      case .accessoryRectangular:
        VStack(alignment: .leading, spacing: 2) {
          Text(entry.route).font(.headline).lineLimit(1)
          Text(entry.status).lineLimit(1)
          if entry.reference != nil { ProgressView(value: entry.progress) }
        }
      default:
        VStack(alignment: .leading, spacing: 4) {
          HStack {
            Text(entry.reference ?? "").font(.caption).foregroundStyle(.secondary).lineLimit(1)
            Spacer()
            Text("KCPL").font(.caption.bold()).foregroundStyle(crimson)
          }
          Spacer(minLength: 0)
          Text(entry.route).font(.headline).lineLimit(family == .systemSmall ? 2 : 1)
          Text(entry.status).font(.subheadline).foregroundStyle(entry.attention ? crimson : .primary).lineLimit(1)
          if !entry.detail.isEmpty {
            Text(entry.detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
          }
          if entry.reference != nil {
            ProgressView(value: entry.progress).tint(crimson)
          }
          if family != .systemSmall && !entry.summary.isEmpty {
            Text(entry.summary).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
          }
        }
      }
    }
    .widgetURL(link)
    .containerBackground(for: .widget) { Color(.systemBackground) }
  }
}

@main
struct KCPLWidgets: WidgetBundle {
  var body: some Widget {
    KCPLWidget()
    ShipmentLiveActivity()
  }
}

struct KCPLWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "KCPLWidget", provider: Provider()) { entry in
      ShipmentView(entry: entry)
    }
    .configurationDisplayName("KCPL shipment")
    .description("Your shipment that needs a glance: where it is and when it arrives.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
  }
}

// MARK: - Live Activity

/// Declared identically in ios/Runner/AppDelegate.swift, which starts the
/// activity: ActivityKit matches the two by name and Codable shape, so keep
/// the fields the same in both files.
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

/// A followed shipment on the Lock Screen and in the Dynamic Island. KCPL
/// moves it with a push when the shipment moves, and ends it on delivery.
struct ShipmentLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ShipmentActivityAttributes.self) { context in
      LockScreenShipment(attributes: context.attributes, state: context.state)
        .widgetURL(URL(string: "kcpl://shipment/\(context.attributes.reference)"))
        .activityBackgroundTint(Color(.systemBackground))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text("KCPL").font(.caption.bold()).foregroundStyle(crimson)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(context.attributes.reference).font(.caption).foregroundStyle(.secondary).lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 4) {
            Text(context.attributes.route).font(.headline).lineLimit(1)
            HStack {
              Text(context.state.status).foregroundStyle(context.state.attention ? crimson : .primary)
              if !context.state.detail.isEmpty {
                Text("· \(context.state.detail)").foregroundStyle(.secondary)
              }
            }
            .font(.subheadline)
            .lineLimit(1)
            ProgressView(value: context.state.progress).tint(crimson)
          }
        }
      } compactLeading: {
        Text("K").font(.caption.bold()).foregroundStyle(crimson)
      } compactTrailing: {
        Text(context.state.status).font(.caption2).lineLimit(1).frame(maxWidth: 88)
      } minimal: {
        ProgressView(value: context.state.progress)
          .progressViewStyle(.circular)
          .tint(crimson)
      }
      .widgetURL(URL(string: "kcpl://shipment/\(context.attributes.reference)"))
      .keylineTint(crimson)
    }
  }
}

struct LockScreenShipment: View {
  let attributes: ShipmentActivityAttributes
  let state: ShipmentActivityAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text(attributes.reference).font(.caption).foregroundStyle(.secondary).lineLimit(1)
        Spacer()
        Text("KCPL").font(.caption.bold()).foregroundStyle(crimson)
      }
      Text(attributes.route).font(.headline).lineLimit(1)
      HStack(spacing: 4) {
        Text(state.status).foregroundStyle(state.attention ? crimson : .primary)
        if !state.detail.isEmpty {
          Text("· \(state.detail)").foregroundStyle(.secondary)
        }
      }
      .font(.subheadline)
      .lineLimit(1)
      ProgressView(value: state.progress).tint(crimson)
    }
    .padding(16)
  }
}
