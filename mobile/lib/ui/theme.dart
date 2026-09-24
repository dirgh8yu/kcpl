import 'package:flutter/material.dart';

/// KCPL's crimson on quiet neutral surfaces, the same restraint as the portal:
/// colour is reserved for brand moments and for status that needs a look.
class KcplColors {
  static const crimson = Color(0xFFDC143C);
  static const crimsonDeep = Color(0xFFB0102F);
}

enum Tone { neutral, info, success, warning, danger }

class ToneColors {
  const ToneColors(this.foreground, this.background);
  final Color foreground;
  final Color background;

  static ToneColors of(BuildContext context, Tone tone) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    switch (tone) {
      case Tone.neutral:
        return dark ? const ToneColors(Color(0xFFD4D4D8), Color(0xFF27272A)) : const ToneColors(Color(0xFF52525B), Color(0xFFF1F1F3));
      case Tone.info:
        return dark ? const ToneColors(Color(0xFF93C5FD), Color(0xFF172554)) : const ToneColors(Color(0xFF1D4ED8), Color(0xFFEFF4FF));
      case Tone.success:
        return dark ? const ToneColors(Color(0xFF86EFAC), Color(0xFF052E16)) : const ToneColors(Color(0xFF15803D), Color(0xFFECFDF3));
      case Tone.warning:
        return dark ? const ToneColors(Color(0xFFFCD34D), Color(0xFF3B2A06)) : const ToneColors(Color(0xFFB45309), Color(0xFFFFF7E6));
      case Tone.danger:
        return dark ? const ToneColors(Color(0xFFFCA5A5), Color(0xFF450A0A)) : const ToneColors(Color(0xFFB91C1C), Color(0xFFFEF1F1));
    }
  }
}

ThemeData kcplTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: KcplColors.crimson,
    brightness: brightness,
    dynamicSchemeVariant: DynamicSchemeVariant.fidelity,
  ).copyWith(
    primary: dark ? const Color(0xFFFF6B81) : KcplColors.crimson,
    onPrimary: Colors.white,
    surface: dark ? const Color(0xFF111113) : Colors.white,
    surfaceContainerLowest: dark ? const Color(0xFF0B0B0C) : const Color(0xFFF7F7F8),
    surfaceContainerLow: dark ? const Color(0xFF18181B) : const Color(0xFFF7F7F8),
    surfaceContainer: dark ? const Color(0xFF1C1C1F) : const Color(0xFFF3F3F5),
    outline: dark ? const Color(0xFF3F3F46) : const Color(0xFFD9D9DE),
    outlineVariant: dark ? const Color(0xFF27272A) : const Color(0xFFE8E8EC),
    onSurface: dark ? const Color(0xFFF4F4F5) : const Color(0xFF18181B),
    onSurfaceVariant: dark ? const Color(0xFFA1A1AA) : const Color(0xFF6B6B76),
  );

  final base = ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    brightness: brightness,
    fontFamilyFallback: const ['NotoSansDevanagari'],
  );
  final text = base.textTheme.apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface);
  final titleStyle = text.titleLarge?.copyWith(fontSize: 20, fontWeight: FontWeight.w600, letterSpacing: -0.3);

  return base.copyWith(
    scaffoldBackgroundColor: scheme.surfaceContainerLowest,
    textTheme: text.copyWith(
      headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.4),
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.3),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.1),
      labelSmall: text.labelSmall?.copyWith(letterSpacing: 0.2),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: titleStyle,
    ),
    cardTheme: CardThemeData(
      color: scheme.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: scheme.outlineVariant),
      ),
    ),
    dividerTheme: DividerThemeData(color: scheme.outlineVariant, space: 1, thickness: 1),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: scheme.primary.withValues(alpha: dark ? 0.22 : 0.10),
      labelTextStyle: WidgetStateProperty.resolveWith((states) => text.labelSmall?.copyWith(
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
          )),
      height: 68,
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      side: BorderSide(color: scheme.outlineVariant),
      showCheckmark: false,
      backgroundColor: scheme.surface,
      selectedColor: scheme.primary.withValues(alpha: dark ? 0.22 : 0.10),
      labelStyle: WidgetStateTextStyle.resolveWith((states) => (text.labelLarge ?? const TextStyle()).copyWith(
            color: states.contains(WidgetState.selected) ? scheme.primary : scheme.onSurfaceVariant,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
          )),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surface,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: scheme.outline)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: scheme.outline)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        selectedBackgroundColor: scheme.primary.withValues(alpha: dark ? 0.22 : 0.10),
        selectedForegroundColor: scheme.primary,
        side: BorderSide(color: scheme.outline),
      ),
    ),
    listTileTheme: const ListTileThemeData(contentPadding: EdgeInsets.symmetric(horizontal: 16)),
  );
}
