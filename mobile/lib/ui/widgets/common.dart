import 'package:flutter/material.dart';

import '../motion.dart';
import '../theme.dart';

/// A bold section title with an optional quiet action, aligned to the gutter.
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.actionLabel, this.onAction, this.top = 36});
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final double top;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: EdgeInsets.fromLTRB(kGutter, top, actionLabel == null ? kGutter : 8, 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(child: Text(title, style: context.type.titleLarge)),
          if (actionLabel != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(foregroundColor: p.secondary),
              child: Text(actionLabel!),
            ),
        ],
      ),
    );
  }
}

/// Rows separated by hairlines inset to the text, as native lists are.
class RowGroup extends StatelessWidget {
  const RowGroup({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) rows.add(const Divider(indent: kGutter, endIndent: kGutter));
      rows.add(children[i]);
    }
    return Column(children: rows);
  }
}

/// The app's one list row. Full-bleed, no card; the press highlight is
/// instant and covers the whole row.
class RowTile extends StatelessWidget {
  const RowTile({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
    this.chevron = false,
    this.below,
  });

  final Widget title;
  final Widget? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool chevron;

  /// Full-width content under the text, such as a journey bar.
  final Widget? below;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            LayoutBuilder(
              builder: (context, constraints) => Row(
                children: [
                  if (leading != null) ...[leading!, const SizedBox(width: 14)],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        DefaultTextStyle.merge(style: context.type.titleMedium, child: title),
                        if (subtitle != null) ...[
                          const SizedBox(height: 3),
                          DefaultTextStyle.merge(style: context.type.bodySmall, child: subtitle!),
                        ],
                      ],
                    ),
                  ),
                  // Capped, so a large amount or a long status wraps inside its
                  // own space instead of pushing the row past the screen edge.
                  if (trailing != null) ...[
                    const SizedBox(width: 12),
                    ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: constraints.maxWidth * 0.45),
                      child: trailing!,
                    ),
                  ],
                  if (chevron) ...[const SizedBox(width: 6), Icon(Icons.chevron_right_rounded, size: 22, color: p.tertiary)],
                ],
              ),
            ),
            if (below != null) ...[const SizedBox(height: 12), below!],
          ],
        ),
      ),
    );
  }
}

/// Label on the left, value on the right; or stacked for long values.
class DetailRow extends StatelessWidget {
  const DetailRow(
    this.label,
    this.value, {
    super.key,
    this.strong = false,
    this.stacked = false,
    this.emphasis = Emphasis.normal,
  });
  final String label;
  final String value;
  final bool strong;
  final bool stacked;
  final Emphasis emphasis;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final labelStyle = context.type.bodyMedium?.copyWith(color: p.secondary);
    final valueStyle = context.type.bodyMedium?.copyWith(
      color: p.of(emphasis),
      fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 13),
      child: stacked
          ? SizedBox(
              width: double.infinity,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: labelStyle?.copyWith(fontSize: 13)),
                  const SizedBox(height: 2),
                  Text(value, style: valueStyle),
                ],
              ),
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 5, child: Text(label, style: labelStyle)),
                const SizedBox(width: 16),
                Expanded(
                  flex: 6,
                  child: Text(value, textAlign: TextAlign.end, style: valueStyle),
                ),
              ],
            ),
    );
  }
}

class StatusDot extends StatelessWidget {
  const StatusDot({super.key, this.emphasis = Emphasis.attention, this.size = 7});
  final Emphasis emphasis;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(color: context.palette.of(emphasis), shape: BoxShape.circle),
  );
}

/// Status as words, not as a coloured pill. Attention gets a crimson dot.
class StatusText extends StatelessWidget {
  const StatusText(this.label, this.emphasis, {super.key, this.style});
  final String label;
  final Emphasis emphasis;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final base = style ?? context.type.labelMedium;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (emphasis == Emphasis.attention) ...[StatusDot(emphasis: emphasis, size: 6), const SizedBox(width: 6)],
        Flexible(
          child: Text(
            label,
            style: base?.copyWith(color: p.of(emphasis)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

/// A sentence that matters, marked by a dot rather than a tinted box.
class Notice extends StatelessWidget {
  const Notice({
    super.key,
    required this.title,
    this.body,
    this.emphasis = Emphasis.attention,
    this.padding = const EdgeInsets.symmetric(horizontal: kGutter),
  });
  final String title;
  final String? body;
  final Emphasis emphasis;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 7),
            child: StatusDot(emphasis: emphasis, size: 8),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: context.type.titleMedium?.copyWith(color: emphasis == Emphasis.attention ? p.accent : p.ink)),
                if (body != null) ...[
                  const SizedBox(height: 4),
                  Text(body!, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
                ],
              ],
            ),
          ),
        ],
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
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 28, color: p.tertiary),
          const SizedBox(height: 14),
          Text(title, style: context.type.titleMedium, textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text(
            description,
            style: context.type.bodyMedium?.copyWith(color: p.secondary),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[const SizedBox(height: 20), action!],
        ],
      ),
    );
  }
}

/// Grey text under a section, for the footnotes the portal carries.
class Footnote extends StatelessWidget {
  const Footnote(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(kGutter, 16, kGutter, 0),
    child: Text(text, style: context.type.bodySmall),
  );
}

/// "Kolkata → Birgunj ICD". The arrow is an icon, so it renders in every
/// font on every platform.
class RouteText extends StatelessWidget {
  const RouteText(this.origin, this.destination, {super.key, this.style, this.maxLines = 1});
  final String origin;
  final String destination;
  final TextStyle? style;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final resolved = DefaultTextStyle.of(context).style.merge(style);
    final size = (resolved.fontSize ?? 16) * 0.9;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: origin.isEmpty ? '—' : origin),
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: size * 0.3),
              child: Icon(Icons.arrow_forward_rounded, size: size, color: context.palette.tertiary),
            ),
          ),
          TextSpan(text: destination.isEmpty ? '—' : destination),
        ],
      ),
      style: resolved,
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
    );
  }
}

/// Placeholder rows while a screen loads: the layout arrives before the data.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.rows = 6});
  final int rows;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    Widget bar(double width, double height) => Container(
      width: width,
      height: height,
      decoration: BoxDecoration(color: p.fill, borderRadius: BorderRadius.circular(6)),
    );
    return Semantics(
      label: MaterialLocalizations.of(context).refreshIndicatorSemanticLabel,
      child: Shimmer(
        child: Column(
          children: [
            for (var i = 0; i < rows; i++)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [bar(i.isEven ? 190 : 150, 14), const SizedBox(height: 8), bar(i.isEven ? 120 : 160, 11)],
                      ),
                    ),
                    bar(48, 12),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
