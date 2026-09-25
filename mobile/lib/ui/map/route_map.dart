import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../format.dart';
import '../motion.dart';
import '../theme.dart';
import 'map_data.dart';
import 'places.dart';

/// A map in the plain style of a ride-hailing app: pale grey land, soft
/// water, white roads, small grey town names, and the route in ink.
@immutable
class RouteMapStyle {
  const RouteMapStyle({
    required this.water,
    required this.land,
    required this.road,
    required this.roadCasing,
    required this.border,
    required this.river,
    required this.label,
    required this.route,
    required this.behind,
    required this.onRoute,
  });

  final Color water;
  final Color land;
  final Color road;
  final Color roadCasing;
  final Color border;
  final Color river;
  final Color label;

  /// The way still ahead, the markers and the callouts.
  final Color route;

  /// The way already travelled.
  final Color behind;

  /// Text and icons on [route]-coloured shapes.
  final Color onRoute;

  static const light = RouteMapStyle(
    water: Color(0xFFD3DDE6),
    land: Color(0xFFF8F7F4),
    road: Color(0xFFFFFFFF),
    roadCasing: Color(0xFFDDDDDB),
    border: Color(0xFFBDBDBD),
    river: Color(0xFFD3DDE6),
    label: Color(0xFF8A8A8A),
    route: Color(0xFF000000),
    behind: Color(0xFFB4B4B4),
    onRoute: Color(0xFFFFFFFF),
  );

  static const dark = RouteMapStyle(
    water: Color(0xFF0C0F13),
    land: Color(0xFF1B1B1D),
    road: Color(0xFF2E2E31),
    roadCasing: Color(0xFF1B1B1D),
    border: Color(0xFF3E3E42),
    river: Color(0xFF0C0F13),
    label: Color(0xFF7C7C82),
    route: Color(0xFFFFFFFF),
    behind: Color(0xFF55555A),
    onRoute: Color(0xFF000000),
  );

  /// Inside the dark pass.
  static const pass = dark;

  /// On an ordinary page, following light or dark mode.
  factory RouteMapStyle.page(Palette p) => p.isDark ? dark : light;
}

/// The frame a map is drawn in: Web Mercator, scaled and shifted so the
/// given points sit comfortably inside [size].
class _Frame {
  _Frame(this.size, this.left, this.top, this.scale);
  final Size size;
  final double left;
  final double top;

  /// Screen pixels per degree of longitude.
  final double scale;

  Offset toScreen(double lat, double lon) => Offset((lon - left) * scale, (mercatorY(lat) - top) * scale);

  String get key =>
      '${size.width.round()}x${size.height.round()}:${left.toStringAsFixed(3)},${top.toStringAsFixed(3)},${scale.toStringAsFixed(2)}';

  /// Fits [points] with padding, never showing less than [minSpan] degrees
  /// of longitude, so there is always enough map around a route to read.
  static _Frame fit(Size size, List<GeoPoint> points, {required double minSpan}) {
    var west = points.map((p) => p.lon).reduce(math.min);
    var east = points.map((p) => p.lon).reduce(math.max);
    var north = points.map((p) => mercatorY(p.lat)).reduce(math.min);
    var south = points.map((p) => mercatorY(p.lat)).reduce(math.max);
    final padX = math.max((east - west) * 0.3, (minSpan - (east - west)) / 2);
    final padY = math.max((south - north) * 0.3, (minSpan * 0.3 - (south - north)) / 2);
    west -= padX;
    east += padX;
    north -= padY;
    south += padY;
    final aspect = size.width / size.height;
    if ((east - west) / (south - north) > aspect) {
      final grow = ((east - west) / aspect - (south - north)) / 2;
      north -= grow;
      south += grow;
    } else {
      final grow = ((south - north) * aspect - (east - west)) / 2;
      west -= grow;
      east += grow;
    }
    return _Frame(size, west, north, size.width / (east - west));
  }

  /// Fits [points] inside [area] of a canvas of [size]: the map still fills
  /// the canvas, but the points sit where [area] is.
  static _Frame fitIn(Size size, Rect area, List<GeoPoint> points, {required double minSpan}) {
    final inner = fit(area.size, points, minSpan: minSpan);
    return _Frame(size, inner.left - area.left / inner.scale, inner.top - area.top / inner.scale, inner.scale);
  }
}

/// A shipment's journey on a real map: the land, water, roads and towns it
/// crosses, the route in ink from origin (a dot) to destination (a square),
/// greyed behind the cargo, and the cargo itself as a small disc.
///
/// Drawn only when both ends are known places ([RouteMap.canDraw]); an end
/// beyond the map (Rotterdam, say) is placed at the edge, pointing the
/// right way.
class RouteMap extends StatefulWidget {
  const RouteMap({
    super.key,
    required this.origin,
    required this.destination,
    this.current,
    required this.progress,
    required this.vehicle,
    this.delivered = false,
    this.attention = false,
    this.style = RouteMapStyle.pass,
  });

  final String origin;
  final String destination;

  /// Where the cargo is now, if that is a known place on the way.
  final String? current;

  /// How far along, 0–1, when [current] is not a known place.
  final double progress;
  final IconData vehicle;
  final bool delivered;

  /// Something has gone wrong: the cargo's disc is crimson.
  final bool attention;
  final RouteMapStyle style;

  static bool canDraw(String origin, String destination) {
    final from = locate(origin);
    final to = locate(destination);
    if (from == null || to == null) return false;
    if (!from.onMap && !to.onMap) return false;
    return (from.lat - to.lat).abs() + (from.lon - to.lon).abs() > 0.2;
  }

  @override
  State<RouteMap> createState() => _RouteMapState();
}

// The route is drawn where it stands: where the cargo is, is data, and data
// does not animate for style. Only the map itself fades in, once, when its
// data first loads, so it arrives rather than popping.
class _RouteMapState extends State<RouteMap> {
  MapData? _map = MapData.ready;

  @override
  void initState() {
    super.initState();
    if (_map == null) {
      MapData.load().then((map) {
        if (mounted) setState(() => _map = map);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final geometry = _Geometry.fit(
          constraints.biggest,
          origin: widget.origin,
          destination: widget.destination,
          current: widget.current,
          progress: widget.progress,
          delivered: widget.delivered,
        );
        if (geometry == null) return const SizedBox.shrink();
        final text = Theme.of(context).textTheme.labelSmall ?? const TextStyle();
        return Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: widget.style.land),
            AnimatedOpacity(
              opacity: _map == null ? 0 : 1,
              duration: const Duration(milliseconds: 200),
              curve: Motion.easeOut,
              child: RepaintBoundary(
                child: CustomPaint(painter: _MapPainter(_map, geometry.frame, widget.style, text, avoid: geometry.clearOf)),
              ),
            ),
            RepaintBoundary(
              child: CustomPaint(
                painter: _RoutePainter(
                  geometry: geometry,
                  style: widget.style,
                  vehicle: widget.vehicle,
                  delivered: widget.delivered,
                  attention: widget.attention ? Theme.of(context).extension<Palette>()!.accent : null,
                  text: text,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// A route's ends and the cargo, resolved to places on the map.
class _Ends {
  _Ends(this.a, this.b, this.c, this.progress);
  final GeoPoint a;
  final GeoPoint b;

  /// Where the cargo is, when that is a known place clear of both ends.
  final GeoPoint? c;
  final double progress;

  /// The points a frame must show.
  List<GeoPoint> get points => [a, b, ?c].where((p) => p.onMap).toList();

  static _Ends? of(String origin, String destination, String? current, double progress, bool delivered) {
    final a = locate(origin);
    final b = locate(destination);
    if (a == null || b == null || (!a.onMap && !b.onMap)) return null;
    var c = delivered ? null : locate(current);
    // At a border post beside either end, the cargo is shown just off it.
    if (c != null && _Geometry._near(c, b)) progress = 0.9;
    if (c != null && _Geometry._near(c, a)) progress = 0.06;
    if (c != null && (!c.onMap || _Geometry._near(c, a) || _Geometry._near(c, b))) c = null;
    return _Ends(a, b, c, progress);
  }
}

/// Where the route sits on screen for one frame.
class _Geometry {
  _Geometry({
    required this.frame,
    required this.path,
    required this.travelled,
    required this.from,
    required this.to,
    required this.fromLabel,
    required this.toLabel,
  });

  final _Frame frame;
  final Path path;

  /// Length along [path] the cargo has covered.
  final double travelled;
  final Offset from;
  final Offset to;
  final String fromLabel;
  final String toLabel;

  late final ui.PathMetric metric = path.computeMetrics().first;

  /// Points town names keep clear of: the ends and the route between them.
  late final List<Offset> clearOf = [from, to, for (var d = 0.0; d < metric.length; d += 14) metric.getTangentForOffset(d)!.position];

  static _Geometry? fit(
    Size size, {
    required String origin,
    required String destination,
    String? current,
    required double progress,
    required bool delivered,
  }) {
    if (!size.isFinite || size.width < 40 || size.height < 40) return null;
    final ends = _Ends.of(origin, destination, current, progress, delivered);
    if (ends == null) return null;
    final frame = _Frame.fit(size, ends.points, minSpan: 9);
    return build(frame, (Offset.zero & size).deflate(18), ends, origin: origin, destination: destination, delivered: delivered);
  }

  /// The route for [ends], drawn in an existing [frame]; an end outside
  /// [area] is pulled to its edge.
  static _Geometry? build(
    _Frame frame,
    Rect area,
    _Ends ends, {
    required String origin,
    required String destination,
    required bool delivered,
  }) {
    final a = ends.a;
    final b = ends.b;
    final c = ends.c;
    final progress = ends.progress;
    var from = frame.toScreen(a.lat, a.lon);
    var to = frame.toScreen(b.lat, b.lon);
    if (!a.onMap || !area.contains(from)) from = _toEdge(to, from, area);
    if (!b.onMap || !area.contains(to)) to = _toEdge(from, to, area);
    final now = c == null ? null : frame.toScreen(c.lat, c.lon);

    final path = Path()..moveTo(from.dx, from.dy);
    if (now != null) {
      bow(path, from, now, 0.1);
      bow(path, now, to, 0.1);
    } else {
      bow(path, from, to, 0.12);
    }
    final metrics = path.computeMetrics().toList();
    if (metrics.isEmpty) return null;
    final length = metrics.first.length;
    double travelled;
    if (delivered) {
      travelled = length;
    } else if (now != null) {
      final first = Path()..moveTo(from.dx, from.dy);
      bow(first, from, now, 0.1);
      travelled = first.computeMetrics().first.length;
    } else {
      travelled = length * progress.clamp(0.0, 1.0);
    }
    return _Geometry(
      frame: frame,
      path: path,
      travelled: travelled,
      from: from,
      to: to,
      fromLabel: place(origin),
      toLabel: place(destination),
    );
  }

  static bool _near(GeoPoint x, GeoPoint y) => (x.lat - y.lat).abs() + (x.lon - y.lon).abs() < 0.4;

  /// A gentle arc between two points, bowed to the north.
  static void bow(Path path, Offset from, Offset to, double amount) {
    final mid = (from + to) / 2;
    final delta = to - from;
    var normal = Offset(delta.dy, -delta.dx);
    if (normal.dy > 0) normal = -normal;
    final control = mid + normal * amount;
    path.quadraticBezierTo(control.dx, control.dy, to.dx, to.dy);
  }

  /// Where the line from [inside] towards [outside] crosses [frame].
  static Offset _toEdge(Offset inside, Offset outside, Rect frame) {
    final d = outside - inside;
    var t = 1.0;
    if (d.dx > 0) t = math.min(t, (frame.right - inside.dx) / d.dx);
    if (d.dx < 0) t = math.min(t, (frame.left - inside.dx) / d.dx);
    if (d.dy > 0) t = math.min(t, (frame.bottom - inside.dy) / d.dy);
    if (d.dy < 0) t = math.min(t, (frame.top - inside.dy) / d.dy);
    return inside + d * t.clamp(0.0, 1.0);
  }
}

/// The basemap: water, land, lakes, rivers, borders, roads and town names,
/// with detail added as the frame zooms in.
class _MapPainter extends CustomPainter {
  _MapPainter(this.map, this.frame, this.style, this.text, {this.avoid = const []});
  final MapData? map;
  final _Frame frame;
  final RouteMapStyle style;
  final TextStyle text;

  /// Screen points town names keep clear of (the route's ends).
  final List<Offset> avoid;

  @override
  void paint(Canvas canvas, Size size) {
    final bounds = Offset.zero & size;
    final map = this.map;
    canvas.drawRect(bounds, Paint()..color = map == null ? style.land : style.water);
    if (map == null) return;
    final z = frame.scale; // pixels per degree
    // Paths are moved into screen pixels rather than drawn under a scaled
    // canvas: hairline strokes at a large scale break up on the web renderer.
    final matrix = (Matrix4.diagonal3Values(z, z, 1)..translateByDouble(-frame.left, -frame.top, 0, 1)).storage;
    Path screen(Path path) => path.transform(matrix);
    Paint stroke(Color color, double px) => Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = px
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.save();
    canvas.clipRect(bounds);
    canvas.drawPath(screen(map.land), Paint()..color = style.land);
    canvas.drawPath(screen(map.lakes), Paint()..color = style.water);
    canvas.drawPath(screen(map.riversMajor), stroke(style.river, 1.4));
    if (z > 30) canvas.drawPath(screen(map.riversMinor), stroke(style.river, 1));
    if (z > 22) canvas.drawPath(screen(map.states), stroke(style.border.withValues(alpha: 0.45), 0.6));
    canvas.drawPath(screen(map.borders), stroke(style.border, 1));
    // Roads: a casing under a white line, heavier for highways.
    final roads = [
      (screen(map.roadsMajor), 2.2, true),
      if (z > 14) (screen(map.roadsMid), 1.4, true),
      if (z > 34) (screen(map.roadsMinor), 1.0, false),
    ];
    for (final (path, width, cased) in roads) {
      if (cased) canvas.drawPath(path, stroke(style.roadCasing, width + 1.2));
    }
    for (final (path, width, _) in roads) {
      canvas.drawPath(path, stroke(style.road, width));
    }
    canvas.restore();

    // Town names: the biggest first, never overlapping each other or the
    // route's ends, and more of them as the map zooms in.
    final maxRank = z < 16 ? 3 : (z < 28 ? 5 : (z < 60 ? 7 : 10));
    final placed = <Rect>[for (final (i, point) in avoid.indexed) Rect.fromCircle(center: point, radius: i < 2 ? 26 : 9)];
    var shown = 0;
    for (final town in map.places) {
      if (town.rank > maxRank || shown >= 12) continue;
      final at = frame.toScreen(town.lat, town.lon);
      if (!bounds.deflate(12).contains(at)) continue;
      final painter = TextPainter(
        text: TextSpan(
          text: town.name,
          style: text.copyWith(fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: 0, color: style.label),
        ),
        textDirection: TextDirection.ltr,
        maxLines: 1,
      )..layout();
      final rect = Rect.fromCenter(center: at, width: painter.width + 6, height: painter.height + 2);
      if (!bounds.contains(rect.topLeft) || !bounds.contains(rect.bottomRight)) continue;
      if (placed.any((r) => r.overlaps(rect))) continue;
      placed.add(rect);
      painter.paint(canvas, rect.center - Offset(painter.width / 2, painter.height / 2));
      shown++;
    }
  }

  @override
  bool shouldRepaint(_MapPainter old) => old.map != map || old.frame.key != frame.key || old.style != style;
}

class _RoutePainter extends CustomPainter {
  _RoutePainter({
    required this.geometry,
    required this.style,
    required this.vehicle,
    required this.delivered,
    required this.attention,
    required this.text,
  });

  final _Geometry geometry;
  final RouteMapStyle style;
  final IconData vehicle;
  final bool delivered;

  /// The cargo's colour when something has gone wrong.
  final Color? attention;
  final TextStyle text;

  @override
  void paint(Canvas canvas, Size size) {
    final metric = geometry.metric;
    const t = 1.0;
    final length = metric.length;
    // Behind the cargo in grey, ahead of it in ink.
    final shown = length * t;
    final head = math.min(shown, geometry.travelled);
    Paint line(Color color) => Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.2
      ..strokeCap = StrokeCap.round;
    if (head > 0.5) canvas.drawPath(metric.extractPath(0, head), line(style.behind));
    if (shown > head) canvas.drawPath(metric.extractPath(head, shown), line(style.route));

    _origin(canvas, geometry.from);
    if (t > 0.98) _destination(canvas, geometry.to);
    final cargo = delivered ? null : metric.getTangentForOffset(math.max(head, 0.01))!.position;
    _callout(canvas, size, geometry.fromLabel, geometry.from, other: geometry.to, cargo: cargo);
    if (t > 0.98) _callout(canvas, size, geometry.toLabel, geometry.to, other: geometry.from, cargo: cargo);
    if (cargo != null) _cargo(canvas, cargo);
  }

  /// Origin: a dot with a hole.
  void _origin(Canvas canvas, Offset at) {
    canvas.drawCircle(at, 5.5, Paint()..color = style.route);
    canvas.drawCircle(at, 2, Paint()..color = style.onRoute);
  }

  /// Destination: a square with a hole.
  void _destination(Canvas canvas, Offset at) {
    canvas.drawRect(Rect.fromCenter(center: at, width: 11, height: 11), Paint()..color = style.route);
    canvas.drawRect(Rect.fromCenter(center: at, width: 4, height: 4), Paint()..color = style.onRoute);
  }

  /// The cargo: a small disc with the mode's icon, lifted by a soft shadow.
  void _cargo(Canvas canvas, Offset at) {
    final fill = attention ?? style.route;
    canvas.drawCircle(
      at + const Offset(0, 1.5),
      11,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.25)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
    );
    canvas.drawCircle(at, 11, Paint()..color = fill);
    final icon = TextPainter(
      text: TextSpan(
        text: String.fromCharCode(vehicle.codePoint),
        style: TextStyle(
          fontFamily: vehicle.fontFamily,
          package: vehicle.fontPackage,
          fontSize: 12,
          color: attention != null ? Colors.white : style.onRoute,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    icon.paint(canvas, at - Offset(icon.width / 2, icon.height / 2));
  }

  /// A small ink label above a marker (below it when there is no room, or
  /// when the route leaves upwards).
  void _callout(Canvas canvas, Size size, String label, Offset at, {required Offset other, Offset? cargo}) {
    if (label.isEmpty) return;
    final painter = TextPainter(
      text: TextSpan(
        text: label,
        style: text.copyWith(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0, color: style.onRoute),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
      ellipsis: '…',
    )..layout(maxWidth: size.width * 0.4);
    final w = painter.width + 14;
    final h = painter.height + 8;
    final above = other.dy > at.dy - 4 && at.dy - 14 - h > 2;
    var top = above ? at.dy - 12 - h : at.dy + 12;
    var left = at.dx - w / 2;
    // With the cargo at this end, the label moves beside the marker, on the
    // side away from it.
    if (cargo != null && (cargo - at).distance < 34) {
      top = at.dy - h / 2;
      left = cargo.dx <= at.dx ? at.dx + 12 : at.dx - 12 - w;
      if (left + w > size.width - 4) left = at.dx - 12 - w;
      if (left < 4) left = at.dx + 12;
    }
    left = left.clamp(4.0, size.width - w - 4);
    top = top.clamp(4.0, size.height - h - 4);
    final rect = RRect.fromRectAndRadius(Rect.fromLTWH(left, top, w, h), const Radius.circular(6));
    canvas.drawRRect(
      rect.shift(const Offset(0, 1)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.18)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2),
    );
    canvas.drawRRect(rect, Paint()..color = style.route);
    painter.paint(canvas, Offset(left + 7, top + 4));
  }

  @override
  bool shouldRepaint(_RoutePainter old) =>
      old.geometry.frame.key != geometry.frame.key ||
      old.geometry.travelled != geometry.travelled ||
      old.style != style ||
      old.vehicle != vehicle ||
      old.delivered != delivered ||
      old.attention != attention;
}

/// One shipment on a [FleetMap].
@immutable
class FleetRoute {
  const FleetRoute({
    required this.id,
    required this.origin,
    required this.destination,
    this.current,
    required this.progress,
    required this.vehicle,
    this.delivered = false,
    this.attention = false,
  });

  final String id;
  final String origin;
  final String destination;
  final String? current;
  final double progress;
  final IconData vehicle;
  final bool delivered;
  final bool attention;
}

/// Every moving shipment on one map, as a ride-hailing app shows the cars
/// around you: each route a fine line with its cargo on it, and the one in
/// focus drawn in full, in ink, with its ends named.
class FleetMap extends StatefulWidget {
  const FleetMap({super.key, required this.routes, this.focus, required this.style, this.padding = EdgeInsets.zero});

  final List<FleetRoute> routes;

  /// The [FleetRoute.id] drawn in full; the first route when null.
  final String? focus;
  final RouteMapStyle style;

  /// Space the routes keep clear of, such as a top bar and a sheet. The map
  /// itself still runs beneath.
  final EdgeInsets padding;

  @override
  State<FleetMap> createState() => _FleetMapState();
}

class _FleetMapState extends State<FleetMap> {
  MapData? _map = MapData.ready;

  @override
  void initState() {
    super.initState();
    if (_map == null) {
      MapData.load().then((map) {
        if (mounted) setState(() => _map = map);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        if (!size.isFinite || size.width < 40 || size.height < 40) return const SizedBox.shrink();
        var area = widget.padding.deflateRect(Offset.zero & size);
        if (area.width < 80 || area.height < 80) area = Offset.zero & size;

        final resolved = <(FleetRoute, _Ends)>[
          for (final route in widget.routes)
            if (_Ends.of(route.origin, route.destination, route.current, route.progress, route.delivered) case final ends?) (route, ends),
        ];
        // Framed on the route in focus and where every route ends (Nepal):
        // a far-off origin is pulled to the map's edge, pointing the right
        // way, rather than zooming the map out to a continent. With nothing
        // to draw, the map rests on Nepal.
        final focus = resolved.where((r) => r.$1.id == widget.focus).firstOrNull ?? resolved.firstOrNull;
        final points = [
          ...?focus?.$2.points,
          for (final (_, ends) in resolved)
            if (ends.b.onMap) ends.b,
        ];
        final frame = _Frame.fitIn(size, area, points.isEmpty ? const [GeoPoint(27.7, 85.3)] : points, minSpan: points.isEmpty ? 8 : 7);

        final routes = <(FleetRoute, _Geometry)>[
          for (final (route, ends) in resolved)
            if (_Geometry.build(
                  frame,
                  area.deflate(6),
                  ends,
                  origin: route.origin,
                  destination: route.destination,
                  delivered: route.delivered,
                )
                case final geometry?)
              (route, geometry),
        ];
        final focused = routes.where((r) => r.$1.id == widget.focus).firstOrNull ?? routes.firstOrNull;
        final text = Theme.of(context).textTheme.labelSmall ?? const TextStyle();
        final accent = Theme.of(context).extension<Palette>()!.accent;
        return Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: widget.style.land),
            AnimatedOpacity(
              opacity: _map == null ? 0 : 1,
              duration: const Duration(milliseconds: 200),
              curve: Motion.easeOut,
              child: RepaintBoundary(
                child: CustomPaint(
                  painter: _MapPainter(
                    _map,
                    frame,
                    widget.style,
                    text,
                    avoid: [
                      ...?focused?.$2.clearOf,
                      for (final (_, geometry) in routes) ...[geometry.from, geometry.to],
                    ],
                  ),
                ),
              ),
            ),
            RepaintBoundary(
              child: CustomPaint(
                painter: _FleetPainter(routes: routes, focused: focused, style: widget.style, accent: accent, text: text),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _FleetPainter extends CustomPainter {
  _FleetPainter({required this.routes, required this.focused, required this.style, required this.accent, required this.text});

  final List<(FleetRoute, _Geometry)> routes;
  final (FleetRoute, _Geometry)? focused;
  final RouteMapStyle style;
  final Color accent;
  final TextStyle text;

  @override
  void paint(Canvas canvas, Size size) {
    // The others first, quietly: a fine line, a small square where each is
    // bound, and its cargo as a dot.
    final line = Paint()
      ..color = style.route.withValues(alpha: 0.28)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (final (route, geometry) in routes) {
      if (identical(route, focused?.$1)) continue;
      canvas.drawPath(geometry.path, line);
      canvas.drawRect(Rect.fromCenter(center: geometry.to, width: 6, height: 6), Paint()..color = style.route.withValues(alpha: 0.5));
      if (!route.delivered) {
        final at = geometry.metric.getTangentForOffset(math.max(geometry.travelled, 0.01))!.position;
        canvas.drawCircle(at, 6, Paint()..color = style.onRoute);
        canvas.drawCircle(at, 4.5, Paint()..color = route.attention ? accent : style.route.withValues(alpha: 0.7));
      }
    }
    // Then the one in focus, in full.
    final focus = focused;
    if (focus == null) return;
    _RoutePainter(
      geometry: focus.$2,
      style: style,
      vehicle: focus.$1.vehicle,
      delivered: focus.$1.delivered,
      attention: focus.$1.attention ? accent : null,
      text: text,
    ).paint(canvas, size);
  }

  @override
  bool shouldRepaint(_FleetPainter old) =>
      old.style != style ||
      old.focused?.$1.id != focused?.$1.id ||
      old.routes.length != routes.length ||
      (routes.isNotEmpty && old.routes.first.$2.frame.key != routes.first.$2.frame.key) ||
      [for (final r in routes) '${r.$1.id}:${r.$2.travelled}'].join() !=
          [for (final r in old.routes) '${r.$1.id}:${r.$2.travelled}'].join();
}

/// KCPL's lanes into Nepal on the map: the sign-in screen's backdrop. Each
/// lane is a fine ink line with a small dot travelling along it, staggered
/// so something is always arriving. Still under reduce-motion.
class AmbientRouteMap extends StatefulWidget {
  const AmbientRouteMap({super.key, required this.style});
  final RouteMapStyle style;

  static const lanes = [
    ('kolkata', 'birgunj'),
    ('haldia', 'biratnagar'),
    ('visakhapatnam', 'birgunj icd'),
    ('new delhi', 'bhairahawa'),
    ('mumbai', 'nepalgunj'),
    ('chittagong', 'kakarvitta'),
    ('lhasa', 'kathmandu'),
  ];

  @override
  State<AmbientRouteMap> createState() => _AmbientRouteMapState();
}

class _AmbientRouteMapState extends State<AmbientRouteMap> with SingleTickerProviderStateMixin {
  late final AnimationController _clock = AnimationController(vsync: this, duration: const Duration(seconds: 10));
  MapData? _map = MapData.ready;

  @override
  void initState() {
    super.initState();
    if (_map == null) {
      MapData.load().then((map) {
        if (mounted) setState(() => _map = map);
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _clock.stop();
      _clock.value = 0.35;
    } else if (!_clock.isAnimating) {
      _clock.repeat();
    }
  }

  @override
  void dispose() {
    _clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        if (!size.isFinite || size.width < 40 || size.height < 40) return const SizedBox.shrink();
        final frame = _Frame.fit(size, const [GeoPoint(21, 80), GeoPoint(30.5, 90)], minSpan: 12);
        final lanes = <Path>[];
        for (final (from, to) in AmbientRouteMap.lanes) {
          final a = locate(from)!;
          final b = locate(to)!;
          final start = frame.toScreen(a.lat, a.lon);
          final path = Path()..moveTo(start.dx, start.dy);
          _Geometry.bow(path, start, frame.toScreen(b.lat, b.lon), 0.14);
          lanes.add(path);
        }
        final text = Theme.of(context).textTheme.labelSmall ?? const TextStyle();
        return ClipRect(
          child: Stack(
            fit: StackFit.expand,
            children: [
              RepaintBoundary(
                child: CustomPaint(
                  // Town names keep clear of where the lanes begin and end.
                  painter: _MapPainter(
                    _map,
                    frame,
                    widget.style,
                    text,
                    avoid: [
                      for (final lane in lanes)
                        for (final metric in lane.computeMetrics()) ...[
                          metric.getTangentForOffset(0)!.position,
                          metric.getTangentForOffset(metric.length)!.position,
                        ],
                    ],
                  ),
                ),
              ),
              RepaintBoundary(child: CustomPaint(painter: _LanesPainter(lanes, _clock, widget.style))),
            ],
          ),
        );
      },
    );
  }
}

class _LanesPainter extends CustomPainter {
  _LanesPainter(this.lanes, this.clock, this.style) : super(repaint: clock);
  final List<Path> lanes;
  final Animation<double> clock;
  final RouteMapStyle style;

  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = style.route.withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < lanes.length; i++) {
      final metric = lanes[i].computeMetrics().first;
      canvas.drawPath(lanes[i], line);
      final end = metric.getTangentForOffset(metric.length)!.position;
      canvas.drawRect(Rect.fromCenter(center: end, width: 6, height: 6), Paint()..color = style.route);
      // Each lane's dot sets off at its own moment and takes 60% of the
      // cycle to arrive.
      final t = ((clock.value + i * 0.37) % 1.0) / 0.6;
      if (t > 1) continue;
      final at = metric.getTangentForOffset(metric.length * Curves.easeInOut.transform(t))!.position;
      final fade = math.sin(t * math.pi);
      canvas.drawCircle(at, 3.5, Paint()..color = style.route.withValues(alpha: fade));
    }
  }

  @override
  bool shouldRepaint(_LanesPainter old) => old.lanes != lanes || old.style != style;
}
