import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class KcplColors {
  static const crimson = Color(0xFFDC143C);
}

/// Black and white, with greys only for hierarchy. Crimson is kept for the
/// few things that deserve it: the brand mark, journey progress, and
/// whatever needs the customer to act or is costing them money.
@immutable
class Palette extends ThemeExtension<Palette> {
  const Palette({
    required this.ink,
    required this.paper,
    required this.secondary,
    required this.tertiary,
    required this.hairline,
    required this.fill,
    required this.accent,
  });

  final Color ink;
  final Color paper;
  final Color secondary;
  final Color tertiary;
  final Color hairline;
  final Color fill;
  final Color accent;

  static const light = Palette(
    ink: Color(0xFF000000),
    paper: Color(0xFFFFFFFF),
    secondary: Color(0xFF6B6B6B),
    tertiary: Color(0xFFABABAB),
    hairline: Color(0xFFE6E6E6),
    fill: Color(0xFFF4F4F4),
    accent: KcplColors.crimson,
  );

  // Crimson lifted a step on black, or it reads as maroon.
  static const dark = Palette(
    ink: Color(0xFFFFFFFF),
    paper: Color(0xFF000000),
    secondary: Color(0xFF9A9A9A),
    tertiary: Color(0xFF5C5C5C),
    hairline: Color(0xFF242424),
    fill: Color(0xFF141414),
    accent: Color(0xFFFF3358),
  );

  @override
  Palette copyWith({Color? ink, Color? paper, Color? secondary, Color? tertiary, Color? hairline, Color? fill, Color? accent}) =>
      Palette(
        ink: ink ?? this.ink,
        paper: paper ?? this.paper,
        secondary: secondary ?? this.secondary,
        tertiary: tertiary ?? this.tertiary,
        hairline: hairline ?? this.hairline,
        fill: fill ?? this.fill,
        accent: accent ?? this.accent,
      );

  @override
  Palette lerp(Palette? other, double t) {
    if (other == null) return this;
    return Palette(
      ink: Color.lerp(ink, other.ink, t)!,
      paper: Color.lerp(paper, other.paper, t)!,
      secondary: Color.lerp(secondary, other.secondary, t)!,
      tertiary: Color.lerp(tertiary, other.tertiary, t)!,
      hairline: Color.lerp(hairline, other.hairline, t)!,
      fill: Color.lerp(fill, other.fill, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
    );
  }
}

extension PaletteOf on BuildContext {
  Palette get palette => Theme.of(this).extension<Palette>()!;
  TextTheme get type => Theme.of(this).textTheme;
}

/// How loudly a piece of status speaks. Only [attention] is ever crimson.
enum Emphasis { normal, muted, attention }

extension EmphasisColor on Palette {
  Color of(Emphasis emphasis) => switch (emphasis) {
        Emphasis.normal => ink,
        Emphasis.muted => secondary,
        Emphasis.attention => accent,
      };
}

/// Horizontal page margin. Every row, header and hero aligns to it.
const kGutter = 20.0;

const _tabular = [FontFeature.tabularFigures()];

ThemeData kcplTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final p = dark ? Palette.dark : Palette.light;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: p.ink,
    onPrimary: p.paper,
    primaryContainer: p.fill,
    onPrimaryContainer: p.ink,
    secondary: p.ink,
    onSecondary: p.paper,
    secondaryContainer: p.fill,
    onSecondaryContainer: p.ink,
    tertiary: p.accent,
    onTertiary: Colors.white,
    error: p.accent,
    onError: Colors.white,
    surface: p.paper,
    onSurface: p.ink,
    onSurfaceVariant: p.secondary,
    surfaceContainerLowest: p.paper,
    surfaceContainerLow: p.fill,
    surfaceContainer: p.fill,
    surfaceContainerHigh: p.fill,
    surfaceContainerHighest: p.fill,
    outline: p.hairline,
    outlineVariant: p.hairline,
    surfaceTint: Colors.transparent,
    inverseSurface: p.ink,
    onInverseSurface: p.paper,
  );

  final base = ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    brightness: brightness,
    scaffoldBackgroundColor: p.paper,
    canvasColor: p.paper,
    fontFamilyFallback: const ['NotoSansDevanagari'],
    // Press feedback is an instant grey wash, like a native list, rather
    // than an ink ripple spreading from the finger.
    splashFactory: NoSplash.splashFactory,
    highlightColor: p.fill,
    hoverColor: p.fill,
    extensions: [p],
  );

  // Tracking tightens as size grows; body stays near zero.
  final t = base.textTheme.apply(bodyColor: p.ink, displayColor: p.ink);
  final text = t.copyWith(
    headlineLarge: t.headlineLarge?.copyWith(fontSize: 36, fontWeight: FontWeight.w700, letterSpacing: -1.2, height: 1.1, fontFeatures: _tabular),
    headlineMedium: t.headlineMedium?.copyWith(fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: -0.9, height: 1.15),
    headlineSmall: t.headlineSmall?.copyWith(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.6, height: 1.2),
    titleLarge: t.titleLarge?.copyWith(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.4, height: 1.25),
    titleMedium: t.titleMedium?.copyWith(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: -0.2, height: 1.3),
    titleSmall: t.titleSmall?.copyWith(fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: -0.1, height: 1.3),
    bodyLarge: t.bodyLarge?.copyWith(fontSize: 16, letterSpacing: -0.1, height: 1.4),
    bodyMedium: t.bodyMedium?.copyWith(fontSize: 15, letterSpacing: -0.1, height: 1.4),
    bodySmall: t.bodySmall?.copyWith(fontSize: 13, letterSpacing: 0, height: 1.35, color: p.secondary),
    labelLarge: t.labelLarge?.copyWith(fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: -0.1),
    labelMedium: t.labelMedium?.copyWith(fontSize: 13, fontWeight: FontWeight.w500, letterSpacing: 0),
    labelSmall: t.labelSmall?.copyWith(fontSize: 11, fontWeight: FontWeight.w500, letterSpacing: 0.1),
  );

  final radius = BorderRadius.circular(14);

  return base.copyWith(
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: p.paper,
      foregroundColor: p.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      systemOverlayStyle: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.paper,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      height: 62,
      indicatorColor: Colors.transparent,
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(size: 24, color: states.contains(WidgetState.selected) ? p.ink : p.tertiary),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith((states) => text.labelSmall?.copyWith(
            color: states.contains(WidgetState.selected) ? p.ink : p.tertiary,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
          )),
    ),
    dividerTheme: DividerThemeData(color: p.hairline, space: 0.5, thickness: 0.5),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: p.ink,
        foregroundColor: p.paper,
        disabledBackgroundColor: p.fill,
        disabledForegroundColor: p.tertiary,
        minimumSize: const Size.fromHeight(54),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: text.titleMedium?.copyWith(fontSize: 17),
        splashFactory: NoSplash.splashFactory,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: p.ink,
        side: BorderSide(color: p.hairline),
        minimumSize: const Size(0, 44),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: text.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: p.ink, textStyle: text.labelLarge, splashFactory: NoSplash.splashFactory),
    ),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(foregroundColor: p.ink)),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.fill,
      hintStyle: text.bodyLarge?.copyWith(color: p.secondary),
      labelStyle: text.bodyLarge?.copyWith(color: p.secondary),
      floatingLabelStyle: text.bodySmall?.copyWith(color: p.secondary),
      prefixIconColor: p.secondary,
      suffixIconColor: p.secondary,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide.none),
      disabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.ink, width: 1.5)),
    ),
    textSelectionTheme: TextSelectionThemeData(cursorColor: p.ink, selectionHandleColor: p.ink, selectionColor: p.ink.withValues(alpha: 0.15)),
    chipTheme: ChipThemeData(
      backgroundColor: p.fill,
      selectedColor: p.ink,
      disabledColor: p.fill,
      side: BorderSide.none,
      shape: const StadiumBorder(),
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      labelStyle: WidgetStateTextStyle.resolveWith((states) => (text.labelLarge ?? const TextStyle()).copyWith(
            fontSize: 14,
            color: states.contains(WidgetState.selected) ? p.paper : p.ink,
          )),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: p.ink, circularTrackColor: Colors.transparent),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: p.ink,
      contentTextStyle: text.bodyMedium?.copyWith(color: p.paper),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: p.paper,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: p.tertiary,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    ),
    listTileTheme: ListTileThemeData(iconColor: p.ink, textColor: p.ink),
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    }),
  );
}
