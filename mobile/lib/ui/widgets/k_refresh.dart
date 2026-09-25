import 'dart:math' as math;

import 'package:flutter/cupertino.dart' show CupertinoActivityIndicator;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../motion.dart';
import '../theme.dart';

/// Pull to refresh, as iOS does it: the spinner's ticks appear as the page
/// is pulled, a click says it will refresh on release, and it spins while
/// the page reloads. Works with both clamping (Android) and bouncing (iOS)
/// scrolling.
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

  late final AnimationController _hide = AnimationController(vsync: this, duration: const Duration(milliseconds: 200));
  double _pull = 0;
  bool _dragging = false;
  bool _armed = false;
  bool _refreshing = false;

  @override
  void dispose() {
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
    try {
      await widget.onRefresh();
    } finally {
      if (mounted) {
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
            top: widget.edgeOffset + 6 + 14 * progress,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: Center(
                child: AnimatedBuilder(
                  animation: _hide,
                  builder: (context, _) {
                    final out = Motion.easeOut.transform(_hide.value);
                    // The system spinner: its ticks appear one by one as the
                    // page is pulled, then it spins while the page reloads.
                    return Opacity(
                      opacity: 1 - out,
                      child: Transform.scale(
                        scale: 1 - 0.3 * out,
                        child: Semantics(
                          label: MaterialLocalizations.of(context).refreshIndicatorSemanticLabel,
                          child: SizedBox.square(
                            dimension: 28,
                            child: _refreshing && !Motion.reduced(context)
                                ? CupertinoActivityIndicator(radius: 11, color: p.secondary)
                                : CupertinoActivityIndicator.partiallyRevealed(radius: 11, progress: progress, color: p.secondary),
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
