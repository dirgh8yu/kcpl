import 'package:flutter/material.dart';

import '../motion.dart';
import '../theme.dart';
import 'glass.dart';

/// The navigation bar iOS gives a top-level page: a large title at rest,
/// on the page itself with no bar behind it; scrolled, the large title
/// slides up under a 44-point bar that frosts over, with a hairline, and a
/// small centred title fades in there.
class LargeTitleBar extends StatelessWidget {
  const LargeTitleBar({super.key, required this.title, this.actions = const []});
  final String title;

  /// Small buttons at the trailing end of the bar.
  final List<Widget> actions;

  static const toolbar = 44.0;
  static const _extra = 52.0;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final route = ModalRoute.of(context);
    final canPop = route?.impliesAppBarDismissal ?? false;
    final sheet = route is PageRoute && route.fullscreenDialog;
    return SliverAppBar(
      pinned: true,
      automaticallyImplyLeading: false,
      toolbarHeight: toolbar,
      expandedHeight: toolbar + _extra,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      elevation: 0,
      flexibleSpace: LayoutBuilder(
        builder: (context, constraints) {
          final top = MediaQuery.paddingOf(context).top;
          final min = toolbar + top;
          // 1 at rest, 0 once the large title has gone under the bar.
          final t = ((constraints.maxHeight - min) / _extra).clamp(0.0, 1.0);
          final collapsed = t < 0.02;
          final inline = ((0.35 - t) / 0.35).clamp(0.0, 1.0);
          return Stack(
            children: [
              // Chrome only once content runs beneath it.
              Positioned.fill(
                child: AnimatedOpacity(
                  opacity: collapsed ? 1 : 0,
                  duration: Motion.reduced(context) ? Duration.zero : const Duration(milliseconds: 150),
                  child: DecoratedBox(
                    position: DecorationPosition.foreground,
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: p.hairline, width: 0.33)),
                    ),
                    child: Glass(color: sheet ? p.paper : null, child: const SizedBox.expand()),
                  ),
                ),
              ),
              // The large title, riding up under the bar as the page scrolls.
              Positioned(
                left: kGutter + 4,
                right: kGutter,
                top: top + toolbar,
                bottom: 0,
                child: ClipRect(
                  child: Align(
                    alignment: AlignmentDirectional.bottomStart,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      // The page's heading for VoiceOver and TalkBack while
                      // it shows; once it has gone under the bar, the inline
                      // title takes over. Never both, so it is read once.
                      child: Opacity(
                        opacity: t,
                        child: Semantics(
                          header: true,
                          child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.type.displaySmall),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              // The bar: inline title centred, controls at the ends.
              Positioned(
                left: 0,
                right: 0,
                top: top,
                height: toolbar,
                child: NavigationToolbar(
                  leading: canPop && !sheet ? const _Back() : null,
                  middle: Opacity(
                    opacity: inline,
                    child: ExcludeSemantics(
                      excluding: !collapsed,
                      child: Semantics(
                        header: true,
                        child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.type.titleLarge),
                      ),
                    ),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [...actions, if (canPop && sheet) const SheetCloseButton(), const SizedBox(width: 10)],
                  ),
                  middleSpacing: 12,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// The round grey close button iOS puts in a sheet's corner.
class SheetCloseButton extends StatelessWidget {
  const SheetCloseButton({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Semantics(
      button: true,
      label: MaterialLocalizations.of(context).closeButtonTooltip,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => Navigator.of(context).maybePop(),
        child: SizedBox.square(
          dimension: 48,
          child: Center(
            child: Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(color: p.fill, shape: BoxShape.circle),
              child: Icon(KIcons.close, size: 15, color: p.secondary),
            ),
          ),
        ),
      ),
    );
  }
}

class _Back extends StatelessWidget {
  const _Back();

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: MaterialLocalizations.of(context).backButtonTooltip,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).maybePop(),
      child: SizedBox(width: 44, height: 44, child: Icon(KIcons.back, size: 22, color: context.palette.ink)),
    ),
  );
}
