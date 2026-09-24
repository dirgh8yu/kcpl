import 'package:flutter/material.dart';

import '../motion.dart';
import '../theme.dart';
import 'glass.dart';

/// One destination in the [FloatingTabBar].
class TabItem {
  const TabItem({required this.icon, required this.selectedIcon, required this.label, this.badge = 0});
  final IconData icon;
  final IconData selectedIcon;
  final String label;

  /// A count on the icon, in crimson; nothing when zero.
  final int badge;
}

/// The tab bar, kept plain: frosted white across the bottom edge with a
/// hairline above, grey outline icons, and the chosen tab in ink with its
/// filled icon. Nothing slides or glows; the tab is simply there.
class FloatingTabBar extends StatelessWidget {
  const FloatingTabBar({super.key, required this.items, required this.selected, required this.onSelected, this.note});
  final List<TabItem> items;
  final int selected;
  final ValueChanged<int> onSelected;

  /// A small line above the tabs, such as the demo notice.
  final String? note;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    // A tab bar keeps its size at large text settings, as the system's does.
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.15,
      child: Glass(
        opacity: 0.92,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: p.hairline, width: 0.5)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (note != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 5),
                    child: Text(note!, style: context.type.labelSmall?.copyWith(color: p.tertiary)),
                  ),
                SizedBox(
                  height: 54,
                  child: Row(
                    children: [
                      for (var i = 0; i < items.length; i++)
                        Expanded(
                          child: TabBarItem(item: items[i], selected: i == selected, onTap: () => onSelected(i)),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class TabBarItem extends StatelessWidget {
  const TabBarItem({super.key, required this.item, required this.selected, required this.onTap});
  final TabItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final colour = selected ? p.ink : p.tertiary;
    Widget icon = Icon(selected ? item.selectedIcon : item.icon, size: 22, color: colour);
    if (selected) icon = PopIn(key: ValueKey(item.label), child: icon);
    if (item.badge > 0) {
      icon = Badge(
        backgroundColor: p.accent,
        textColor: Colors.white,
        smallSize: 7,
        label: Text(item.badge > 99 ? '99+' : '${item.badge}'),
        child: icon,
      );
    }
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            icon,
            const SizedBox(height: 3),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  item.label,
                  maxLines: 1,
                  style: (context.type.labelSmall ?? const TextStyle()).copyWith(
                    color: colour,
                    fontSize: 10,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
