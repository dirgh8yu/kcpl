import 'package:flutter/widgets.dart';

// Phosphor's fonts (MIT, assets/fonts/MIT-Phosphor.txt), bundled directly.
// Code points are from Phosphor 2.1; icon tree shaking keeps only these.
const _r = 'PhosphorRegular';
const _f = 'PhosphorFill';
const _b = 'PhosphorBold';

/// One icon family for both apps (Phosphor): an even stroke, drawn as a
/// set. Outline by default; the filled form marks the chosen tab.
abstract final class KIcons {
  // Tabs, outline and chosen.
  static const IconData home = IconData(0xe2c2, fontFamily: _r);
  static const IconData homeOn = IconData(0xe2c2, fontFamily: _f);
  static const IconData today = IconData(0xe472, fontFamily: _r);
  static const IconData todayOn = IconData(0xe472, fontFamily: _f);
  static const IconData shipments = IconData(0xe390, fontFamily: _r);
  static const IconData shipmentsOn = IconData(0xe390, fontFamily: _f);
  static const IconData documents = IconData(0xe23a, fontFamily: _r);
  static const IconData documentsOn = IconData(0xe23a, fontFamily: _f);
  static const IconData invoices = IconData(0xe3ec, fontFamily: _r);
  static const IconData invoicesOn = IconData(0xe3ec, fontFamily: _f);
  static const IconData alerts = IconData(0xe0ce, fontFamily: _r);
  static const IconData alertsOn = IconData(0xe0ce, fontFamily: _f);
  static const IconData account = IconData(0xe4c2, fontFamily: _r);
  static const IconData accountOn = IconData(0xe4c2, fontFamily: _f);

  // Modes of transport.
  static const IconData air = IconData(0xe5d6, fontFamily: _f);
  static const IconData sea = IconData(0xe786, fontFamily: _f);
  static const IconData road = IconData(0xe4b4, fontFamily: _f);
  static const IconData rail = IconData(0xe496, fontFamily: _f);
  static const IconData courier = IconData(0xe390, fontFamily: _f);
  static const IconData route = IconData(0xe39c, fontFamily: _r);
  static const IconData truck = IconData(0xe4b4, fontFamily: _r);

  // Things.
  static const IconData document = IconData(0xe23a, fontFamily: _r);
  static const IconData upload = IconData(0xe61e, fontFamily: _r);
  static const IconData image = IconData(0xe2ca, fontFamily: _r);
  static const IconData invoice = IconData(0xee42, fontFamily: _r);
  static const IconData wallet = IconData(0xe68a, fontFamily: _r);
  static const IconData timer = IconData(0xe492, fontFamily: _r);
  static const IconData tasks = IconData(0xeadc, fontFamily: _r);
  static const IconData customs = IconData(0xe40c, fontFamily: _r);
  static const IconData history = IconData(0xe1a0, fontFamily: _r);
  static const IconData bellRinging = IconData(0xe5e8, fontFamily: _r);
  static const IconData userPlus = IconData(0xe4d0, fontFamily: _r);
  static const IconData phone = IconData(0xe3b8, fontFamily: _r);
  static const IconData whatsapp = IconData(0xe5d0, fontFamily: _r);
  static const IconData pin = IconData(0xe316, fontFamily: _f);

  // Controls.
  static const IconData search = IconData(0xe30c, fontFamily: _r);
  static const IconData noResults = IconData(0xe30c, fontFamily: _r);
  static const IconData check = IconData(0xe182, fontFamily: _b);
  static const IconData chevron = IconData(0xe13a, fontFamily: _b);
  static const IconData expand = IconData(0xe136, fontFamily: _b);
  static const IconData arrowRight = IconData(0xe06c, fontFamily: _r);
  static const IconData download = IconData(0xe03e, fontFamily: _b);
  static const IconData show = IconData(0xe220, fontFamily: _r);
  static const IconData hide = IconData(0xe224, fontFamily: _r);

  // States.
  static const IconData warning = IconData(0xe4e0, fontFamily: _r);
  static const IconData offline = IconData(0xe4f2, fontFamily: _r);
  static const IconData unreachable = IconData(0xe1b6, fontFamily: _r);
}
