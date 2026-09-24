import 'package:flutter/material.dart';

import '../motion.dart';
import '../theme.dart';

/// The KCPL K, drawn from its three strokes so it can move. On first
/// appearance the strokes assemble (the upright rises, the arms slide in);
/// while waiting, a crimson charge runs through them, upright to arms, the
/// way the mark reads. Under reduce-motion it is simply the mark.
class KcplLoader extends StatefulWidget {
  const KcplLoader({super.key, this.size = 56, this.color, this.base, this.assemble = true});
  final double size;

  /// The charge colour; KCPL crimson by default.
  final Color? color;

  /// The resting colour of the strokes; a quiet grey by default.
  final Color? base;
  final bool assemble;

  @override
  State<KcplLoader> createState() => _KcplLoaderState();
}

class _KcplLoaderState extends State<KcplLoader> with TickerProviderStateMixin {
  late final AnimationController _intro = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
  late final AnimationController _wave = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _intro.value = 1;
      return;
    }
    if (widget.assemble) {
      _intro.forward().whenComplete(() {
        if (mounted) _wave.repeat();
      });
    } else {
      _intro.value = 1;
      _wave.repeat();
    }
  }

  @override
  void dispose() {
    _intro.dispose();
    _wave.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final reduced = Motion.reduced(context);
    return Semantics(
      label: MaterialLocalizations.of(context).refreshIndicatorSemanticLabel,
      child: RepaintBoundary(
        child: SizedBox.square(
          dimension: widget.size,
          child: AnimatedBuilder(
            animation: Listenable.merge([_intro, _wave]),
            builder: (context, _) => CustomPaint(
              painter: _KPainter(
                intro: Motion.easeOut.transform(_intro.value),
                wave: _wave.isAnimating ? _wave.value : null,
                charge: widget.color ?? p.accent,
                base: reduced ? (widget.color ?? p.accent) : (widget.base ?? p.hairline),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _KPainter extends CustomPainter {
  _KPainter({required this.intro, required this.wave, required this.charge, required this.base});
  final double intro;
  final double? wave;
  final Color charge;
  final Color base;

  // The mark's strokes on a 512 grid, traced from the brand K.
  static const _upright = [Offset(0, 47), Offset(47, 0), Offset(128, 0), Offset(128, 465), Offset(81, 512), Offset(0, 512)];
  static const _upper = [Offset(176, 191), Offset(352, 0), Offset(512, 0), Offset(272, 256), Offset(176, 256)];
  static const _lower = [Offset(176, 304), Offset(272, 304), Offset(464, 512), Offset(304, 512), Offset(176, 376)];

  /// Where each stroke comes in from as the mark assembles.
  static const _from = [Offset(0, 90), Offset(90, -90), Offset(90, 90)];

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 512;
    canvas.scale(scale);
    final strokes = [_upright, _upper, _lower];
    for (var i = 0; i < strokes.length; i++) {
      // Assembly: each stroke starts a little after the one before.
      final local = ((intro - i * 0.15) / 0.7).clamp(0.0, 1.0);
      final offset = Offset.lerp(_from[i], Offset.zero, local)!;
      final path = Path()..addPolygon([for (final point in strokes[i]) point + offset], true);

      // The charge: a soft bump travelling through the strokes in order.
      // Strokes arrive at the resting level, so the charge picks up from
      // exactly where assembly left off, with no jump in colour.
      const rest = 0.3;
      var heat = rest;
      if (wave != null) {
        final distance = (wave! - i * 0.2) % 1.0;
        final bump = distance < 0.5 ? Curves.easeInOut.transform((1 - (distance - 0.25).abs() * 4).clamp(0.0, 1.0)) : 0.0;
        heat = rest + bump * (1 - rest);
      }
      final color = Color.lerp(base, charge, heat)!.withValues(alpha: local);
      canvas.drawPath(path, Paint()..color = color..isAntiAlias = true);
    }
  }

  @override
  bool shouldRepaint(_KPainter old) => old.intro != intro || old.wave != wave || old.charge != charge || old.base != base;
}
