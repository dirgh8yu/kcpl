import 'package:flutter/widgets.dart';

import '../l10n/app_localizations.dart';

/// The app's strings from anywhere a widget has its context: KCPL Ops in
/// English or Nepali, as the person chose in Me.
extension OpsL10n on BuildContext {
  AppLocalizations get l => AppLocalizations.of(this);
}
