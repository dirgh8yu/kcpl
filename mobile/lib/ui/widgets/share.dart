import 'package:flutter/widgets.dart';
import 'package:share_plus/share_plus.dart';

/// Opens the system share sheet with [text]. On iPad the sheet is a popover,
/// so it is anchored on the widget [context] belongs to: the button pressed.
Future<void> shareText(BuildContext context, String text, {String? subject}) {
  final box = context.findRenderObject();
  final origin = box is RenderBox && box.hasSize ? box.localToGlobal(Offset.zero) & box.size : null;
  return SharePlus.instance.share(ShareParams(text: text, subject: subject, sharePositionOrigin: origin));
}
