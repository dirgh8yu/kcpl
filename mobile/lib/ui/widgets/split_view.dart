import 'package:flutter/material.dart';

import '../theme.dart';

/// On a tablet, a list and the item opened from it side by side, as Mail and
/// Files are on iPad; on a phone, just the list, whose rows open their item
/// as a sheet. Rows ask [SplitView.select] first and push only when there is
/// no pane beside them to fill.
class SplitView extends StatefulWidget {
  const SplitView({super.key, required this.list, required this.detail, required this.placeholder});

  final Widget list;
  final Widget Function(BuildContext context, String id) detail;

  /// The pane before anything is chosen.
  final Widget placeholder;

  /// iPad mini upright is 744 points: every iPad gets two columns, a phone
  /// on its side (under 740 tall-edge-down) keeps one.
  static const breakpoint = 740.0;

  static bool wide(BuildContext context) => MediaQuery.sizeOf(context).width >= breakpoint;

  /// Opens [id] in the pane beside the list [context] is in; false when
  /// there is none (a phone, or a list outside a split).
  static bool select(BuildContext context, String id) {
    final scope = context.getInheritedWidgetOfExactType<_SplitScope>();
    if (scope == null) return false;
    scope.onSelect(id);
    return true;
  }

  /// The item showing beside the list, for the row to mark as chosen.
  static String? selectedOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_SplitScope>()?.selected;

  @override
  State<SplitView> createState() => _SplitViewState();
}

class _SplitViewState extends State<SplitView> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    if (!SplitView.wide(context)) return widget.list;
    final p = context.palette;
    final media = MediaQuery.of(context);
    final width = media.size.width;
    final listWidth = (width * 0.38).clamp(320.0, 420.0);
    final selected = _selected;
    // Each column is told its own width, so what sizes itself by the screen
    // (a bubble's widest, a sheet's margin) sizes itself by the column.
    Widget column(double columnWidth, Widget child) => MediaQuery(
      data: media.copyWith(size: Size(columnWidth, media.size.height)),
      child: child,
    );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: listWidth,
          child: column(listWidth, _SplitScope(selected: selected, onSelect: (id) => setState(() => _selected = id), child: widget.list)),
        ),
        VerticalDivider(width: 0.5, thickness: 0.5, color: p.hairline),
        Expanded(
          child: column(
            width - listWidth - 0.5,
            ColoredBox(
              color: p.paper,
              child: selected == null ? widget.placeholder : KeyedSubtree(key: ValueKey(selected), child: widget.detail(context, selected)),
            ),
          ),
        ),
      ],
    );
  }
}

class _SplitScope extends InheritedWidget {
  const _SplitScope({required this.selected, required this.onSelect, required super.child});
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  bool updateShouldNotify(_SplitScope old) => old.selected != selected;
}

/// Marks the row whose item is open beside the list.
class SplitSelected extends StatelessWidget {
  const SplitSelected({super.key, required this.id, required this.child});
  final String id;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final chosen = SplitView.selectedOf(context) == id;
    if (!chosen) return child;
    return Semantics(
      selected: true,
      child: ColoredBox(color: context.palette.pressed, child: child),
    );
  }
}
