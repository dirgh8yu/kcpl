import 'package:flutter/material.dart';

import '../motion.dart';
import '../theme.dart';
import 'kcpl_loader.dart' show KPainter;

/// The sign-in screen's head, in KCPL crimson: the gateway K assembles in
/// white, stroke by stroke, then lifts as "Kapileshwor Cargo" rises out of
/// it, and "Pvt. Ltd." settles beneath. It plays once, on arrival: the
/// screen is seen rarely, so it may take a moment to introduce the company.
/// Under Reduce Motion it is simply there.
class BrandHero extends StatefulWidget {
  const BrandHero({super.key, required this.height});

  /// Height of the crimson panel, including the status bar area.
  final double height;

  @override
  State<BrandHero> createState() => _BrandHeroState();
}

class _BrandHeroState extends State<BrandHero> with SingleTickerProviderStateMixin {
  late final AnimationController _play = AnimationController(vsync: this, duration: const Duration(milliseconds: 1700));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _play.value = 1;
    } else {
      _play.forward();
    }
  }

  @override
  void dispose() {
    _play.dispose();
    super.dispose();
  }

  /// [t] mapped through [from]–[to] of the timeline, eased out.
  static double _span(double t, double from, double to, [Curve curve = Motion.easeOut]) =>
      curve.transform(((t - from) / (to - from)).clamp(0.0, 1.0));

  @override
  Widget build(BuildContext context) {
    final text = context.type;
    return Semantics(
      container: true,
      label: 'Kapileshwor Cargo Pvt. Ltd.',
      excludeSemantics: true,
      child: ColoredBox(
        color: KcplColors.crimson,
        child: SizedBox(
          height: widget.height,
          width: double.infinity,
          child: SafeArea(
            bottom: false,
            child: Center(
              child: AnimatedBuilder(
                animation: _play,
                builder: (context, _) {
                  final t = _play.value;
                  // The K's strokes arrive, 0–45%.
                  final assemble = _span(t, 0, 0.45);
                  // It lifts to make room, 38–78%, moving on screen.
                  final lift = _span(t, 0.38, 0.78, Motion.easeInOut);
                  // The name rises out from under it, 50–86%.
                  final name = _span(t, 0.5, 0.86);
                  // "Pvt. Ltd." settles last, 68–100%.
                  final suffix = _span(t, 0.68, 1);
                  return Transform.translate(
                    // Centred on the K alone at first, on the whole lockup
                    // once the name is out.
                    offset: Offset(0, 34 * (1 - lift)),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox.square(
                          dimension: 64,
                          child: CustomPaint(
                            painter: KPainter(intro: assemble, wave: null, charge: Colors.white, base: Colors.white),
                          ),
                        ),
                        const SizedBox(height: 18),
                        // Clipped to its own line, so the name rises into
                        // view from a mask rather than fading in place.
                        ClipRect(
                          child: Transform.translate(
                            offset: Offset(0, 30 * (1 - name)),
                            child: Opacity(
                              opacity: name,
                              child: Text(
                                'Kapileshwor Cargo',
                                textAlign: TextAlign.center,
                                style: text.headlineLarge?.copyWith(color: Colors.white, letterSpacing: 0.2),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Opacity(
                          opacity: suffix,
                          child: Transform.translate(
                            offset: Offset(0, 6 * (1 - suffix)),
                            child: Text(
                              'PVT. LTD.',
                              style: text.labelMedium?.copyWith(
                                color: Colors.white.withValues(alpha: 0.78),
                                fontWeight: FontWeight.w600,
                                letterSpacing: 3,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}
