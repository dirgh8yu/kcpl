import 'package:flutter/material.dart';

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

/// The tab bar, kept plain: frosted white across the bottom edge, grey outline icons, and the chosen tab in ink with its
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
    return Glass(
      opacity: 0.92,
      // No rule above it: the frost is the edge, as iOS draws it.
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
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
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
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              icon,
              const SizedBox(height: 3),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Text(
                  item.label,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  style: (context.type.labelSmall ?? const TextStyle()).copyWith(
                    color: colour,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
