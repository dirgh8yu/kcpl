import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../theme.dart';

/// Frosted chrome: content scrolls beneath and shows through, blurred. Kept
/// for surfaces that float over content (the tab bar, a collapsed title,
/// the in-app banner), never for cards, where glass on white just reads as
/// grey. Under the system's high-contrast setting it turns solid.
class Glass extends StatelessWidget {
  const Glass({super.key, required this.child, this.borderRadius, this.opacity = 0.78, this.border = false});
  final Widget child;
  final BorderRadius? borderRadius;

  /// How much of the tint covers the blur: lower is glassier.
  final double opacity;
  final bool border;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final solid = MediaQuery.maybeHighContrastOf(context) ?? false;
    final decoration = BoxDecoration(
      color: solid ? p.paper : p.paper.withValues(alpha: opacity),
      borderRadius: borderRadius,
      border: border ? Border.all(color: p.hairline, width: 0.5) : null,
    );
    final content = DecoratedBox(decoration: decoration, child: child);
    final clipped = borderRadius == null
        ? ClipRect(child: _blur(solid, content))
        : ClipRRect(borderRadius: borderRadius!, child: _blur(solid, content));
    return clipped;
  }

  Widget _blur(bool solid, Widget child) => solid ? child : BackdropFilter(filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24), child: child);
}
