import 'dart:math' as math;

import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../motion.dart';
import '../theme.dart';

/// Figures as a bento grid: tiles of different sizes, each a figure with a
/// small chart of what makes it up. Every chart is drawn from the same
/// records as its figure, never from a trend the server does not send.
class Bento extends StatelessWidget {
  const Bento({super.key, required this.rows});

  /// Each row's tiles share its width by their flex.
  final List<List<BentoTile>> rows;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: kGutter),
      child: Column(
        children: [
          for (var r = 0; r < rows.length; r++) ...[
            if (r > 0) const SizedBox(height: 12),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < rows[r].length; i++) ...[
                    if (i > 0) const SizedBox(width: 12),
                    Expanded(
                      flex: rows[r][i].flex,
                      child: _Compact(compact: rows[r].length >= 3, child: rows[r][i]),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Compact extends InheritedWidget {
  const _Compact({required this.compact, required super.child});
  final bool compact;

  static bool of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_Compact>()?.compact ?? false;

  @override
  bool updateShouldNotify(_Compact old) => old.compact != compact;
}

/// One raised tile: a label, a large figure, and an optional chart below.
class BentoTile extends StatelessWidget {
  const BentoTile({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.chart,
    this.caption,
    this.attention = false,
    this.onTap,
    this.flex = 1,
    this.large = false,
  });

  final String label;
  final int value;
  final IconData? icon;
  final Widget? chart;
  final String? caption;

  /// The figure is crimson, with a glow, when it is something going wrong.
  final bool attention;
  final VoidCallback? onTap;
  final int flex;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final hot = attention && value > 0;
    final compact = _Compact.of(context);
    final labelText = Text(label, style: context.type.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis);
    final iconWidget = icon == null ? null : Icon(icon, size: 18, color: hot ? p.accent : p.tertiary);
    final figure = (large ? context.type.displaySmall : context.type.headlineLarge)?.copyWith(color: hot ? p.accent : p.ink);
    final tile = Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: p.hairline, width: p.isDark ? 1 : 0.5),
        boxShadow: p.lift,
        // A gradient replaces the fill, so it runs from glow to the surface.
        gradient: hot
            ? RadialGradient(
                center: const Alignment(1, -1),
                radius: 1.3,
                colors: [
                  Color.alphaBlend(p.glow.withValues(alpha: p.isDark ? 0.22 : 0.09), p.surface),
                  p.surface,
                ],
              )
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Three to a row, a tile stacks icon, figure and label, so the
          // label has the tile's full width to wrap in.
          if (compact) ...[
            ?iconWidget,
            const SizedBox(height: 10),
            CountUp(value: value.toDouble(), format: (v) => '${v.round()}', style: figure),
            const SizedBox(height: 2),
            labelText,
          ] else ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: labelText),
                if (iconWidget != null) ...[const SizedBox(width: 8), iconWidget],
              ],
            ),
            const SizedBox(height: 6),
            CountUp(value: value.toDouble(), format: (v) => '${v.round()}', style: figure),
          ],
          if (caption != null && caption!.isNotEmpty) ...[
            const SizedBox(height: 2),
            // One line each, shrunk rather than broken: a reference split
            // across two lines is misread.
            for (final line in caption!.split('\n').take(3))
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: AlignmentDirectional.centerStart,
                child: Text(line, style: context.type.bodySmall, maxLines: 1),
              ),
          ],
          if (chart != null) ...[const Spacer(), const SizedBox(height: 14), chart!],
        ],
      ),
    );
    if (onTap == null) return tile;
    return Pressable(
      scale: 0.97,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: tile),
    );
  }
}

/// A raised surface, the bento tiles' material, for anything else that
/// sits on the page as a card.
class Surface extends StatelessWidget {
  const Surface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin = const EdgeInsets.symmetric(horizontal: kGutter),
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: p.hairline, width: p.isDark ? 1 : 0.5),
        boxShadow: p.lift,
      ),
      child: child,
    );
  }
}

/// One stage of a pipeline: how many are there, and how it is drawn.
class Stage {
  const Stage(this.label, this.count, {this.attention = false});
  final String label;
  final int count;
  final bool attention;
}

/// A stacked bar of where everything is, with a legend beneath. Stages
/// darken as they near the end; anything gone wrong is crimson.
class StageBar extends StatelessWidget {
  const StageBar({super.key, required this.stages});
  final List<Stage> stages;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final total = stages.fold<int>(0, (sum, s) => sum + s.count);
    Color colour(int i) {
      if (stages[i].attention) return p.accent;
      final t = stages.length <= 1 ? 1.0 : 0.3 + 0.7 * i / (stages.length - 1);
      return Color.lerp(p.hairline, p.ink, t)!;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Grow(
          builder: (t) => ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: SizedBox(
              height: 8,
              child: total == 0
                  ? ColoredBox(color: p.fill)
                  : Row(
                      children: [
                        for (var i = 0; i < stages.length; i++)
                          if (stages[i].count > 0)
                            Expanded(
                              flex: (stages[i].count * 1000 * t).round().clamp(1, 1 << 30),
                              child: Container(
                                margin: EdgeInsetsDirectional.only(end: i == stages.length - 1 ? 0 : 2),
                                color: colour(i),
                              ),
                            ),
                        if (t < 1)
                          Expanded(
                            flex: (total * 1000 * (1 - t)).round().clamp(1, 1 << 30),
                            child: ColoredBox(color: p.fill),
                          ),
                      ],
                    ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 14,
          runSpacing: 8,
          children: [
            for (var i = 0; i < stages.length; i++)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: colour(i), borderRadius: BorderRadius.circular(2)),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${stages[i].count}',
                    style: context.type.labelMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(stages[i].label, style: context.type.labelMedium?.copyWith(color: p.secondary)),
                  ),
                ],
              ),
          ],
        ),
      ],
    );
  }
}

/// The next seven days as bars, one per day, as tall as that day's
/// arrivals. Today is labelled in bold.
class WeekStrip extends StatelessWidget {
  const WeekStrip({super.key, required this.dates});

  /// The expected arrival dates, any time; those outside the week are ignored.
  final List<DateTime> dates;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final locale = Localizations.localeOf(context).toString();
    final now = clock.now();
    final today = DateTime(now.year, now.month, now.day);
    final counts = List<int>.filled(7, 0);
    for (final date in dates) {
      final day = DateTime(date.year, date.month, date.day).difference(today).inDays;
      if (day >= 0 && day < 7) counts[day]++;
    }
    final peak = math.max(1, counts.reduce(math.max));
    String initial(int i) {
      try {
        return DateFormat.E(locale).format(today.add(Duration(days: i))).characters.first;
      } catch (_) {
        return '';
      }
    }

    return _Grow(
      builder: (t) => Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < 7; i++)
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: counts[i] == 0 ? 4 : 4 + 24 * t * counts[i] / peak,
                    decoration: BoxDecoration(color: counts[i] == 0 ? p.hairline : p.ink, borderRadius: BorderRadius.circular(3)),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    initial(i),
                    style: context.type.labelSmall?.copyWith(
                      color: i == 0 ? p.ink : p.tertiary,
                      fontWeight: i == 0 ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// A ring filled to [fraction], with its centre left for a word or figure.
class RingChart extends StatelessWidget {
  const RingChart({super.key, required this.fraction, this.size = 44, this.attention = false});
  final double fraction;
  final double size;
  final bool attention;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return _Grow(
      builder: (t) => SizedBox.square(
        dimension: size,
        child: CustomPaint(
          painter: _Ring(fraction.clamp(0.0, 1.0) * t, track: p.fill, fill: attention ? p.accent : p.ink),
        ),
      ),
    );
  }
}

class _Ring extends CustomPainter {
  _Ring(this.value, {required this.track, required this.fill});
  final double value;
  final Color track;
  final Color fill;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = (Offset.zero & size).deflate(3);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, 0, math.pi * 2, false, paint..color = track);
    if (value > 0) canvas.drawArc(rect, -math.pi / 2, math.pi * 2 * value, false, paint..color = fill);
  }

  @override
  bool shouldRepaint(_Ring old) => old.value != value || old.fill != fill || old.track != track;
}

/// Grows a chart in from nothing on first appearance (and not under
/// reduce-motion).
class _Grow extends StatelessWidget {
  const _Grow({required this.builder});
  final Widget Function(double t) builder;

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: reduced ? 1 : 0, end: 1),
      duration: reduced ? Duration.zero : const Duration(milliseconds: 900),
      curve: Motion.easeOut,
      builder: (context, t, _) => builder(t),
    );
  }
}
