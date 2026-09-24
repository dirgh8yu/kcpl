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

/// The tab bar as a frosted capsule floating over the content, with an ink
/// pill that slides to the chosen tab and settles with a small overshoot.
class FloatingTabBar extends StatelessWidget {
  const FloatingTabBar({super.key, required this.items, required this.selected, required this.onSelected, this.note});
  final List<TabItem> items;
  final int selected;
  final ValueChanged<int> onSelected;

  /// A line above the capsule, such as the demo notice.
  final String? note;

  /// Arrives quickly, overshoots a hair, settles: the feel of a spring.
  static const _slide = Cubic(0.34, 1.32, 0.5, 1);

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final reduced = Motion.reduced(context);
    final bottom = MediaQuery.paddingOf(context).bottom;
    // A tab bar keeps its size at large text settings, as the system's does.
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.15,
      child: Padding(
        padding: EdgeInsets.fromLTRB(14, 0, 14, bottom > 0 ? bottom : 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // On its own small glass pill, so it reads over whatever scrolls behind.
            if (note != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Glass(
                  borderRadius: BorderRadius.circular(99),
                  opacity: 0.85,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    child: Text(note!, style: context.type.labelSmall?.copyWith(color: p.secondary)),
                  ),
                ),
              ),
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(32),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: p.isDark ? 0.5 : 0.10),
                    blurRadius: 30,
                    offset: const Offset(0, 10),
                  ),
                  BoxShadow(
                    color: Colors.black.withValues(alpha: p.isDark ? 0.3 : 0.06),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Glass(
                borderRadius: BorderRadius.circular(32),
                opacity: p.isDark ? 0.72 : 0.8,
                border: true,
                child: SizedBox(
                  height: 64,
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final width = (constraints.maxWidth - 8) / items.length;
                      return Stack(
                        children: [
                          AnimatedPositioned(
                            duration: reduced ? Duration.zero : const Duration(milliseconds: 460),
                            curve: _slide,
                            left: 4 + width * selected,
                            top: 5,
                            bottom: 5,
                            width: width,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: p.ink,
                                borderRadius: BorderRadius.circular(27),
                                boxShadow: [
                                  BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 10, offset: const Offset(0, 3)),
                                ],
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
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
                      );
                    },
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

class TabBarItem extends StatelessWidget {
  const TabBarItem({super.key, required this.item, required this.selected, required this.onTap});
  final TabItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final colour = selected ? p.paper : p.secondary;
    final duration = Motion.reduced(context) ? Duration.zero : const Duration(milliseconds: 200);
    Widget icon = Icon(selected ? item.selectedIcon : item.icon, size: 19, color: colour);
    if (selected) icon = PopIn(key: ValueKey(item.label), child: icon);
    if (item.badge > 0) {
      icon = Badge(backgroundColor: p.accent, textColor: Colors.white, label: Text(item.badge > 99 ? '99+' : '${item.badge}'), child: icon);
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
            AnimatedDefaultTextStyle(
              duration: duration,
              style: (context.type.labelSmall ?? const TextStyle()).copyWith(
                color: colour,
                fontSize: 10.5,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                letterSpacing: 0,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: FittedBox(fit: BoxFit.scaleDown, child: Text(item.label, maxLines: 1)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
