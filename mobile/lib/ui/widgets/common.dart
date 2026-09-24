import 'package:flutter/material.dart';

import '../theme.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.label, this.tone, {super.key});
  final String label;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    final colors = ToneColors.of(context, tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: colors.background, borderRadius: BorderRadius.circular(6)),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.foreground, fontWeight: FontWeight.w600),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, required this.description, this.action});
  final IconData icon;
  final String title;
  final String description;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(color: theme.colorScheme.surfaceContainer, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          Text(title, style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text(
            description,
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[const SizedBox(height: 20), action!],
        ],
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.actionLabel, this.onAction, this.description});
  final String title;
  final String? description;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 8, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleMedium),
                if (description != null) ...[
                  const SizedBox(height: 2),
                  Text(description!, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                ],
              ],
            ),
          ),
          if (actionLabel != null) TextButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ),
    );
  }
}

/// A bordered group of rows, the app's basic surface.
class Panel extends StatelessWidget {
  const Panel({super.key, required this.children, this.margin = const EdgeInsets.symmetric(horizontal: 16)});
  final List<Widget> children;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) rows.add(const Divider(indent: 16));
      rows.add(children[i]);
    }
    return Padding(
      padding: margin,
      child: Card(clipBehavior: Clip.antiAlias, child: Column(children: rows)),
    );
  }
}

class InfoRow extends StatelessWidget {
  const InfoRow(this.label, this.value, {super.key, this.emphasis = false, this.stacked = false});
  final String label;
  final String value;
  final bool emphasis;

  /// Label above value, for values too long to share a line (an email).
  final bool stacked;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (stacked) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: SizedBox(
          width: double.infinity,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 2),
              Text(value, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(label, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 3,
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: theme.textTheme.bodyMedium?.copyWith(fontWeight: emphasis ? FontWeight.w700 : FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

/// A tinted notice for things that cost the customer money or need action.
class Callout extends StatelessWidget {
  const Callout({
    super.key,
    required this.tone,
    required this.icon,
    required this.title,
    this.body,
    this.margin = const EdgeInsets.symmetric(horizontal: 16),
  });
  final Tone tone;
  final IconData icon;
  final String title;
  final String? body;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final colors = ToneColors.of(context, tone);
    final theme = Theme.of(context);
    return Container(
      margin: margin,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: colors.background, borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: colors.foreground),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleSmall?.copyWith(color: colors.foreground, fontWeight: FontWeight.w600)),
                if (body != null) ...[
                  const SizedBox(height: 4),
                  Text(body!, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A badge at the end of a row. It shrinks instead of overflowing when the
/// label is long (Nepali, large system text) and stays flush to the end.
class TrailingBadge extends StatelessWidget {
  const TrailingBadge(this.label, this.tone, {super.key});
  final String label;
  final Tone tone;

  @override
  Widget build(BuildContext context) => Flexible(
        child: Align(alignment: AlignmentDirectional.centerEnd, child: StatusBadge(label, tone)),
      );
}
