# KCPL mobile codebase conventions

Paths here are relative to `mobile/`. Search the live code before adding a component.

## Shared components
- `lib/ui/widgets/` holds roughly 15 app-wide widget files, shared by customer and Ops screens; names are plain domain or behavior nouns.
- `lib/ui/screens/` and `lib/ops/screens/` hold routed surfaces. Reuse shared widgets before adding local variants.

## Typography, colour, and spacing
- `lib/ui/theme.dart` owns `ThemeData`, `Palette`, text styles, and the common `kGutter`.
- Use `context.type` for text styles and `context.palette` for semantic colours. Local `TextStyle` overrides exist, but should stay small and derived from these sources.
- `lib/ui/motion.dart` owns reusable reveal, press, shimmer, and timing behavior. Match its reduced-motion handling.

## Assets
- `pubspec.yaml` declares `assets/brand/` and `assets/map/`. Fonts are declared separately under `assets/fonts/`.
- Raster assets use `Image.asset`; the bundled route map reads its binary asset through `rootBundle`. There is no SVG loader or asset-path constants class.

## Naming and imports
- Dart files use `snake_case.dart`; routed widgets use `*Screen` in both apps.
- Use relative imports for local code and `package:` imports for external packages, as the existing files do. There is no general barrel-file convention.
