import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

export 'icons.dart';

class KcplColors {
  static const crimson = Color(0xFFDC143C);
}

/// Black and white, with greys only for hierarchy. Crimson is kept for the
/// few things that deserve it: the brand mark, journey progress, whatever
/// needs the customer to act or is costing them money, and the glow of the
/// one dark pass that leads each home screen.
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
    required this.surface,
    required this.shadow,
    required this.glow,
  });

  final Color ink;
  final Color paper;
  final Color secondary;
  final Color tertiary;
  final Color hairline;
  final Color fill;
  final Color accent;

  /// A raised card: white on white is lifted by [shadow]; on black it is a
  /// step up in tone, since shadows vanish there.
  final Color surface;
  final Color shadow;

  /// The crimson that light gives off: behind the pass, under the route.
  final Color glow;

  static const light = Palette(
    ink: Color(0xFF000000),
    paper: Color(0xFFFFFFFF),
    secondary: Color(0xFF737373),
    tertiary: Color(0xFFA3A3A3),
    hairline: Color(0xFFEBEBEB),
    fill: Color(0xFFF5F5F5),
    accent: KcplColors.crimson,
    surface: Color(0xFFFFFFFF),
    shadow: Color(0x0A000000),
    glow: Color(0xFFFF2D55),
  );

  // Crimson lifted a step on black, or it reads as maroon.
  static const dark = Palette(
    ink: Color(0xFFFFFFFF),
    paper: Color(0xFF000000),
    secondary: Color(0xFF9A9AA0),
    tertiary: Color(0xFF5C5C62),
    hairline: Color(0xFF232326),
    fill: Color(0xFF141416),
    accent: Color(0xFFFF3358),
    surface: Color(0xFF0F0F11),
    shadow: Color(0x00000000),
    glow: Color(0xFFFF2D55),
  );

  @override
  Palette copyWith({
    Color? ink,
    Color? paper,
    Color? secondary,
    Color? tertiary,
    Color? hairline,
    Color? fill,
    Color? accent,
    Color? surface,
    Color? shadow,
    Color? glow,
  }) => Palette(
    ink: ink ?? this.ink,
    paper: paper ?? this.paper,
    secondary: secondary ?? this.secondary,
    tertiary: tertiary ?? this.tertiary,
    hairline: hairline ?? this.hairline,
    fill: fill ?? this.fill,
    accent: accent ?? this.accent,
    surface: surface ?? this.surface,
    shadow: shadow ?? this.shadow,
    glow: glow ?? this.glow,
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
      surface: Color.lerp(surface, other.surface, t)!,
      shadow: Color.lerp(shadow, other.shadow, t)!,
      glow: Color.lerp(glow, other.glow, t)!,
    );
  }

  bool get isDark => paper.computeLuminance() < 0.5;

  /// A raised card's shadow: a wide soft one for depth and a tight one for
  /// contact, as real objects cast.
  List<BoxShadow> get lift => [
    BoxShadow(color: shadow, blurRadius: 24, offset: const Offset(0, 8)),
    BoxShadow(
      color: shadow.withValues(alpha: shadow.a * 0.6),
      blurRadius: 3,
      offset: const Offset(0, 1),
    ),
  ];
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
    fontFamily: 'Inter',
    fontFamilyFallback: const ['NotoSansDevanagari'],
    // Press feedback is an instant grey wash, like a native list, rather
    // than an ink ripple spreading from the finger.
    splashFactory: NoSplash.splashFactory,
    highlightColor: p.fill,
    hoverColor: p.fill,
    extensions: [p],
  );

  // Display sizes are set in Inter Tight, reading sizes in Inter. Tracking
  // tightens as size grows; body stays near zero.
  final t = base.textTheme.apply(bodyColor: p.ink, displayColor: p.ink);
  TextStyle? display(TextStyle? style, double size, FontWeight weight, double tracking, double height) => style?.copyWith(
    fontFamily: 'InterTight',
    fontSize: size,
    fontWeight: weight,
    letterSpacing: tracking,
    height: height,
    fontFeatures: _tabular,
  );
  // Tracking follows size: tighter as type grows, a touch open below 13pt.
  // A quiet scale, as the best phone apps keep it: one 28pt title per
  // page, 17pt section titles, 15pt reading text and 13pt for the rest.
  // Figures stay small; hierarchy comes from weight and grey, not size.
  final text = t.copyWith(
    displaySmall: display(t.displaySmall, 28, FontWeight.w700, -0.7, 1.12),
    headlineLarge: display(t.headlineLarge, 26, FontWeight.w700, -0.6, 1.15),
    headlineMedium: display(t.headlineMedium, 22, FontWeight.w700, -0.5, 1.18),
    headlineSmall: display(t.headlineSmall, 20, FontWeight.w600, -0.4, 1.2),
    titleLarge: t.titleLarge?.copyWith(fontSize: 17, fontWeight: FontWeight.w600, letterSpacing: -0.3, height: 1.25),
    titleMedium: t.titleMedium?.copyWith(fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: -0.2, height: 1.3),
    titleSmall: t.titleSmall?.copyWith(fontSize: 14, fontWeight: FontWeight.w600, letterSpacing: -0.15, height: 1.3),
    bodyLarge: t.bodyLarge?.copyWith(fontSize: 15, letterSpacing: -0.15, height: 1.4),
    bodyMedium: t.bodyMedium?.copyWith(fontSize: 14, letterSpacing: -0.1, height: 1.4),
    bodySmall: t.bodySmall?.copyWith(fontSize: 13, letterSpacing: 0, height: 1.35, color: p.secondary),
    labelLarge: t.labelLarge?.copyWith(fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: -0.15),
    labelMedium: t.labelMedium?.copyWith(fontSize: 12, fontWeight: FontWeight.w500, letterSpacing: 0.1),
    labelSmall: t.labelSmall?.copyWith(fontSize: 11, fontWeight: FontWeight.w500, letterSpacing: 0.2),
  );

  final radius = BorderRadius.circular(12);

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
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => text.labelSmall?.copyWith(
          color: states.contains(WidgetState.selected) ? p.ink : p.tertiary,
          fontWeight: states.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
        ),
      ),
    ),
    dividerTheme: DividerThemeData(color: p.hairline, space: 0.5, thickness: 0.5),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: p.ink,
        foregroundColor: p.paper,
        disabledBackgroundColor: p.fill,
        disabledForegroundColor: p.tertiary,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: text.titleMedium,
        splashFactory: NoSplash.splashFactory,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: p.ink,
        side: BorderSide(color: p.hairline),
        minimumSize: const Size(0, 48),
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
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide.none),
      disabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: p.ink, width: 1.5),
      ),
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: p.ink,
      selectionHandleColor: p.ink,
      selectionColor: p.ink.withValues(alpha: 0.15),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: p.fill,
      selectedColor: p.ink,
      disabledColor: p.fill,
      side: BorderSide.none,
      shape: const StadiumBorder(),
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      labelPadding: const EdgeInsets.symmetric(horizontal: 8),
      labelStyle: WidgetStateTextStyle.resolveWith(
        (states) => (text.labelLarge ?? const TextStyle()).copyWith(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: states.contains(WidgetState.selected) ? p.paper : p.ink,
        ),
      ),
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
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {TargetPlatform.android: PredictiveBackPageTransitionsBuilder(), TargetPlatform.iOS: CupertinoPageTransitionsBuilder()},
    ),
  );
}
