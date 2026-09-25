import 'package:flutter/cupertino.dart' show CupertinoIcons;
import 'package:flutter/widgets.dart';

// Phosphor (MIT, assets/fonts/MIT-Phosphor.txt) only for the two vehicles
// Cupertino's set does not draw: a boat and a truck.
const _r = 'PhosphorRegular';
const _f = 'PhosphorFill';

/// One icon family for both apps: Cupertino's, drawn after SF Symbols, so
/// the apps look like the phone they run on. Outline by default; the filled
/// form marks the chosen tab.
abstract final class KIcons {
  // Tabs, outline and chosen.
  static const IconData home = CupertinoIcons.map;
  static const IconData homeOn = CupertinoIcons.map_fill;
  static const IconData today = CupertinoIcons.checkmark_circle;
  static const IconData todayOn = CupertinoIcons.checkmark_circle_fill;
  static const IconData shipments = CupertinoIcons.cube_box;
  static const IconData shipmentsOn = CupertinoIcons.cube_box_fill;
  static const IconData documents = CupertinoIcons.doc_text;
  static const IconData documentsOn = CupertinoIcons.doc_text_fill;
  static const IconData invoices = CupertinoIcons.creditcard;
  static const IconData invoicesOn = CupertinoIcons.creditcard_fill;
  static const IconData alerts = CupertinoIcons.bell;
  static const IconData alertsOn = CupertinoIcons.bell_fill;
  static const IconData account = CupertinoIcons.person_crop_circle;
  static const IconData accountOn = CupertinoIcons.person_crop_circle_fill;

  // Modes of transport, outline for rows.
  static const IconData air = CupertinoIcons.airplane;
  static const IconData sea = IconData(0xe786, fontFamily: _r);
  static const IconData road = IconData(0xe4b4, fontFamily: _r);
  static const IconData rail = CupertinoIcons.train_style_one;
  static const IconData courier = CupertinoIcons.cube_box;
  static const IconData route = CupertinoIcons.arrow_right_arrow_left;
  static const IconData truck = IconData(0xe4b4, fontFamily: _r);

  // Modes of transport, solid, for the cargo marker on a map.
  static const IconData airSolid = CupertinoIcons.airplane;
  static const IconData seaSolid = IconData(0xe786, fontFamily: _f);
  static const IconData roadSolid = IconData(0xe4b4, fontFamily: _f);
  static const IconData railSolid = CupertinoIcons.tram_fill;
  static const IconData courierSolid = CupertinoIcons.cube_box_fill;

  // Things.
  static const IconData document = CupertinoIcons.doc_text;
  static const IconData upload = CupertinoIcons.arrow_up_doc;
  static const IconData image = CupertinoIcons.photo;
  static const IconData camera = CupertinoIcons.camera;
  static const IconData scan = CupertinoIcons.qrcode_viewfinder;
  static const IconData share = CupertinoIcons.share;
  static const IconData arrived = CupertinoIcons.cube_box_fill;
  static const IconData people = CupertinoIcons.person_2;
  static const IconData lock = CupertinoIcons.lock_fill;
  static const IconData faceId = CupertinoIcons.lock_shield;
  static const IconData note = CupertinoIcons.text_bubble;
  static const IconData invoice = CupertinoIcons.doc_plaintext;
  static const IconData wallet = CupertinoIcons.creditcard;
  static const IconData timer = CupertinoIcons.timer;
  static const IconData tasks = CupertinoIcons.checkmark_square;
  static const IconData customs = CupertinoIcons.checkmark_shield;
  static const IconData history = CupertinoIcons.clock;
  static const IconData bellRinging = CupertinoIcons.bell;
  static const IconData userPlus = CupertinoIcons.person_badge_plus;
  static const IconData phone = CupertinoIcons.phone;
  static const IconData whatsapp = CupertinoIcons.chat_bubble;
  static const IconData pin = CupertinoIcons.location_solid;
  static const IconData branch = CupertinoIcons.building_2_fill;
  static const IconData signature = CupertinoIcons.signature;
  static const IconData add = CupertinoIcons.plus_circle;
  static const IconData reassign = CupertinoIcons.person_crop_circle_badge_checkmark;
  static const IconData closeJob = CupertinoIcons.archivebox;
  static const IconData location = CupertinoIcons.location;
  static const IconData delivery = CupertinoIcons.hand_raised;
  static const IconData outbox = CupertinoIcons.tray_arrow_up;
  static const IconData undo = CupertinoIcons.arrow_counterclockwise;
  static const IconData message = CupertinoIcons.chat_bubble_2;
  static const IconData send = CupertinoIcons.arrow_up_circle_fill;
  static const IconData star = CupertinoIcons.star;
  static const IconData starOn = CupertinoIcons.star_fill;
  static const IconData estimate = CupertinoIcons.function;

  // Controls.
  static const IconData search = CupertinoIcons.search;
  static const IconData noResults = CupertinoIcons.search;
  static const IconData check = CupertinoIcons.checkmark_alt;
  static const IconData chevron = CupertinoIcons.chevron_forward;
  static const IconData expand = CupertinoIcons.chevron_down;
  static const IconData arrowRight = CupertinoIcons.arrow_right;
  static const IconData download = CupertinoIcons.arrow_down_circle;
  static const IconData show = CupertinoIcons.eye;
  static const IconData hide = CupertinoIcons.eye_slash;
  static const IconData close = CupertinoIcons.xmark;
  static const IconData back = CupertinoIcons.chevron_back;
  static const IconData clear = CupertinoIcons.xmark_circle_fill;

  // States.
  static const IconData warning = CupertinoIcons.exclamationmark_circle_fill;
  static const IconData info = CupertinoIcons.info_circle_fill;
  static const IconData done = CupertinoIcons.checkmark_circle_fill;
  static const IconData offline = CupertinoIcons.wifi_slash;
  static const IconData unreachable = CupertinoIcons.exclamationmark_circle;
}
