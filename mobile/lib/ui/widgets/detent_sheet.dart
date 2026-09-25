import 'dart:math' as math;

import 'package:flutter/gestures.dart' show Drag;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/physics.dart';

import '../motion.dart';

/// A sheet over a map, as Apple Maps and ride-hailing apps keep one: it
/// rests at a few heights (detents), follows the finger one to one, and on
/// release carries the finger's momentum to whichever height that momentum
/// was heading for. Its content scrolls once it is fully up; pulled down
/// from the top of its content, the sheet comes down instead.
///
/// It can be caught mid-flight: a touch stops it where it is.
class DetentSheet extends StatefulWidget {
  const DetentSheet({
    super.key,
    required this.detents,
    this.initial = 1,
    required this.builder,
    this.extent,
    this.background,
    this.onRefresh,
  });

  /// The resting heights in pixels for the space the sheet has, low to high.
  final List<double> Function(double available) detents;
  final int initial;

  /// The sheet's content, which must scroll with [controller].
  final Widget Function(BuildContext context, DetentSheetController controller) builder;

  /// The sheet's current height in pixels, for whatever sits behind it.
  final ValueNotifier<double>? extent;
  final Color? background;

  /// Called when the sheet is pulled well below its lowest height and let
  /// go: pull to refresh, for a sheet whose content cannot be pulled.
  final VoidCallback? onRefresh;

  /// How far below the lowest height counts as a pull to refresh.
  static const refreshPull = 64.0;

  @override
  State<DetentSheet> createState() => DetentSheetState();
}

/// Scrolls the sheet's content, and moves the sheet itself when the content
/// is at its top.
class DetentSheetController extends ScrollController {
  DetentSheetController._(this._sheet);
  final DetentSheetState _sheet;

  /// Moves the sheet to the next height up, or back to the lowest from the
  /// top: what a tap on the grabber does.
  void cycle() => _sheet.cycle();

  @override
  ScrollPosition createScrollPosition(ScrollPhysics physics, ScrollContext context, ScrollPosition? oldPosition) =>
      _SheetPosition(sheet: _sheet, physics: physics, context: context, oldPosition: oldPosition);
}

class DetentSheetState extends State<DetentSheet> with SingleTickerProviderStateMixin {
  late final DetentSheetController _controller = DetentSheetController._(this);
  late final AnimationController _motion = AnimationController.unbounded(vsync: this)..addListener(_tick);

  List<double> _detents = const [];

  /// The sheet's height now. A notifier rather than state: moving the sheet
  /// changes one transform, and never rebuilds its content.
  final _position = ValueNotifier<double>(0);
  double get _extent => _position.value;

  /// Where the finger would have the sheet, before resistance below the
  /// lowest height is applied.
  double _raw = 0;
  bool _placed = false;

  double get _min => _detents.first;
  double get _max => _detents.last;
  bool get atMax => _extent >= _max - 0.5;

  @override
  void dispose() {
    _motion.dispose();
    _controller.dispose();
    _position.dispose();
    super.dispose();
  }

  void _tick() => _set(_motion.value);

  void _set(double extent) {
    if (extent == _extent) return;
    _position.value = extent;
    widget.extent?.value = extent;
  }

  /// A touch has landed: the sheet stops where it is, mid-flight or not.
  /// Returns whether it was moving.
  bool _catch() {
    final moving = _motion.isAnimating;
    if (moving) _motion.stop();
    _raw = _extent;
    return moving;
  }

  /// The finger moved the sheet by [delta] pixels, up positive. Below the
  /// lowest height it resists more the further it is pulled, rather than
  /// stopping dead. Returns what the sheet did not use: the rest of a drag
  /// that carried it to the top, for the content to scroll.
  double _drag(double delta) {
    final before = _raw;
    _raw = math.min(_raw + delta, _max);
    final rest = delta - (_raw - before);
    if (_raw >= _min) {
      _set(_raw);
    } else {
      final over = _min - _raw;
      const c = 0.55;
      _set(_min - (over * _min * c) / (_min + c * over));
    }
    return rest;
  }

  /// The finger let go at [velocity] pixels a second, up positive. The sheet
  /// goes where that momentum projects it, and springs there starting at the
  /// finger's own speed, so the drag and the settle are one motion.
  void _release(double velocity) {
    if (widget.onRefresh != null && _min - _raw >= DetentSheet.refreshPull) {
      HapticFeedback.mediumImpact();
      widget.onRefresh!();
    }
    // Apple's projection: where a flick would come to rest under a normal
    // deceleration rate.
    const rate = 0.998;
    final projected = _extent + (velocity / 1000) * rate / (1 - rate);
    final target = _detents.reduce((a, b) => (a - projected).abs() < (b - projected).abs() ? a : b);
    _settle(target, velocity: velocity);
  }

  void _settle(double target, {double velocity = 0}) {
    _raw = target;
    if ((target - _extent).abs() < 0.5 && velocity.abs() < 1) {
      _set(target);
      return;
    }
    final reduced = Motion.reduced(context);
    // Critically damped by default; a touch of bounce only when a flick
    // carried momentum into it. Response 0.3s, as iOS sheets.
    final momentum = velocity.abs() > 400 && !reduced;
    final spring = SpringDescription.withDampingRatio(
      mass: 1,
      stiffness: math.pow(2 * math.pi / 0.3, 2).toDouble(),
      ratio: momentum ? 0.85 : 1,
    );
    _motion.value = _extent;
    // Lands exactly on the height once the spring is within tolerance.
    _motion.animateWith(SpringSimulation(spring, _extent, target, velocity)).then((_) => _set(target));
  }

  void cycle() {
    final above = _detents.where((d) => d > _extent + 1);
    _settle(above.isEmpty ? _detents.first : above.first);
  }

  /// Moves the sheet to the height at [index].
  void show(int index) => _settle(_detents[index.clamp(0, _detents.length - 1)]);

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final available = constraints.maxHeight;
        _detents = widget.detents(available);
        if (!_placed) {
          _placed = true;
          _position.value = _raw = _detents[widget.initial.clamp(0, _detents.length - 1)];
          WidgetsBinding.instance.addPostFrameCallback((_) => widget.extent?.value = _extent);
        }
        // The sheet is laid out once at full height and slid, rather than
        // resized every frame: moving it is a transform, not a relayout or
        // a rebuild of its content.
        final max = _max;
        return Stack(
          children: [
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: max,
              child: ValueListenableBuilder<double>(
                valueListenable: _position,
                child: RepaintBoundary(child: widget.builder(context, _controller)),
                builder: (context, extent, child) => Transform.translate(offset: Offset(0, max - extent), child: child),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SheetPosition extends ScrollPositionWithSingleContext {
  _SheetPosition({required this.sheet, required super.physics, required super.context, super.oldPosition});

  final DetentSheetState sheet;
  VoidCallback? _dragCancel;

  /// Whether the finger has moved the sheet, or caught it mid-flight, since
  /// it last settled. Only then does the sheet decide where to go: a
  /// ballistic call from a relayout leaves it alone.
  bool _handled = false;

  bool get _scrolled => pixels > minScrollExtent + 0.5;

  @override
  ScrollHoldController hold(VoidCallback holdCancelCallback) {
    if (sheet._catch()) _handled = true;
    return super.hold(holdCancelCallback);
  }

  @override
  Drag drag(DragStartDetails details, VoidCallback dragCancelCallback) {
    sheet._catch();
    _handled = true;
    _dragCancel = dragCancelCallback;
    return super.drag(details, dragCancelCallback);
  }

  @override
  void applyUserOffset(double delta) {
    // [delta] is the finger's movement, down positive. The sheet takes it
    // until it is fully up; after that the content scrolls. Pulled down
    // with the content at its top, the sheet comes down.
    final up = delta < 0;
    if (!_scrolled && (up ? !sheet.atMax : true)) {
      final rest = sheet._drag(-delta);
      if (rest != 0) super.applyUserOffset(-rest);
    } else {
      super.applyUserOffset(delta);
    }
  }

  @override
  void goBallistic(double velocity) {
    // [velocity] is the content's, up positive: the same sign as the
    // sheet's growth. The content keeps a fling once it has scrolled, or
    // when the sheet is fully up and the flick is upwards.
    final handled = _handled;
    _handled = false;
    if (!handled || _scrolled || (sheet.atMax && velocity >= 0)) {
      super.goBallistic(velocity);
      return;
    }
    _dragCancel?.call();
    _dragCancel = null;
    sheet._release(velocity);
    goIdle();
  }
}
