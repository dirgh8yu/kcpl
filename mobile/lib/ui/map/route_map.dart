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
    water: Color(0xFFD4DCE3),
    land: Color(0xFFF2F2F0),
    road: Color(0xFFFFFFFF),
    roadCasing: Color(0xFFDDDDDB),
    border: Color(0xFFBDBDBD),
    river: Color(0xFFD4DCE3),
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
    this.reference,
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

  /// When given, the route draws itself in only the first time this
  /// shipment is shown in a session.
  final String? reference;

  static bool canDraw(String origin, String destination) {
    final from = locate(origin);
    final to = locate(destination);
    if (from == null || to == null) return false;
    if (!from.onMap && !to.onMap) return false;
    return (from.lat - to.lat).abs() + (from.lon - to.lon).abs() > 0.2;
  }

  static final Set<String> _drawn = {};

  @override
  State<RouteMap> createState() => _RouteMapState();
}

class _RouteMapState extends State<RouteMap> with SingleTickerProviderStateMixin {
  late final AnimationController _draw = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));
  MapData? _map = MapData.ready;
  bool _started = false;

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
    if (_started) return;
    _started = true;
    final seen = widget.reference != null && !RouteMap._drawn.add(widget.reference!);
    if (Motion.reduced(context) || seen) {
      _draw.value = 1;
    } else {
      _draw.forward();
    }
  }

  @override
  void dispose() {
    _draw.dispose();
    super.dispose();
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
            RepaintBoundary(
              child: CustomPaint(painter: _MapPainter(_map, geometry.frame, widget.style, text, avoid: geometry.clearOf)),
            ),
            RepaintBoundary(
              child: CustomPaint(
                painter: _RoutePainter(
                  geometry: geometry,
                  style: widget.style,
                  draw: CurvedAnimation(parent: _draw, curve: Motion.easeOut),
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
    final a = locate(origin);
    final b = locate(destination);
    if (a == null || b == null || (!a.onMap && !b.onMap)) return null;
    var c = delivered ? null : locate(current);
    // At a border post beside either end, the cargo is shown just off it.
    if (c != null && _near(c, b)) progress = 0.9;
    if (c != null && _near(c, a)) progress = 0.06;
    if (c != null && (!c.onMap || _near(c, a) || _near(c, b))) c = null;

    final frame = _Frame.fit(size, [a, b, ?c].where((p) => p.onMap).toList(), minSpan: 9);
    final inset = (Offset.zero & size).deflate(18);
    var from = frame.toScreen(a.lat, a.lon);
    var to = frame.toScreen(b.lat, b.lon);
    if (!a.onMap || !inset.contains(from)) from = _toEdge(to, from, inset);
    if (!b.onMap || !inset.contains(to)) to = _toEdge(from, to, inset);
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
    required this.draw,
    required this.vehicle,
    required this.delivered,
    required this.attention,
    required this.text,
  }) : super(repaint: draw);

  final _Geometry geometry;
  final RouteMapStyle style;
  final Animation<double> draw;
  final IconData vehicle;
  final bool delivered;

  /// The cargo's colour when something has gone wrong.
  final Color? attention;
  final TextStyle text;

  @override
  void paint(Canvas canvas, Size size) {
    final metric = geometry.metric;
    final t = draw.value;
    final length = metric.length;
    // The route draws out from the origin; the cargo rides its leading edge
    // until it reaches where it is.
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
