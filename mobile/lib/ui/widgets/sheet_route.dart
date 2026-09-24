import 'dart:math' as math;

import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';

import '../motion.dart';
import '../theme.dart';

/// A detail page as a card sheet, as Apple Maps and Wallet show one: it rises
/// over a dimmed page, keeps a sliver of that page visible above it, and
/// follows the finger down to close when pulled from the top of its content.
class SheetRoute<T> extends PageRoute<T> {
  SheetRoute({required this.builder, super.settings}) : super(fullscreenDialog: true);

  final WidgetBuilder builder;

  @override
  bool get opaque => false;

  @override
  bool get maintainState => true;

  @override
  Color? get barrierColor => Colors.black.withValues(alpha: 0.38);

  @override
  String? get barrierLabel => null;

  @override
  Duration get transitionDuration => const Duration(milliseconds: 420);

  @override
  Duration get reverseTransitionDuration => const Duration(milliseconds: 300);

  /// Whether [context] is inside a sheet, where pulling down closes the
  /// sheet rather than refreshing.
  static bool of(BuildContext context) => context.findAncestorWidgetOfExactType<_SheetFrame>() != null;

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) =>
      // Its own messenger, so a snack bar shows on the sheet alone and not
      // also on the page still visible behind it.
      _SheetFrame(
        route: this,
        child: ScaffoldMessenger(child: Builder(builder: builder)),
      );

  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) {
    if (Motion.reduced(context)) return FadeTransition(opacity: animation, child: child);
    // Under the finger the sheet tracks it one to one; otherwise it eases.
    final linear = navigator?.userGestureInProgress ?? false;
    return SlideTransition(
      position: Tween(
        begin: const Offset(0, 1),
        end: Offset.zero,
        // Reversed, the flipped curve plays as an ease-out: the sheet leaves
        // fast and settles, rather than starting slow.
      ).animate(linear ? animation : CurvedAnimation(parent: animation, curve: Motion.drawer, reverseCurve: Motion.easeOut.flipped)),
      child: child,
    );
  }

  /// How far the page beneath has receded, 0–1: the sheet's own progress.
  /// Home screens scale back a touch while a sheet is up, as iOS pages do.
  static final depth = ValueNotifier<double>(0);

  @override
  void install() {
    super.install();
    animation!.addListener(_syncDepth);
  }

  void _syncDepth() => depth.value = animation!.value;

  @override
  void dispose() {
    animation?.removeListener(_syncDepth);
    depth.value = 0;
    super.dispose();
  }

  void _dragStart() => navigator?.didStartUserGesture();

  void _dragUpdate(double fraction) => controller!.value = (controller!.value - fraction).clamp(0.0, 1.0);

  /// Where the finger lets go decides by its direction, not how far it got:
  /// a flick down closes, a flick up stays, and only a slow release looks
  /// at the distance. [velocity] is in pixels a second, down positive.
  void _dragEnd(double velocity, double height) {
    const flick = 110.0; // 0.11 px/ms
    final close = velocity.abs() > flick ? velocity > 0 : controller!.value < 0.75;
    if (close) {
      HapticFeedback.lightImpact();
      navigator?.pop();
      // Finish at the finger's own speed rather than a fixed pace.
      final remaining = controller!.value * height;
      final seconds = (remaining / math.max(velocity.abs(), 1)).clamp(0.15, 0.3);
      controller!.animateBack(
        0,
        duration: Duration(milliseconds: (seconds * 1000).round()),
        curve: Motion.easeOut,
      );
    } else {
      // Back up on a critically damped spring that starts at the finger's
      // velocity, so there is no seam between the drag and the settle.
      final spring = SpringDescription.withDampingRatio(mass: 1, stiffness: math.pow(2 * math.pi / 0.3, 2).toDouble(), ratio: 1);
      controller!.animateWith(SpringSimulation(spring, controller!.value, 1, -velocity / height));
    }
    // The navigator waits for the settle before it takes gestures again.
    if (controller!.isAnimating) {
      late AnimationStatusListener done;
      done = (status) {
        if (status == AnimationStatus.forward || status == AnimationStatus.reverse) return;
        navigator?.didStopUserGesture();
        controller!.removeStatusListener(done);
      };
      controller!.addStatusListener(done);
    } else {
      navigator?.didStopUserGesture();
    }
  }
}

class _SheetFrame extends StatefulWidget {
  const _SheetFrame({required this.route, required this.child});
  final SheetRoute<dynamic> route;
  final Widget child;

  @override
  State<_SheetFrame> createState() => _SheetFrameState();
}

class _SheetFrameState extends State<_SheetFrame> {
  double _pixels = 0;
  double? _anchor;
  bool _dragging = false;
  // Recent (time, position) samples for the release velocity, on our own
  // clock: event timestamps are not reliable across platforms.
  final _velocity = <(DateTime, double)>[];

  double get _height => context.size?.height ?? 800;

  void _move(PointerMoveEvent event) {
    if (_pixels > 0.5) {
      // Content is scrolled: the finger is scrolling it, not the sheet.
      _anchor = null;
      return;
    }
    _anchor ??= event.position.dy;
    final pulled = event.position.dy - _anchor!;
    // A little hysteresis before the sheet commits to following.
    if (!_dragging && pulled > 10) {
      _dragging = true;
      _velocity.clear();
      widget.route._dragStart();
    }
    if (!_dragging) return;
    widget.route._dragUpdate(event.delta.dy / _height);
    _velocity.add((clock.now(), event.position.dy));
    if (_velocity.length > 8) _velocity.removeAt(0);
  }

  void _up(PointerEvent event) {
    _anchor = null;
    if (!_dragging) return;
    _dragging = false;
    var velocity = 0.0;
    // Only the last 100ms count: a finger that paused before letting go
    // has no momentum left.
    final now = clock.now();
    final recent = _velocity.where((sample) => now.difference(sample.$1) < const Duration(milliseconds: 100)).toList();
    if (recent.length >= 2) {
      final (t0, y0) = recent.first;
      final (t1, y1) = recent.last;
      final seconds = t1.difference(t0).inMicroseconds / 1e6;
      if (seconds > 0) velocity = (y1 - y0) / seconds;
    }
    _velocity.clear();
    widget.route._dragEnd(velocity, _height);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final media = MediaQuery.of(context);
    final top = media.padding.top + 10;
    return Padding(
      padding: EdgeInsets.only(top: top),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 30, offset: const Offset(0, -4))],
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
          child: ColoredBox(
            color: p.paper,
            child: Listener(
              onPointerMove: _move,
              onPointerUp: _up,
              onPointerCancel: _up,
              child: NotificationListener<ScrollNotification>(
                onNotification: (notification) {
                  if (notification.depth == 0) _pixels = notification.metrics.pixels;
                  return false;
                },
                // Content stops at the top rather than bouncing, so the pull
                // moves the sheet instead.
                child: ScrollConfiguration(
                  behavior: const _SheetScroll(),
                  child: MediaQuery(
                    data: media.removePadding(removeTop: true),
                    child: Stack(
                      children: [
                        widget.child,
                        // The grabber, so the sheet says it can be pulled.
                        Positioned(
                          top: 6,
                          left: 0,
                          right: 0,
                          child: IgnorePointer(
                            child: Center(
                              child: Container(
                                width: 36,
                                height: 5,
                                decoration: BoxDecoration(color: p.tertiary.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(3)),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SheetScroll extends MaterialScrollBehavior {
  const _SheetScroll();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) => const ClampingScrollPhysics();

  @override
  Widget buildOverscrollIndicator(BuildContext context, Widget child, ScrollableDetails details) => child;
}

/// The page beneath a sheet, pushed back while the sheet is up: scaled a
/// little, lowered a touch and rounded, so the sheet reads as a layer above
/// it, as iOS shows one. Under reduce-motion the dimming alone does it.
class SheetDepth extends StatelessWidget {
  const SheetDepth({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return ValueListenableBuilder<double>(
      valueListenable: SheetRoute.depth,
      child: child,
      builder: (context, t, child) {
        if (t <= 0) return child!;
        final top = MediaQuery.paddingOf(context).top;
        return Transform(
          alignment: Alignment.topCenter,
          transform: Matrix4.identity()
            ..translateByDouble(0, (top * 0.5 + 6) * t, 0, 1)
            ..scaleByDouble(1 - 0.06 * t, 1 - 0.06 * t, 1, 1),
          child: ClipRRect(borderRadius: BorderRadius.circular(12 * t), child: child),
        );
      },
    );
  }
}
