import 'package:flutter/material.dart';

import '../motion.dart';
import '../theme.dart';

/// One figure in a [StatRow].
class Stat {
  const Stat(this.label, this.value, {this.attention = false, this.onTap});
  final String label;
  final int value;

  /// Crimson when above zero: something has gone wrong.
  final bool attention;
  final VoidCallback? onTap;
}

/// A handful of figures in one quiet card, split by hairlines: a small
/// number over a short grey label, as a banking app shows balances.
class StatRow extends StatelessWidget {
  const StatRow({super.key, required this.stats});
  final List<Stat> stats;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: kGutter),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: p.hairline, width: p.isDark ? 1 : 0.8),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < stats.length; i++) ...[
              if (i > 0) VerticalDivider(width: 1, thickness: 0.8, indent: 14, endIndent: 14, color: p.hairline),
              Expanded(child: _Cell(stats[i])),
            ],
          ],
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell(this.stat);
  final Stat stat;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final hot = stat.attention && stat.value > 0;
    return InkWell(
      onTap: stat.onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 8, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CountUp(
              value: stat.value.toDouble(),
              format: (v) => '${v.round()}',
              style: context.type.headlineSmall?.copyWith(color: hot ? p.accent : p.ink),
            ),
            const SizedBox(height: 2),
            Text(
              stat.label,
              style: context.type.labelMedium?.copyWith(color: p.secondary),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

/// The card every grouped block sits on: white (a step up from black in
/// dark mode) with a hairline edge and no shadow.
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
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: p.hairline, width: p.isDark ? 1 : 0.8),
      ),
      child: child,
    );
  }
}
