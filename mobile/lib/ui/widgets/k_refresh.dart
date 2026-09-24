import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../motion.dart';
import '../theme.dart';
import 'glass.dart';
import 'kcpl_loader.dart' show KPainter;

/// Pull to refresh, drawn as the K: pulling assembles the mark stroke by
/// stroke, a tick says it will refresh on release, and while the page
/// reloads a crimson charge runs through it. Works with both clamping
/// (Android) and bouncing (iOS) scrolling.
class KRefresh extends StatefulWidget {
  const KRefresh({super.key, required this.onRefresh, required this.child, this.edgeOffset = 0});
  final Future<void> Function() onRefresh;
  final Widget child;

  /// Where the K appears: below the page's large title.
  final double edgeOffset;

  @override
  State<KRefresh> createState() => _KRefreshState();
}

class _KRefreshState extends State<KRefresh> with TickerProviderStateMixin {
  static const _trigger = 90.0;

  late final AnimationController _wave = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));
  late final AnimationController _hide = AnimationController(vsync: this, duration: const Duration(milliseconds: 200));
  double _pull = 0;
  bool _dragging = false;
  bool _armed = false;
  bool _refreshing = false;

  @override
  void dispose() {
    _wave.dispose();
    _hide.dispose();
    super.dispose();
  }

  bool _onScroll(ScrollNotification n) {
    if (n.depth != 0 || _refreshing) return false;
    if (n is ScrollStartNotification && n.dragDetails != null) {
      _dragging = n.metrics.extentBefore <= 0;
      _setPull(0);
    } else if (n is OverscrollNotification && _dragging && n.dragDetails != null) {
      // Clamping: the content cannot move, so the overscroll is the pull.
      _setPull(_pull - n.overscroll);
    } else if (n is ScrollUpdateNotification && _dragging) {
      if (n.dragDetails == null) {
        // The finger has lifted and the page is settling.
        _release();
      } else if (n.metrics.pixels < 0) {
        // Bouncing: the content follows the finger past the top.
        _setPull(-n.metrics.pixels);
      } else if (_pull > 0) {
        _setPull(_pull - (n.scrollDelta ?? 0));
      } else if (n.metrics.extentBefore > 0) {
        _dragging = false;
      }
    } else if (n is ScrollEndNotification && _dragging) {
      _release();
    }
    return false;
  }

  void _setPull(double value) {
    final pull = math.max(0.0, value);
    final armed = pull >= _trigger;
    if (armed && !_armed) HapticFeedback.selectionClick();
    setState(() {
      _pull = pull;
      _armed = armed;
      _hide.value = 0;
    });
  }

  Future<void> _release() async {
    _dragging = false;
    if (!_armed) {
      await _hide.forward();
      if (mounted) setState(() => _pull = 0);
      return;
    }
    HapticFeedback.mediumImpact();
    setState(() {
      _refreshing = true;
      _armed = false;
    });
    if (!Motion.reduced(context)) _wave.repeat();
    try {
      await widget.onRefresh();
    } finally {
      if (mounted) {
        _wave.stop();
        await _hide.forward();
        if (mounted) {
          setState(() {
            _refreshing = false;
            _pull = 0;
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final progress = _refreshing ? 1.0 : (_pull / _trigger).clamp(0.0, 1.0);
    final visible = _pull > 0 || _refreshing;
    return Stack(
      children: [
        NotificationListener<ScrollNotification>(onNotification: _onScroll, child: widget.child),
        if (visible)
          Positioned(
            top: widget.edgeOffset + 4 + 18 * progress,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: Center(
                child: AnimatedBuilder(
                  animation: Listenable.merge([_wave, _hide]),
                  builder: (context, _) {
                    final out = Motion.easeOut.transform(_hide.value);
                    return Opacity(
                      opacity: (progress * 1.6).clamp(0.0, 1.0) * (1 - out),
                      child: Transform.scale(
                        scale: (0.7 + 0.3 * progress) * (1 - 0.4 * out),
                        child: SizedBox.square(
                          dimension: 44,
                          child: Glass(
                            borderRadius: BorderRadius.circular(22),
                            border: true,
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Semantics(
                                label: MaterialLocalizations.of(context).refreshIndicatorSemanticLabel,
                                child: CustomPaint(
                                  painter: KPainter(
                                    intro: Motion.easeOut.transform(progress),
                                    wave: _wave.isAnimating ? _wave.value : null,
                                    charge: p.accent,
                                    // Armed, the K is the brand colour: let go now.
                                    base: _armed || _refreshing ? Color.lerp(p.tertiary, p.accent, 0.6)! : p.tertiary,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
      ],
    );
  }
}
