import 'package:flutter/material.dart';

import '../motion.dart';
import '../theme.dart';
import 'common.dart';

/// One figure in a [StatRow].
class Stat {
  const Stat(this.label, this.value, {this.attention = false, this.onTap});
  final String label;
  final int value;

  /// Crimson when above zero: something has gone wrong.
  final bool attention;
  final VoidCallback? onTap;
}

/// A handful of figures on one grouped card, split by hairlines: a
/// semibold number over a short grey label.
class StatRow extends StatelessWidget {
  const StatRow({super.key, required this.stats});
  final List<Stat> stats;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return GroupCard(
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < stats.length; i++) ...[
              if (i > 0) VerticalDivider(width: 0.33, thickness: 0.33, indent: 12, endIndent: 12, color: p.hairline),
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
        padding: const EdgeInsets.fromLTRB(12, 11, 8, 11),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FigureText(
              value: stat.value.toDouble(),
              format: (v) => '${v.round()}',
              style: context.type.headlineSmall?.copyWith(
                color: hot ? p.accent : p.ink,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            const SizedBox(height: 1),
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

/// A grouped card with padding: any block that is not a list of rows.
class Surface extends StatelessWidget {
  const Surface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(kGutter),
    this.margin = const EdgeInsets.symmetric(horizontal: kGutter),
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) => GroupCard(margin: margin, padding: padding, child: child);
}
