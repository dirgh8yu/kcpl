import 'package:flutter/material.dart';

import '../motion.dart';
import '../theme.dart';

/// A section's title above its card, as iOS lists raise a prominent header:
/// the headline weight in ink, with an optional quiet action on the right.
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.actionLabel, this.onAction, this.top = 28, this.count, this.attention = false});
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final double top;

  /// How many rows the section holds, in grey after the title (crimson
  /// with [attention]), as Reminders counts a list.
  final int? count;
  final bool attention;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: EdgeInsets.fromLTRB(kGutter + 4, top, actionLabel == null ? kGutter + 4 : kGutter - 4, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: title),
                  if (count != null)
                    TextSpan(
                      text: '  $count',
                      style: TextStyle(color: attention ? p.accent : p.secondary, fontWeight: FontWeight.w400),
                    ),
                ],
              ),
              style: context.type.titleLarge,
            ),
          ),
          if (actionLabel != null)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onAction,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Text(actionLabel!, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
              ),
            ),
        ],
      ),
    );
  }
}

/// A grouped card: rows on one rounded white surface, inset from the screen
/// edge, split by hairlines that start where the text does.
class RowGroup extends StatelessWidget {
  const RowGroup({super.key, required this.children, this.indent = kGutter, this.margin});
  final List<Widget> children;

  /// Where separators start, from the card's leading edge. Rows with an icon
  /// use [iconIndent], so the rule runs under the text, not the icon.
  final double indent;
  final EdgeInsetsGeometry? margin;

  /// Separator inset for rows that lead with an icon.
  static const iconIndent = kGutter + RowTile.iconSlot + RowTile.iconGap;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) rows.add(Divider(indent: indent));
      rows.add(children[i]);
    }
    return GroupCard(
      margin: margin,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows),
    );
  }
}

/// The rounded surface a grouped block sits on. Press highlights inside it
/// are clipped to its corners.
class GroupCard extends StatelessWidget {
  const GroupCard({super.key, required this.child, this.margin, this.padding});
  final Widget child;
  final EdgeInsetsGeometry? margin;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: margin ?? const EdgeInsets.symmetric(horizontal: kGutter),
      child: Material(
        color: p.surface,
        borderRadius: BorderRadius.circular(kCardRadius),
        clipBehavior: Clip.antiAlias,
        child: padding == null ? child : Padding(padding: padding!, child: child),
      ),
    );
  }
}

/// The app's one list row, as iOS draws a cell: 17pt text on the card, an
/// optional icon in a fixed slot, supporting text beneath in grey, and the
/// press highlight the instant the finger lands.
class RowTile extends StatelessWidget {
  const RowTile({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.accessory,
    this.onTap,
    this.chevron = false,
    this.below,
  });

  final Widget title;
  final Widget? subtitle;
  final Widget? leading;
  final Widget? trailing;

  /// Grey detail at the end of the title's own line, such as a date, so the
  /// line beneath keeps the full width.
  final Widget? accessory;
  final VoidCallback? onTap;
  final bool chevron;

  /// Full-width content under the text, such as a journey bar.
  final Widget? below;

  /// Width of the icon slot, and the gap after it.
  static const iconSlot = 26.0;
  static const iconGap = 14.0;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 11),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              LayoutBuilder(
                builder: (context, constraints) => Row(
                  children: [
                    if (leading != null) ...[
                      ConstrainedBox(
                        constraints: const BoxConstraints(minWidth: iconSlot),
                        child: Center(child: leading),
                      ),
                      const SizedBox(width: iconGap),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (accessory == null)
                            DefaultTextStyle.merge(style: context.type.bodyLarge, child: title)
                          else
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: [
                                Expanded(
                                  child: DefaultTextStyle.merge(style: context.type.bodyLarge, child: title),
                                ),
                                const SizedBox(width: 10),
                                DefaultTextStyle.merge(
                                  style: context.type.bodyMedium?.copyWith(
                                    color: p.secondary,
                                    fontFeatures: const [FontFeature.tabularFigures()],
                                  ),
                                  child: accessory!,
                                ),
                              ],
                            ),
                          if (subtitle != null) ...[
                            const SizedBox(height: 2),
                            DefaultTextStyle.merge(
                              style: context.type.bodyMedium?.copyWith(color: p.secondary),
                              child: subtitle!,
                            ),
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
                        child: DefaultTextStyle.merge(
                          style: context.type.bodyLarge?.copyWith(color: p.secondary),
                          child: trailing!,
                        ),
                      ),
                    ],
                    if (chevron) ...[const SizedBox(width: 8), Icon(KIcons.chevron, size: 15, color: p.tertiary)],
                  ],
                ),
              ),
              if (below != null) ...[
                const SizedBox(height: 10),
                Padding(
                  padding: EdgeInsetsDirectional.only(start: leading == null ? 0 : iconSlot + iconGap),
                  child: below!,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A label and its value on one line, as Settings shows them: the label in
/// ink, the value in grey on the right. Long values stack beneath.
class DetailRow extends StatelessWidget {
  const DetailRow(this.label, this.value, {super.key, this.strong = false, this.stacked = false, this.emphasis = Emphasis.normal});
  final String label;
  final String value;
  final bool strong;
  final bool stacked;
  final Emphasis emphasis;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final labelStyle = context.type.bodyLarge;
    final valueColour = emphasis == Emphasis.attention ? p.accent : (strong ? p.ink : p.secondary);
    final valueStyle = context.type.bodyLarge?.copyWith(
      color: valueColour,
      fontWeight: strong ? FontWeight.w600 : FontWeight.w400,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 44),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 11),
        child: stacked
            ? SizedBox(
                width: double.infinity,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: context.type.bodySmall),
                    const SizedBox(height: 2),
                    Text(value, style: valueStyle?.copyWith(color: p.ink)),
                  ],
                ),
              )
            // The label keeps at most a little over half the line and
            // wraps beyond it; the value takes the rest.
            : LayoutBuilder(
                builder: (context, constraints) => Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: constraints.maxWidth * 0.55),
                      child: Text(label, style: labelStyle),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(value, textAlign: TextAlign.end, style: valueStyle),
                    ),
                  ],
                ),
              ),
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

/// Status as words, not as a coloured pill. Attention is crimson, with a
/// small dot so it does not rest on colour alone.
class StatusText extends StatelessWidget {
  const StatusText(this.label, this.emphasis, {super.key, this.style});
  final String label;
  final Emphasis emphasis;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final base = style ?? context.type.bodyMedium;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (emphasis == Emphasis.attention) ...[StatusDot(emphasis: emphasis, size: 6), const SizedBox(width: 5)],
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

/// A sentence that matters, on its own card: a symbol, the point in ink,
/// and any detail in grey. Only [Emphasis.attention] turns the symbol crimson.
class Notice extends StatelessWidget {
  const Notice({super.key, required this.title, this.body, this.emphasis = Emphasis.attention, this.card = true, this.margin});
  final String title;
  final String? body;
  final Emphasis emphasis;

  /// On a card of its own, or bare (as on the sign-in screen).
  final bool card;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final content = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Icon(
            emphasis == Emphasis.attention ? KIcons.warning : KIcons.info,
            size: 20,
            color: emphasis == Emphasis.attention ? p.accent : p.secondary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: context.type.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
              if (body != null) ...[const SizedBox(height: 2), Text(body!, style: context.type.bodyMedium?.copyWith(color: p.secondary))],
            ],
          ),
        ),
      ],
    );
    if (!card) return content;
    return GroupCard(margin: margin, padding: const EdgeInsets.fromLTRB(kGutter, 13, kGutter, 13), child: content);
  }
}

/// Nothing to show: a quiet symbol, a line in ink and a line in grey, as iOS
/// shows an empty or unavailable view.
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
      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 30, color: p.tertiary),
          const SizedBox(height: 12),
          Text(title, style: context.type.titleLarge, textAlign: TextAlign.center),
          const SizedBox(height: 4),
          Text(
            description,
            style: context.type.bodyMedium?.copyWith(color: p.secondary),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[const SizedBox(height: 18), action!],
        ],
      ),
    );
  }
}

/// Grey text under a card, aligned with the text inside it: a group footer.
class Footnote extends StatelessWidget {
  const Footnote(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(kGutter * 2, 8, kGutter * 2, 0),
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
    final size = (resolved.fontSize ?? 17) * 0.78;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: origin.isEmpty ? '—' : origin),
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: size * 0.35),
              child: Icon(KIcons.arrowRight, size: size, color: context.palette.tertiary),
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

/// Placeholder rows while a screen loads: the card and its rows arrive
/// before the data does.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.rows = 6});
  final int rows;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    Widget bar(double width, double height) => Container(
      width: width,
      height: height,
      decoration: BoxDecoration(color: p.fill, borderRadius: BorderRadius.circular(4)),
    );
    return Semantics(
      label: MaterialLocalizations.of(context).refreshIndicatorSemanticLabel,
      child: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Shimmer(
          child: RowGroup(
            children: [
              for (var i = 0; i < rows; i++)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [bar(i.isEven ? 180 : 140, 13), const SizedBox(height: 8), bar(i.isEven ? 110 : 150, 11)],
                        ),
                      ),
                      bar(44, 12),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
