import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../format.dart';
import '../motion.dart';
import '../theme.dart';
import 'land_mask.dart' show nepalOutline;
import 'places.dart';

/// Colours for a route map on a given surface.
@immutable
class RouteMapStyle {
  const RouteMapStyle({
    required this.land,
    required this.nepal,
    required this.track,
    required this.route,
    required this.glow,
    required this.port,
    required this.label,
    required this.onVehicle,
    required this.halo,
    required this.border,
  });

  final Color land;
  final Color nepal;

  /// The part of the route still ahead.
  final Color track;

  /// The part travelled, and the vehicle.
  final Color route;
  final Color glow;
  final Color port;
  final Color label;
  final Color onVehicle;

  /// Behind labels, so they read over the dots.
  final Color halo;

  /// Nepal's border.
  final Color border;

  /// On the dark pass: dots of light on black, a crimson route that glows.
  static const pass = RouteMapStyle(
    land: Color(0x30FFFFFF),
    nepal: Color(0x8CFFFFFF),
    track: Color(0x40FFFFFF),
    route: PassColors.accent,
    glow: Color(0xFFFF2D55),
    port: Color(0xFFFFFFFF),
    label: Color(0xB3FFFFFF),
    onVehicle: Color(0xFFFFFFFF),
    halo: PassColors.base,
    border: Color(0x73FFFFFF),
  );

  /// On an ordinary page, light or dark.
  factory RouteMapStyle.page(Palette p) => RouteMapStyle(
    land: p.isDark ? const Color(0x26FFFFFF) : const Color(0xFFDADADF),
    nepal: p.isDark ? const Color(0x61FFFFFF) : const Color(0xFF9A9AA2),
    track: p.isDark ? const Color(0x47FFFFFF) : const Color(0xFFBDBDC4),
    route: p.accent,
    glow: p.glow,
    port: p.ink,
    label: p.secondary,
    onVehicle: Colors.white,
    halo: p.paper,
    border: p.isDark ? const Color(0x80FFFFFF) : const Color(0x66000000),
  );
}

/// A shipment's journey drawn on the map it actually crosses: a field of
/// dots for the land (Nepal a shade brighter), and a crimson arc from
/// origin to destination that glows where the cargo has already been.
///
/// Only drawn when both ends are known places ([RouteMap.canDraw]); a route
/// to somewhere off the map (Rotterdam, say) leaves it at the edge,
/// pointing the right way.
class RouteMap extends StatefulWidget {
  const RouteMap({
    super.key,
    required this.origin,
    required this.destination,
    this.current,
    required this.progress,
    required this.vehicle,
    this.delivered = false,
    this.style = RouteMapStyle.pass,
    this.reference,
    this.labels = true,
  });

  final String origin;
  final String destination;

  /// Where the cargo is now, if that is a known place on the way.
  final String? current;

  /// How far along, 0–1, when [current] is not a known place.
  final double progress;
  final IconData vehicle;
  final bool delivered;
  final RouteMapStyle style;
  final bool labels;

  /// When given, the route draws itself in only the first time this
  /// shipment is shown in a session.
  final String? reference;

  static bool canDraw(String origin, String destination) {
    final from = locate(origin);
    final to = locate(destination);
    if (from == null || to == null) return false;
    // At least one end must be on the map, and the two must be apart.
    if (!from.onMap && !to.onMap) return false;
    return (from.lat - to.lat).abs() + (from.lon - to.lon).abs() > 0.2;
  }

  static final Set<String> _drawn = {};

  @override
  State<RouteMap> createState() => _RouteMapState();
}

class _RouteMapState extends State<RouteMap> with TickerProviderStateMixin {
  late final AnimationController _draw = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = Motion.reduced(context);
    if (!_started) {
      _started = true;
      final seen = widget.reference != null && !RouteMap._drawn.add(widget.reference!);
      if (reduced || seen) {
        _draw.value = 1;
      } else {
        _draw.forward();
      }
    }
    if (reduced || widget.delivered) {
      _pulse.stop();
      _pulse.value = 0;
    } else if (!_pulse.isAnimating) {
      _pulse.repeat();
    }
  }

  @override
  void dispose() {
    _draw.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final geometry = _Geometry.fit(
          size,
          origin: widget.origin,
          destination: widget.destination,
          current: widget.current,
          progress: widget.progress,
          delivered: widget.delivered,
        );
        if (geometry == null) return const SizedBox.shrink();
        final text = Theme.of(context).textTheme.labelSmall;
        return Stack(
          fit: StackFit.expand,
          children: [
            // The land fades out towards the edges, so the map has no frame.
            RepaintBoundary(
              child: FadeTransition(
                opacity: CurvedAnimation(
                  parent: _draw,
                  curve: const Interval(0, 0.4, curve: Curves.easeOut),
                ),
                child: _EdgeFade(
                  axis: Axis.horizontal,
                  child: _EdgeFade(
                    axis: Axis.vertical,
                    child: CustomPaint(painter: _DotsPainter(geometry, widget.style)),
                  ),
                ),
              ),
            ),
            RepaintBoundary(
              child: CustomPaint(
                painter: _RoutePainter(
                  geometry: geometry,
                  style: widget.style,
                  draw: CurvedAnimation(
                    parent: _draw,
                    curve: const Interval(0.1, 1, curve: Motion.easeOut),
                  ),
                  pulse: _pulse,
                  vehicle: widget.vehicle,
                  delivered: widget.delivered,
                  labels: widget.labels,
                  labelStyle: (text ?? const TextStyle()).copyWith(
                    color: widget.style.label,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.6,
                    shadows: [Shadow(color: widget.style.halo, blurRadius: 6)],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Fades a child out over its last stretch at both ends of [axis].
class _EdgeFade extends StatelessWidget {
  const _EdgeFade({required this.axis, required this.child});
  final Axis axis;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final horizontal = axis == Axis.horizontal;
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) => LinearGradient(
        begin: horizontal ? Alignment.centerLeft : Alignment.topCenter,
        end: horizontal ? Alignment.centerRight : Alignment.bottomCenter,
        colors: const [Colors.transparent, Colors.white, Colors.white, Colors.transparent],
        stops: horizontal ? const [0, 0.12, 0.88, 1] : const [0, 0.08, 0.9, 1],
      ).createShader(rect),
      child: child,
    );
  }
}

/// Where everything sits on screen for one route at one size.
class _Geometry {
  _Geometry({
    required this.size,
    required this.toScreen,
    required this.path,
    required this.travelled,
    required this.from,
    required this.to,
    required this.current,
    required this.fromLabel,
    required this.toLabel,
    required this.fromOffMap,
    required this.toOffMap,
  });

  final Size size;
  final Offset Function(double lat, double lon) toScreen;
  final Path path;

  /// Length along [path] the cargo has covered.
  final double travelled;
  final Offset from;
  final Offset to;
  final Offset? current;
  final String fromLabel;
  final String toLabel;
  final bool fromOffMap;
  final bool toOffMap;

  late final ui.PathMetric metric = path.computeMetrics().first;

  // Keyed on what decides the picture, so a rebuild at the same size reuses it.
  late final String key =
      '${size.width.round()}x${size.height.round()}:${from.dx.round()},${from.dy.round()}:${to.dx.round()},${to.dy.round()}';

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

    final anchors = [a, b, ?c].where((p) => p.onMap).toList();
    // A route into or out of Nepal shows all of Nepal, so its shape is there
    // to recognise.
    if (anchors.any(_inNepal)) anchors.addAll(const [GeoPoint(26.4, 80.1), GeoPoint(30.4, 88.2)]);
    final midLat = anchors.map((p) => p.lat).reduce((x, y) => x + y) / anchors.length;
    final kx = math.cos(midLat * math.pi / 180);

    // The frame: the on-map points, padded, never tighter than a region a
    // person can recognise, matched to the widget's shape.
    var west = anchors.map((p) => p.lon * kx).reduce(math.min);
    var east = anchors.map((p) => p.lon * kx).reduce(math.max);
    var north = anchors.map((p) => -p.lat).reduce(math.min);
    var south = anchors.map((p) => -p.lat).reduce(math.max);
    // Wide enough to take in Nepal and the Bay of Bengal together.
    final minSpan = 16.0 * kx;
    final padX = math.max((east - west) * 0.3, (minSpan - (east - west)) / 2);
    final padY = math.max((south - north) * 0.3, (minSpan * 0.35 - (south - north)) / 2);
    west -= padX;
    east += padX;
    north -= padY;
    south += padY;
    final spanX = east - west;
    final spanY = south - north;
    final aspect = size.width / size.height;
    if (spanX / spanY > aspect) {
      final grow = (spanX / aspect - spanY) / 2;
      north -= grow;
      south += grow;
    } else {
      final grow = (spanY * aspect - spanX) / 2;
      west -= grow;
      east += grow;
    }
    final scale = size.width / (east - west);
    Offset toScreen(double lat, double lon) => Offset((lon * kx - west) * scale, (-lat - north) * scale);

    final rect = Offset.zero & size;
    final inset = rect.deflate(14);
    var from = toScreen(a.lat, a.lon);
    var to = toScreen(b.lat, b.lon);
    // An end off the map is brought to the frame's edge, on the line
    // towards it, so the route still leaves in the right direction.
    if (!a.onMap || !inset.contains(from)) from = _toEdge(to, from, inset);
    if (!b.onMap || !inset.contains(to)) to = _toEdge(from, to, inset);
    final now = c == null ? null : toScreen(c.lat, c.lon);

    final path = Path()..moveTo(from.dx, from.dy);
    if (now != null) {
      _bow(path, from, now, 0.16);
      _bow(path, now, to, 0.16);
    } else {
      _bow(path, from, to, 0.2);
    }
    final metrics = path.computeMetrics().toList();
    if (metrics.isEmpty) return null;
    final length = metrics.first.length;
    double travelled;
    if (delivered) {
      travelled = length;
    } else if (now != null) {
      final first = Path()..moveTo(from.dx, from.dy);
      _bow(first, from, now, 0.16);
      travelled = first.computeMetrics().first.length;
    } else {
      travelled = length * progress.clamp(0.0, 1.0);
    }

    return _Geometry(
      size: size,
      toScreen: toScreen,
      path: path,
      travelled: travelled,
      from: from,
      to: to,
      current: now,
      fromLabel: place(origin).toUpperCase(),
      toLabel: place(destination).toUpperCase(),
      fromOffMap: !a.onMap,
      toOffMap: !b.onMap,
    );
  }

  static bool _inNepal(GeoPoint p) => p.lat > 26.3 && p.lat < 30.5 && p.lon > 80 && p.lon < 88.3;

  static bool _near(GeoPoint x, GeoPoint y) => (x.lat - y.lat).abs() + (x.lon - y.lon).abs() < 0.4;

  /// A gentle arc, bowed away from the equator as great circles look.
  static void _bow(Path path, Offset from, Offset to, double amount) {
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

class _DotsPainter extends CustomPainter {
  _DotsPainter(this.geometry, this.style);
  final _Geometry geometry;
  final RouteMapStyle style;

  static const _spacing = 6.0;

  @override
  void paint(Canvas canvas, Size size) {
    final land = <Offset>[];
    final nepal = <Offset>[];
    // Invert the projection at each dot of an even grid, so the dots keep
    // their spacing at every zoom.
    final origin = geometry.toScreen(0, 0);
    final perLon = geometry.toScreen(0, 1).dx - origin.dx;
    final perLat = geometry.toScreen(1, 0).dy - origin.dy;
    for (var y = _spacing / 2; y < size.height; y += _spacing) {
      final lat = (y - origin.dy) / perLat;
      for (var x = _spacing / 2; x < size.width; x += _spacing) {
        final lon = (x - origin.dx) / perLon;
        switch (landAt(lat, lon)) {
          case 1:
            land.add(Offset(x, y));
          case 2:
            nepal.add(Offset(x, y));
        }
      }
    }
    final paint = Paint()..strokeCap = StrokeCap.round;
    canvas.drawPoints(
      ui.PointMode.points,
      land,
      paint
        ..color = style.land
        ..strokeWidth = 2,
    );
    // Nepal, where every route ends or begins, a size up and brighter.
    canvas.drawPoints(
      ui.PointMode.points,
      nepal,
      paint
        ..color = style.nepal
        ..strokeWidth = 2.6,
    );
    final border = Path();
    for (var i = 0; i < nepalOutline.length; i += 2) {
      final point = geometry.toScreen(nepalOutline[i], nepalOutline[i + 1]);
      i == 0 ? border.moveTo(point.dx, point.dy) : border.lineTo(point.dx, point.dy);
    }
    canvas.drawPath(
      border..close(),
      Paint()
        ..color = style.border
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_DotsPainter old) => old.geometry.key != geometry.key || old.style != style;
}

class _RoutePainter extends CustomPainter {
  _RoutePainter({
    required this.geometry,
    required this.style,
    required this.draw,
    required this.pulse,
    required this.vehicle,
    required this.delivered,
    required this.labels,
    required this.labelStyle,
  }) : super(repaint: Listenable.merge([draw, pulse]));

  final _Geometry geometry;
  final RouteMapStyle style;
  final Animation<double> draw;
  final Animation<double> pulse;
  final IconData vehicle;
  final bool delivered;
  final bool labels;
  final TextStyle labelStyle;

  @override
  void paint(Canvas canvas, Size size) {
    final metric = geometry.metric;
    final t = draw.value;
    final length = metric.length;

    // The way ahead: a fine dashed line.
    final track = Paint()
      ..color = style.track.withValues(alpha: style.track.a * t)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round;
    for (var d = geometry.travelled; d < length; d += 7) {
      canvas.drawPath(metric.extractPath(d, math.min(d + 3, length)), track);
    }

    // The way travelled: a glow under a bright line that fades in from the
    // origin, so the eye runs to where the cargo is.
    final head = geometry.travelled * t;
    if (head > 0.5) {
      final done = metric.extractPath(0, head);
      final tip = metric.getTangentForOffset(head)!.position;
      canvas.drawPath(
        done,
        Paint()
          ..color = style.glow.withValues(alpha: 0.55)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 7
          ..strokeCap = StrokeCap.round
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
      );
      canvas.drawPath(
        done,
        Paint()
          ..shader = ui.Gradient.linear(geometry.from, tip, [style.route.withValues(alpha: 0.35), style.route])
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.6
          ..strokeCap = StrokeCap.round,
      );
    }

    // Ports: the origin lit once the cargo has left, the destination once
    // it has arrived; a waypoint the cargo has reached glows faintly.
    _port(canvas, geometry.from, lit: t > 0.05, offMap: geometry.fromOffMap);
    _port(canvas, geometry.to, lit: delivered && t > 0.95, offMap: geometry.toOffMap);

    if (labels) {
      final vehicleAt = delivered ? null : metric.getTangentForOffset(math.max(geometry.travelled, 0.01))!.position;
      _label(canvas, size, geometry.fromLabel, geometry.from, other: geometry.to, avoid: vehicleAt);
      _label(canvas, size, geometry.toLabel, geometry.to, other: geometry.from, avoid: vehicleAt);
    }

    if (!delivered) _vehicle(canvas, metric.getTangentForOffset(math.max(head, 0.01))!.position, t);
  }

  void _port(Canvas canvas, Offset at, {required bool lit, required bool offMap}) {
    if (offMap) {
      canvas.drawCircle(at, 2.5, Paint()..color = style.track);
      return;
    }
    if (lit) {
      canvas.drawCircle(
        at,
        9,
        Paint()
          ..color = style.glow.withValues(alpha: 0.35)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
      );
      canvas.drawCircle(at, 4.5, Paint()..color = style.route);
      canvas.drawCircle(at, 1.8, Paint()..color = style.onVehicle);
    } else {
      canvas.drawCircle(
        at,
        4.5,
        Paint()
          ..color = style.port
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6,
      );
    }
  }

  void _vehicle(Canvas canvas, Offset at, double t) {
    final appear = Curves.easeOut.transform(((t - 0.15) / 0.3).clamp(0.0, 1.0));
    if (appear == 0) return;
    // A soft ring breathes out from the vehicle while it moves.
    final p = pulse.value;
    if (p > 0) {
      canvas.drawCircle(
        at,
        12 + 16 * Curves.easeOut.transform(p),
        Paint()
          ..color = style.route.withValues(alpha: 0.4 * (1 - p) * appear)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
    }
    final radius = 13.0 * (0.6 + 0.4 * appear);
    canvas.drawCircle(
      at,
      radius + 6,
      Paint()
        ..color = style.glow.withValues(alpha: 0.5 * appear)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
    canvas.drawCircle(at, radius, Paint()..color = style.route.withValues(alpha: appear));
    final icon = TextPainter(
      text: TextSpan(
        text: String.fromCharCode(vehicle.codePoint),
        style: TextStyle(
          fontFamily: vehicle.fontFamily,
          package: vehicle.fontPackage,
          fontSize: 14 * (0.6 + 0.4 * appear),
          color: style.onVehicle.withValues(alpha: appear),
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    icon.paint(canvas, at - Offset(icon.width / 2, icon.height / 2));
  }

  void _label(Canvas canvas, Size size, String text, Offset at, {required Offset other, Offset? avoid}) {
    // Clear of the vehicle when it sits at this port.
    final gap = avoid != null && (avoid - at).distance < 30 ? 26.0 : 12.0;
    if (text.isEmpty) return;
    final painter = TextPainter(
      text: TextSpan(text: text, style: labelStyle),
      textDirection: TextDirection.ltr,
      maxLines: 1,
      ellipsis: '…',
    )..layout(maxWidth: size.width * 0.45);
    // Beside the port when the route runs north–south, else below it (or
    // above, when the other end is below), always away from the route.
    final d = other - at;
    double x;
    double y;
    if (d.dy.abs() > d.dx.abs() * 1.4) {
      x = at.dx + gap;
      y = at.dy - painter.height / 2;
      if (x + painter.width > size.width - 6) x = at.dx - gap - painter.width;
    } else {
      final below = other.dy <= at.dy + 8 || at.dy < 24;
      y = below ? at.dy + 10 : at.dy - 10 - painter.height;
      x = at.dx - painter.width / 2;
    }
    x = x.clamp(6.0, size.width - painter.width - 6);
    y = y.clamp(4.0, size.height - painter.height - 4);
    painter.paint(canvas, Offset(x, y));
  }

  @override
  bool shouldRepaint(_RoutePainter old) =>
      old.geometry.key != geometry.key ||
      old.geometry.travelled != geometry.travelled ||
      old.style != style ||
      old.vehicle != vehicle ||
      old.delivered != delivered;
}
