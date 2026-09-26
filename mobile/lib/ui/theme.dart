import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

export 'icons.dart';

class KcplColors {
  static const crimson = Color(0xFFDC143C);
}

/// Apple's grouped look: a soft grey page with white cells on it (black and
/// graphite in dark mode), label greys for hierarchy, and hairline
/// separators. Everything is black, white or grey; crimson is kept for the
/// brand, the one primary action, and whatever needs the customer to act.
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
    required this.pressed,
    required this.shadow,
  });

  /// Primary text and icons (label).
  final Color ink;

  /// The page behind grouped cells (systemGroupedBackground).
  final Color paper;

  /// Supporting text (secondaryLabel).
  final Color secondary;

  /// Placeholder text, chevrons, disabled (tertiaryLabel).
  final Color tertiary;

  /// Separators between rows and around chrome.
  final Color hairline;

  /// Search fields, tracks, skeleton bars (a system fill).
  final Color fill;
  final Color accent;

  /// A grouped cell or card (secondarySystemGroupedBackground).
  final Color surface;

  /// A cell under the finger: the instant grey wash of a native list.
  final Color pressed;

  /// Under floating chrome in light mode; nothing in dark, where shadows vanish.
  final Color shadow;

  static const light = Palette(
    ink: Color(0xFF000000),
    paper: Color(0xFFF2F2F7),
    // Darker than Apple's secondaryLabel so small grey text reads at WCAG
    // AA (4.5:1) on white, the grouped grey and the fill.
    secondary: Color(0xFF636366),
    tertiary: Color(0xFFC4C4C7),
    hairline: Color(0xFFC6C6C8),
    fill: Color(0xFFE9E9EE),
    accent: KcplColors.crimson,
    surface: Color(0xFFFFFFFF),
    pressed: Color(0xFFD1D1D6),
    shadow: Color(0x14000000),
  );

  // Crimson lifted a step on black, or it reads as maroon.
  static const dark = Palette(
    ink: Color(0xFFFFFFFF),
    paper: Color(0xFF000000),
    // Likewise at 4.5:1 or more on black and both raised greys.
    secondary: Color(0xFF98989D),
    tertiary: Color(0xFF5A5A5F),
    hairline: Color(0xFF38383A),
    fill: Color(0xFF1C1C1E),
    accent: Color(0xFFFF3358),
    surface: Color(0xFF1C1C1E),
    pressed: Color(0xFF3A3A3C),
    shadow: Color(0x00000000),
  );

  /// The same palette one layer up, for sheets: in dark mode a sheet is
  /// graphite and its cells a step lighter, as iOS lifts modal surfaces.
  Palette get raised => isDark
      ? copyWith(
          paper: const Color(0xFF1C1C1E),
          surface: const Color(0xFF2C2C2E),
          fill: const Color(0xFF2C2C2E),
          hairline: const Color(0xFF3D3D40),
        )
      : this;

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
    Color? pressed,
    Color? shadow,
  }) => Palette(
    ink: ink ?? this.ink,
    paper: paper ?? this.paper,
    secondary: secondary ?? this.secondary,
    tertiary: tertiary ?? this.tertiary,
    hairline: hairline ?? this.hairline,
    fill: fill ?? this.fill,
    accent: accent ?? this.accent,
    surface: surface ?? this.surface,
    pressed: pressed ?? this.pressed,
    shadow: shadow ?? this.shadow,
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
      pressed: Color.lerp(pressed, other.pressed, t)!,
      shadow: Color.lerp(shadow, other.shadow, t)!,
    );
  }

  bool get isDark => ink.computeLuminance() > 0.5;
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

/// The inset of grouped cards from the screen edge, and of text inside them.
const kGutter = 16.0;

/// Corner radius of a grouped card.
const kCardRadius = 12.0;

/// Theme for a subtree one layer up (a sheet): see [Palette.raised].
ThemeData raisedTheme(ThemeData theme) {
  final p = theme.extension<Palette>()!;
  if (!p.isDark) return theme;
  final raised = p.raised;
  return theme.copyWith(
    scaffoldBackgroundColor: raised.paper,
    canvasColor: raised.paper,
    inputDecorationTheme: theme.inputDecorationTheme.copyWith(fillColor: raised.fill),
    extensions: [raised],
  );
}

ThemeData kcplTheme(Brightness brightness, {TargetPlatform? platform}) {
  final dark = brightness == Brightness.dark;
  final p = dark ? Palette.dark : Palette.light;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: p.ink,
    onPrimary: p.surface,
    primaryContainer: p.fill,
    onPrimaryContainer: p.ink,
    secondary: p.ink,
    onSecondary: p.surface,
    secondaryContainer: p.fill,
    onSecondaryContainer: p.ink,
    tertiary: p.accent,
    onTertiary: Colors.white,
    error: p.accent,
    onError: Colors.white,
    surface: p.surface,
    onSurface: p.ink,
    onSurfaceVariant: p.secondary,
    surfaceContainerLowest: p.surface,
    surfaceContainerLow: p.surface,
    surfaceContainer: p.surface,
    surfaceContainerHigh: p.surface,
    surfaceContainerHighest: p.fill,
    outline: p.hairline,
    outlineVariant: p.hairline,
    surfaceTint: Colors.transparent,
    inverseSurface: p.ink,
    onInverseSurface: p.surface,
  );

  // No font family: SF Pro on iPhone, Roboto on Android, each with the
  // platform's own metrics.
  final base = ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    brightness: brightness,
    platform: platform,
    scaffoldBackgroundColor: p.paper,
    canvasColor: p.paper,
    fontFamilyFallback: const ['NotoSansDevanagari'],
    // Press feedback is an instant grey wash, like a native list, rather
    // than an ink ripple spreading from the finger.
    splashFactory: NoSplash.splashFactory,
    highlightColor: p.pressed,
    hoverColor: Colors.transparent,
    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    extensions: [p],
  );

  // Apple's text styles, with Apple's tracking for each size: open at
  // display sizes and 11pt, tighter through the reading sizes. Hierarchy
  // comes from weight and grey before size.
  final t = base.textTheme.apply(bodyColor: p.ink, displayColor: p.ink);
  TextStyle? style(TextStyle? from, double size, FontWeight weight, double tracking, double height) =>
      from?.copyWith(fontSize: size, fontWeight: weight, letterSpacing: tracking, height: height);
  final text = t.copyWith(
    // Large title.
    displaySmall: style(t.displaySmall, 32, FontWeight.w700, 0.37, 1.2),
    // Title 1, 2, 3.
    headlineLarge: style(t.headlineLarge, 28, FontWeight.w700, 0.36, 1.2),
    headlineMedium: style(t.headlineMedium, 22, FontWeight.w700, -0.26, 1.27),
    headlineSmall: style(t.headlineSmall, 20, FontWeight.w600, -0.45, 1.25),
    // Headline.
    titleLarge: style(t.titleLarge, 17, FontWeight.w600, -0.43, 1.29),
    // Callout and subheadline, emphasised.
    titleMedium: style(t.titleMedium, 16, FontWeight.w600, -0.31, 1.31),
    titleSmall: style(t.titleSmall, 15, FontWeight.w600, -0.23, 1.33),
    // Body, subheadline, footnote.
    bodyLarge: style(t.bodyLarge, 17, FontWeight.w400, -0.43, 1.29),
    bodyMedium: style(t.bodyMedium, 15, FontWeight.w400, -0.23, 1.33),
    bodySmall: style(t.bodySmall, 13, FontWeight.w400, -0.08, 1.38)?.copyWith(color: p.secondary),
    // Buttons, caption 1, caption 2.
    labelLarge: style(t.labelLarge, 17, FontWeight.w600, -0.43, 1.29),
    labelMedium: style(t.labelMedium, 12, FontWeight.w400, 0, 1.33),
    labelSmall: style(t.labelSmall, 11, FontWeight.w500, 0.06, 1.18),
  );

  final radius = BorderRadius.circular(kCardRadius);

  return base.copyWith(
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: p.paper,
      foregroundColor: p.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      systemOverlayStyle: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
    ),
    dividerTheme: DividerThemeData(color: p.hairline, space: 0.33, thickness: 0.33),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: p.ink,
        foregroundColor: p.surface,
        disabledBackgroundColor: p.fill,
        disabledForegroundColor: p.tertiary,
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: text.labelLarge,
        splashFactory: NoSplash.splashFactory,
        elevation: 0,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: p.ink,
        backgroundColor: p.surface,
        side: BorderSide.none,
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: text.titleSmall,
        splashFactory: NoSplash.splashFactory,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: p.ink,
        textStyle: text.bodyLarge,
        // 44 points tall, as every other control.
        minimumSize: const Size(0, 44),
        splashFactory: NoSplash.splashFactory,
        overlayColor: Colors.transparent,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      // 44 points: Apple's smallest comfortable target, for every icon button.
      style: IconButton.styleFrom(foregroundColor: p.ink, splashFactory: NoSplash.splashFactory, minimumSize: const Size.square(44)),
    ),
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
      focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide.none),
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: p.ink,
      selectionHandleColor: p.ink,
      selectionColor: p.ink.withValues(alpha: 0.15),
    ),
    switchTheme: SwitchThemeData(
      // The iOS switch is green; this one is ink, like the rest.
      trackColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? p.ink : null),
    ),
    // Filter chips as iOS draws a set of choices: white capsules on the
    // grouped page, the chosen one in ink.
    chipTheme: ChipThemeData(
      backgroundColor: p.surface,
      selectedColor: p.ink,
      disabledColor: p.fill,
      side: BorderSide.none,
      shape: const StadiumBorder(),
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      labelPadding: const EdgeInsets.symmetric(horizontal: 8),
      labelStyle: text.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: p.secondary, circularTrackColor: Colors.transparent),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: dark ? const Color(0xFF2C2C2E) : const Color(0xFF1C1C1E),
      contentTextStyle: text.bodyMedium?.copyWith(color: Colors.white),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 0,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: p.raised.paper,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: p.tertiary,
      dragHandleSize: const Size(36, 5),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(14))),
    ),
    listTileTheme: ListTileThemeData(iconColor: p.ink, textColor: p.ink),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {TargetPlatform.android: PredictiveBackPageTransitionsBuilder(), TargetPlatform.iOS: CupertinoPageTransitionsBuilder()},
    ),
  );
}
