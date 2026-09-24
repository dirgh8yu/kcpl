import 'package:flutter/material.dart';
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
  Duration get transitionDuration => const Duration(milliseconds: 520);

  @override
  Duration get reverseTransitionDuration => const Duration(milliseconds: 360);

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
      ).animate(linear ? animation : CurvedAnimation(parent: animation, curve: Motion.drawer, reverseCurve: Curves.easeInCubic)),
      child: child,
    );
  }

  void _dragStart() => navigator?.didStartUserGesture();

  void _dragUpdate(double fraction) => controller!.value = (controller!.value - fraction).clamp(0.0, 1.0);

  void _dragEnd(double velocity) {
    final close = velocity > 800 || (velocity > -200 && controller!.value < 0.78);
    if (close) {
      HapticFeedback.lightImpact();
      navigator?.pop();
    } else {
      controller!.animateTo(1, duration: const Duration(milliseconds: 320), curve: Motion.easeOut);
    }
    // The navigator waits for the settle before it takes gestures again.
    if (controller!.isAnimating) {
      late AnimationStatusListener done;
      done = (status) {
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
  final _velocity = <(Duration, double)>[];

  double get _height => context.size?.height ?? 800;

  void _move(PointerMoveEvent event) {
    if (_pixels > 0.5) {
      // Content is scrolled: the finger is scrolling it, not the sheet.
      _anchor = null;
      return;
    }
    _anchor ??= event.position.dy;
    final pulled = event.position.dy - _anchor!;
    if (!_dragging && pulled > 6) {
      _dragging = true;
      widget.route._dragStart();
    }
    if (!_dragging) return;
    widget.route._dragUpdate(event.delta.dy / _height);
    _velocity.add((event.timeStamp, event.position.dy));
    if (_velocity.length > 6) _velocity.removeAt(0);
  }

  void _up(PointerEvent event) {
    _anchor = null;
    if (!_dragging) return;
    _dragging = false;
    var velocity = 0.0;
    if (_velocity.length >= 2) {
      final (t0, y0) = _velocity.first;
      final (t1, y1) = _velocity.last;
      final seconds = (t1 - t0).inMicroseconds / 1e6;
      if (seconds > 0) velocity = (y1 - y0) / seconds;
    }
    _velocity.clear();
    widget.route._dragEnd(velocity);
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
