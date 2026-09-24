import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'theme.dart';

/// Motion tokens. Every animation in the app draws from these, so the whole
/// app moves with one hand.
class Motion {
  /// Strong ease-out: arrives fast, settles gently. The default for anything
  /// entering or responding.
  static const easeOut = Cubic(0.23, 1, 0.32, 1);

  /// For things moving across the screen.
  static const easeInOut = Cubic(0.77, 0, 0.175, 1);

  /// iOS sheet-like curve, for large surfaces arriving.
  static const drawer = Cubic(0.32, 0.72, 0, 1);

  static const press = Duration(milliseconds: 100);
  static const release = Duration(milliseconds: 160);
  static const swap = Duration(milliseconds: 180);
  static const reveal = Duration(milliseconds: 300);
  static const stagger = Duration(milliseconds: 40);

  /// The system's reduce-motion setting. When on, nothing moves or loops;
  /// short fades remain because they still help comprehension.
  static bool reduced(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;
}

/// Fades content up into place when it first appears, staggered by [index]
/// so a screen reads top to bottom instead of landing all at once. Only the
/// first appearance animates; a refresh updates in place.
class Reveal extends StatefulWidget {
  const Reveal({super.key, required this.child, this.index = 0, this.animate = true});
  final Widget child;
  final int index;
  final bool animate;

  @override
  State<Reveal> createState() => _RevealState();
}

class _RevealState extends State<Reveal> with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  late Animation<double> _progress;
  bool _reduced = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_controller != null) return;
    _reduced = Motion.reduced(context);
    // The delay lives inside the controller as an interval, so there is no
    // timer to outlive the widget.
    final delay = _reduced ? Duration.zero : Motion.stagger * widget.index.clamp(0, 8);
    final body = _reduced ? const Duration(milliseconds: 200) : Motion.reveal;
    final total = delay + body;
    final controller = AnimationController(vsync: this, duration: total);
    _controller = controller;
    _progress = CurvedAnimation(
      parent: controller,
      curve: Interval(delay.inMicroseconds / total.inMicroseconds, 1, curve: Motion.easeOut),
    );
    if (widget.animate) {
      controller.forward();
    } else {
      controller.value = 1;
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _progress,
      child: widget.child,
      builder: (context, child) {
        final t = _progress.value;
        if (t >= 1) return child!;
        return Opacity(
          opacity: t,
          child: _reduced ? child : Transform.translate(offset: Offset(0, 8 * (1 - t)), child: child),
        );
      },
    );
  }
}

/// Presses in under the finger the instant it lands, and springs back on
/// release, before the tap has even been decided.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.scale = 0.97});
  final Widget child;
  final double scale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool down) {
    if (_down != down) setState(() => _down = down);
  }

  @override
  Widget build(BuildContext context) {
    final pressed = _down && !Motion.reduced(context);
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: pressed ? widget.scale : 1,
        duration: pressed ? Motion.press : Motion.release,
        curve: Motion.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// The "no" shake iOS gives a wrong passcode.
class Shake extends StatefulWidget {
  const Shake({super.key, required this.child});
  final Widget child;

  @override
  ShakeState createState() => ShakeState();
}

class ShakeState extends State<Shake> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 400));

  void shake() {
    if (Motion.reduced(context)) return;
    _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _controller,
    child: widget.child,
    builder: (context, child) {
      final t = _controller.value;
      // Three swings, each smaller than the last.
      final dx = math.sin(t * math.pi * 6) * 9 * (1 - t);
      return Transform.translate(offset: Offset(dx, 0), child: child);
    },
  );
}

/// A figure, shown as it is. Figures are data people read, and data does not
/// move for style: no count-up, no glide.
class FigureText extends StatelessWidget {
  const FigureText({super.key, required this.value, required this.format, this.style});
  final double value;
  final String Function(double value) format;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) => Text(format(value), style: style);
}

/// A highlight sweeping across loading placeholders, so a wait reads as
/// progress rather than a frozen screen.
class Shimmer extends StatefulWidget {
  const Shimmer({super.key, required this.child});
  final Widget child;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _controller.stop();
    } else if (!_controller.isAnimating) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return widget.child;
    final p = context.palette;
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) {
          final x = -1.0 + _controller.value * 3;
          return LinearGradient(
            begin: Alignment(x - 1, 0),
            end: Alignment(x, 0),
            colors: [p.fill, p.paper.withValues(alpha: 0.9), p.fill],
            stops: const [0, 0.5, 1],
          ).createShader(bounds);
        },
        child: child,
      ),
    );
  }
}

/// A quick scale-and-fade between two states of a small control: an icon
/// becoming a spinner becoming a tick.
Widget morphTransition(Widget child, Animation<double> animation) => FadeTransition(
  opacity: animation,
  child: ScaleTransition(scale: Tween(begin: 0.9, end: 1.0).animate(animation), child: child),
);

/// Crossfades a list when a filter changes, so the new set arrives rather
/// than teleporting. Keyed on the filter, not the search text: a crossfade
/// on every keystroke would only blur the results.
class FilterSwap extends StatelessWidget {
  const FilterSwap({super.key, required this.filter, required this.child});
  final Object filter;
  final Widget child;

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration: Motion.reduced(context) ? Duration.zero : Motion.swap,
    switchInCurve: Motion.easeOut,
    switchOutCurve: Motion.easeOut,
    layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
    child: KeyedSubtree(key: ValueKey(filter), child: child),
  );
}
