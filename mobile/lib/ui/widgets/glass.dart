import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../theme.dart';

/// Frosted chrome, as iOS draws its bars: content scrolls beneath and shows
/// through, blurred and a little brighter. Kept for surfaces that float over
/// content (the tab bar, a scrolled title bar, the in-app banner), never
/// for cards. Under the system's high-contrast setting it turns solid.
class Glass extends StatelessWidget {
  const Glass({super.key, required this.child, this.borderRadius, this.opacity = 0.86, this.border = false, this.color});
  final Widget child;
  final BorderRadius? borderRadius;

  /// How much of the tint covers the blur: lower is glassier.
  final double opacity;
  final bool border;

  /// The tint; the bar colour of the current appearance by default.
  final Color? color;

  /// The bar tint iOS uses over content: near-white, or near-black.
  static Color chrome(Palette p) => p.isDark ? const Color(0xFF161618) : const Color(0xFFF9F9F9);

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final solid = MediaQuery.maybeHighContrastOf(context) ?? false;
    final tint = color ?? chrome(p);
    final decoration = BoxDecoration(
      color: solid ? tint : tint.withValues(alpha: opacity),
      borderRadius: borderRadius,
      border: border ? Border.all(color: p.hairline, width: 0.5) : null,
    );
    final content = DecoratedBox(decoration: decoration, child: child);
    final clipped = borderRadius == null
        ? ClipRect(child: _blur(solid, content))
        : ClipRRect(borderRadius: borderRadius!, child: _blur(solid, content));
    return clipped;
  }

  // Blurred and saturated, so colour beneath glows through rather than
  // turning to grey.
  Widget _blur(bool solid, Widget child) => solid
      ? child
      : BackdropFilter(
          filter: ImageFilter.compose(outer: ImageFilter.blur(sigmaX: 24, sigmaY: 24), inner: const ColorFilter.matrix(_saturate)),
          child: child,
        );

  // A 1.6x saturation matrix (Rec. 709 luma weights).
  static const _saturate = <double>[
    1.4724, -0.4291, -0.0433, 0, 0, //
    -0.1276, 1.1709, -0.0433, 0, 0, //
    -0.1276, -0.4291, 1.5567, 0, 0, //
    0, 0, 0, 1, 0,
  ];
}
