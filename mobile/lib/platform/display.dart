import 'package:flutter/foundation.dart';
import 'package:flutter_displaymode/flutter_displaymode.dart';

/// Many Android phones run apps at 60Hz unless asked, even with a 90 or
/// 120Hz screen. Ask for the fastest mode the screen offers, so scrolling and
/// motion are as smooth as the hardware allows. (iOS is handled by
/// CADisableMinimumFrameDurationOnPhone in Info.plist.)
Future<void> preferHighRefreshRate() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
  try {
    await FlutterDisplayMode.setHighRefreshRate();
  } catch (_) {
    // Older Android versions have one mode; nothing to change.
  }
}
