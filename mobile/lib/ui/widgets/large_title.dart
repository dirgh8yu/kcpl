import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import '../theme.dart';
import 'glass.dart';

/// A large title that eases into the bar as the page scrolls: 32pt and bold
/// at rest, 17pt beside the back button when collapsed, with a hairline
/// appearing only once content runs under it.
class LargeTitleBar extends StatelessWidget {
  const LargeTitleBar({super.key, required this.title});
  final String title;

  static const _toolbar = 52.0;
  static const _extra = 56.0;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final route = ModalRoute.of(context);
    final canPop = route?.impliesAppBarDismissal ?? false;
    final sheet = route is PageRoute && route.fullscreenDialog;
    return SliverAppBar(
      pinned: true,
      // A sheet closes with a round button, as iOS sheets do.
      leading: canPop && sheet
          ? Center(
              child: CloseButton(
                style: IconButton.styleFrom(
                  backgroundColor: p.fill,
                  foregroundColor: p.secondary,
                  fixedSize: const Size(34, 34),
                  minimumSize: const Size(34, 34),
                  padding: EdgeInsets.zero,
                  iconSize: 18,
                ),
              ),
            )
          : null,
      toolbarHeight: _toolbar,
      expandedHeight: _toolbar + _extra,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      elevation: 0,
      flexibleSpace: LayoutBuilder(
        builder: (context, constraints) {
          final top = MediaQuery.paddingOf(context).top;
          final min = _toolbar + top;
          final t = ((constraints.maxHeight - min) / _extra).clamp(0.0, 1.0);
          final start = lerpDouble(canPop ? 56 : kGutter, kGutter, t)!;
          return Stack(
            children: [
              // Solid at rest; frosted once content runs beneath, as iOS does.
              Positioned.fill(
                child: t >= 0.999 ? ColoredBox(color: p.paper) : const Glass(opacity: 0.8, child: SizedBox.expand()),
              ),
              PositionedDirectional(
                start: start,
                end: kGutter,
                bottom: lerpDouble(14, 6, t)!,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: AlignmentDirectional.centerStart,
                  child: Text(
                    title,
                    maxLines: 1,
                    style: context.type.headlineMedium?.copyWith(
                      fontSize: lerpDouble(17, 32, t),
                      fontWeight: FontWeight.lerp(FontWeight.w600, FontWeight.w700, t),
                      letterSpacing: lerpDouble(-0.2, -1.0, t),
                      height: 1.15,
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Opacity(
                  opacity: (1 - t * 3).clamp(0.0, 1.0),
                  child: Container(height: 0.5, color: p.hairline),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
