import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../api/models.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../map/route_map.dart';
import '../motion.dart';
import '../theme.dart';
import 'common.dart';
import 'journey.dart';

/// The dark pass that leads each home screen and heads each shipment or job:
/// black glass with a crimson glow, a fine grain, a light-catching edge and
/// a perforation, like a Wallet boarding pass. It is dark in light mode
/// too; that contrast is the point.
class Pass extends StatelessWidget {
  const Pass({super.key, required this.body, required this.stub, this.onTap});
  final Widget body;
  final Widget stub;
  final VoidCallback? onTap;

  static final ThemeData _theme = kcplTheme(Brightness.dark);
  static const radius = 28.0;

  @override
  Widget build(BuildContext context) {
    final page = context.palette.paper;
    final shape = BorderRadius.circular(radius);
    Widget card = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: shape,
        boxShadow: [
          BoxShadow(
            color: KcplColors.crimson.withValues(alpha: page.computeLuminance() > 0.5 ? 0.22 : 0.34),
            blurRadius: 48,
            spreadRadius: -10,
            offset: const Offset(0, 22),
          ),
          BoxShadow(color: Colors.black.withValues(alpha: 0.28), blurRadius: 18, offset: const Offset(0, 8)),
        ],
      ),
      child: ClipRRect(
        borderRadius: shape,
        child: Material(
          color: PassColors.base,
          child: InkWell(
            onTap: onTap,
            highlightColor: Colors.white.withValues(alpha: 0.04),
            child: Stack(
              children: [
                const Positioned.fill(child: _Glow()),
                const Positioned.fill(
                  child: RepaintBoundary(child: CustomPaint(painter: _Grain())),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    body,
                    _Perforation(page: page),
                    stub,
                  ],
                ),
                Positioned.fill(
                  child: IgnorePointer(child: CustomPaint(painter: _Edge(shape))),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    card = Theme(
      data: _theme,
      child: DefaultTextStyle.merge(
        style: const TextStyle(color: PassColors.ink),
        child: card,
      ),
    );
    return onTap == null ? card : Pressable(scale: 0.975, child: card);
  }
}

/// Crimson light pooling in from the top corner, and a fainter echo below.
class _Glow extends StatelessWidget {
  const _Glow();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: RadialGradient(
          center: Alignment(1.05, -1.15),
          radius: 1.25,
          colors: [Color(0x70DC143C), Color(0x1ADC143C), Color(0x00DC143C)],
          stops: [0, 0.5, 1],
        ),
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(center: Alignment(-1.2, 1.1), radius: 1.1, colors: [Color(0x2EDC143C), Color(0x00DC143C)]),
        ),
      ),
    );
  }
}

/// A film grain, so the black reads as a material rather than a fill.
class _Grain extends CustomPainter {
  const _Grain();

  @override
  void paint(Canvas canvas, Size size) {
    final random = math.Random(7);
    final count = (size.width * size.height / 14).round();
    final light = <Offset>[];
    final dark = <Offset>[];
    for (var i = 0; i < count; i++) {
      final point = Offset(random.nextDouble() * size.width, random.nextDouble() * size.height);
      (i.isEven ? light : dark).add(point);
    }
    final paint = Paint()..strokeWidth = 1;
    canvas.drawPoints(ui.PointMode.points, light, paint..color = const Color(0x0DFFFFFF));
    canvas.drawPoints(ui.PointMode.points, dark, paint..color = const Color(0x14000000));
  }

  @override
  bool shouldRepaint(_Grain old) => false;
}

/// A hairline edge that catches light at the top and fades going down.
class _Edge extends CustomPainter {
  const _Edge(this.shape);
  final BorderRadius shape;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRRect(
      shape.toRRect(rect).deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = ui.Gradient.linear(rect.topCenter, rect.bottomCenter, [const Color(0x33FFFFFF), const Color(0x08FFFFFF)]),
    );
  }

  @override
  bool shouldRepaint(_Edge old) => false;
}

/// The tear line between pass and stub: a dashed rule between two notches
/// cut to the page behind.
class _Perforation extends StatelessWidget {
  const _Perforation({required this.page});
  final Color page;

  @override
  Widget build(BuildContext context) => SizedBox(height: 28, child: CustomPaint(painter: _PerforationPainter(page)));
}

class _PerforationPainter extends CustomPainter {
  _PerforationPainter(this.page);
  final Color page;

  @override
  void paint(Canvas canvas, Size size) {
    final y = size.height / 2;
    final notch = Paint()..color = page;
    canvas.drawCircle(Offset(0, y), 12, notch);
    canvas.drawCircle(Offset(size.width, y), 12, notch);
    final dash = Paint()
      ..color = PassColors.hairline
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;
    for (var x = 22.0; x < size.width - 22; x += 9) {
      canvas.drawLine(Offset(x, y), Offset(math.min(x + 4, size.width - 22), y), dash);
    }
  }

  @override
  bool shouldRepaint(_PerforationPainter old) => old.page != page;
}

/// A shipment (or a job, as a shipment) as a pass: reference and mode, the
/// two ends in large type, the route on its map, and the status and ETA on
/// the stub. The whole pass is the shared element that flies from a home
/// screen into the detail page.
class JourneyGraphic extends StatelessWidget {
  const JourneyGraphic({super.key, required this.shipment, this.trailing, this.status, this.emphasis, this.subtitle, this.onTap});

  final Shipment shipment;

  /// Top right: the mode, unless something more useful is given.
  final String? trailing;
  final String? status;
  final Emphasis? emphasis;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final s = shipment;
    final status = this.status ?? statusLabel(l, s.status);
    final emphasis = this.emphasis ?? statusEmphasis(s.status);
    final subtitle =
        this.subtitle ??
        (s.currentLocation != null && !s.delivered ? l.overviewNowAt(s.currentLocation!) : l.shipLastUpdate(formatDateTime(s.updatedAt)));
    final pass = Pass(
      onTap: onTap,
      body: Builder(builder: (context) => _body(context, l)),
      stub: Builder(
        builder: (context) => Padding(
          padding: const EdgeInsets.fromLTRB(22, 2, 22, 20),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    StatusText(status, emphasis, style: context.type.titleMedium),
                    const SizedBox(height: 3),
                    Text(subtitle, style: context.type.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    l.overviewColEta.toUpperCase(),
                    style: context.type.labelSmall?.copyWith(color: PassColors.secondary, letterSpacing: 1),
                  ),
                  const SizedBox(height: 3),
                  Text(s.eta == null ? '—' : formatShortDate(s.eta), style: context.type.titleLarge),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    return Hero(
      tag: 'journey-${s.reference}',
      // Both ends are the same pass at the same size, so the flight is a
      // clean move; it lays out at natural height in case text differs.
      flightShuttleBuilder: (context, animation, direction, from, to) => OverflowBox(
        alignment: Alignment.topCenter,
        maxHeight: double.infinity,
        child: Material(type: MaterialType.transparency, child: (to.widget as Hero).child),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: ScrollRecede(child: pass),
      ),
    );
  }

  Widget _body(BuildContext context, AppLocalizations l) {
    final s = shipment;
    final mapped = RouteMap.canDraw(s.origin, s.destination);
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 20, 22, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Image.asset('assets/brand/k-mark.png', width: 16, height: 16, color: PassColors.ink),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  s.reference,
                  style: context.type.labelMedium?.copyWith(color: PassColors.secondary, letterSpacing: 0),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              _Chip(icon: modeIcon(s.mode), label: trailing ?? modeLabel(l, s.mode)),
            ],
          ),
          const SizedBox(height: 18),
          Endpoints(origin: s.origin, destination: s.destination),
          if (mapped)
            Padding(
              padding: const EdgeInsets.only(top: 16, bottom: 4),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: SizedBox(
                  height: 180,
                  child: RouteMap(
                    origin: s.origin,
                    destination: s.destination,
                    current: s.currentLocation,
                    progress: journeyFraction(s.status),
                    vehicle: modeIcon(s.mode),
                    delivered: s.delivered,
                    attention: s.status == 'exception',
                    reference: s.reference,
                  ),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 26),
              child: JourneyBar(status: s.status, mode: s.mode, large: true, reference: s.reference),
            ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 5, 10, 5),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(99)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: PassColors.secondary),
          const SizedBox(width: 5),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 120),
            child: Text(
              label,
              style: context.type.labelSmall?.copyWith(color: PassColors.ink),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

/// Origin on the left, destination on the right, as big as the width allows.
class Endpoints extends StatelessWidget {
  const Endpoints({super.key, required this.origin, required this.destination});
  final String origin;
  final String destination;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    Widget end(String value, CrossAxisAlignment align) => Expanded(
      child: Column(
        crossAxisAlignment: align,
        children: [
          Text(
            place(value).isEmpty ? '—' : place(value),
            style: context.type.headlineMedium,
            textAlign: align == CrossAxisAlignment.end ? TextAlign.end : TextAlign.start,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          if (region(value).isNotEmpty) ...[const SizedBox(height: 2), Text(region(value), style: context.type.bodySmall)],
        ],
      ),
    );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        end(origin, CrossAxisAlignment.start),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Icon(KIcons.arrowRight, size: 14, color: p.tertiary),
        ),
        const SizedBox(width: 12),
        end(destination, CrossAxisAlignment.end),
      ],
    );
  }
}

/// As the page scrolls up, the pass tips back and recedes a little, the
/// way a card on a table would if you tilted the table away.
class ScrollRecede extends StatefulWidget {
  const ScrollRecede({super.key, required this.child});
  final Widget child;

  @override
  State<ScrollRecede> createState() => _ScrollRecedeState();
}

class _ScrollRecedeState extends State<ScrollRecede> {
  ScrollPosition? _position;
  final _amount = ValueNotifier<double>(0);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final position = Motion.reduced(context) ? null : Scrollable.maybeOf(context)?.position;
    if (position == _position) return;
    _position?.removeListener(_update);
    _position = position?..addListener(_update);
  }

  void _update() {
    final box = context.findRenderObject() as RenderBox?;
    final viewport = box == null ? null : RenderAbstractViewport.maybeOf(box);
    if (box == null || viewport == null || !box.attached) return;
    // How far the pass's top has moved above the viewport's top edge.
    final top = box.localToGlobal(Offset.zero, ancestor: viewport).dy;
    _amount.value = (-top / (box.size.height * 0.9)).clamp(0.0, 1.0);
  }

  @override
  void dispose() {
    _position?.removeListener(_update);
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: _amount,
      child: widget.child,
      builder: (context, t, child) {
        if (t == 0) return child!;
        return Transform(
          alignment: Alignment.bottomCenter,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0012)
            ..rotateX(0.22 * t)
            ..scaleByDouble(1 - 0.06 * t, 1 - 0.06 * t, 1, 1),
          child: Opacity(opacity: 1 - 0.2 * t, child: child),
        );
      },
    );
  }
}
