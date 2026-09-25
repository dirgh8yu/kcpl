import 'package:flutter/cupertino.dart' show CupertinoActionSheet, CupertinoActionSheetAction, showCupertinoModalPopup;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/kcpl_api.dart' show ApiException;
import '../../api/models.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/live_activity.dart';
import '../format.dart';
import '../labels.dart';
import 'compose.dart' show describeFailure;
import 'journey.dart' show journeyFraction;
import 'share.dart';

/// A shipment's status as a message: what it is, where it is, and when. For a
/// consignee on WhatsApp, so it carries no link that needs a KCPL login.
String shipmentStatusText(AppLocalizations l, Shipment shipment) => [
  '${shipment.reference} · ${route(place(shipment.origin), place(shipment.destination))}',
  [statusLabel(l, shipment.status), if (!shipment.delivered && shipment.currentLocation != null) shipment.currentLocation!].join(' · '),
  if (shipment.delivered)
    l.shareDeliveredOn(formatDate(shipment.updatedAt))
  else if (shipment.eta != null)
    l.shareExpected(formatDate(shipment.eta)),
  if (shipment.carrierReference != null) l.shareCarrierRef(shipment.carrierReference!),
  '',
  l.shareFooter,
].join('\n');

/// What a Live Activity says about [shipment], as the widget says it.
LiveShipmentState liveState(AppLocalizations l, Shipment shipment) => LiveShipmentState(
  status: statusLabel(l, shipment.status),
  detail: shipment.currentLocation != null && shipment.status != 'booking_confirmed' && shipment.status != 'delivered'
      ? l.overviewNowAt(shipment.currentLocation!)
      : shipment.eta != null && shipment.status != 'delivered'
      ? l.shareExpected(formatDate(shipment.eta))
      : '',
  progress: journeyFraction(shipment.status),
  attention: shipment.status == 'exception',
);

/// The share button on a shipment: its status as text, a link anyone can
/// open, withdrawing those links, and the Lock Screen. [anchor] is the
/// button, for the iPad popover.
Future<void> showShipmentActions(BuildContext context, BuildContext anchor, ShipmentDetail detail) async {
  final l = AppLocalizations.of(context);
  final controller = AppScope.read(context);
  final shipment = detail.shipment;
  final canShare = controller.session?.canSubmitRequests ?? false;
  final live = LiveActivities.current;
  final liveOk = shipment.status != 'delivered' && await live.supported();
  final running = liveOk ? (await live.running()).where((a) => a.reference == shipment.reference).firstOrNull : null;
  if (!context.mounted) return;

  final choice = await showCupertinoModalPopup<String>(
    context: context,
    builder: (sheet) => CupertinoActionSheet(
      title: Text(shipment.reference),
      message: canShare ? Text(l.trackShareLinkHint) : null,
      actions: [
        CupertinoActionSheetAction(onPressed: () => Navigator.pop(sheet, 'status'), child: Text(l.shareStatus)),
        if (canShare) CupertinoActionSheetAction(onPressed: () => Navigator.pop(sheet, 'link'), child: Text(l.trackShareLink)),
        if (liveOk)
          CupertinoActionSheetAction(
            onPressed: () => Navigator.pop(sheet, running == null ? 'follow' : 'unfollow'),
            child: Text(running == null ? l.liveFollow : l.liveStop),
          ),
        if (canShare)
          CupertinoActionSheetAction(isDestructiveAction: true, onPressed: () => Navigator.pop(sheet, 'revoke'), child: Text(l.trackStopSharing)),
      ],
      cancelButton: CupertinoActionSheetAction(isDefaultAction: true, onPressed: () => Navigator.pop(sheet), child: Text(l.cancel)),
    ),
  );
  if (choice == null || !context.mounted) return;
  final messenger = ScaffoldMessenger.of(context);
  void say(String text) => messenger.showSnackBar(SnackBar(content: Text(text)));

  try {
    switch (choice) {
      case 'status':
        await shareText(anchor, shipmentStatusText(l, shipment), subject: shipment.reference);
      case 'link':
        final link = await controller.api.createTrackingLink(shipment.reference);
        if (!anchor.mounted) return;
        HapticFeedback.lightImpact();
        await shareText(anchor, l.trackShareMessage(shipment.reference, link.url.toString()), subject: shipment.reference);
      case 'revoke':
        final revoked = await controller.api.revokeTrackingLinks(shipment.reference);
        HapticFeedback.mediumImpact();
        say(revoked > 0 ? l.trackStopped(shipment.reference) : l.trackStoppedNone);
      case 'follow':
        final handle = await live.start(
          reference: shipment.reference,
          route: route(place(shipment.origin), place(shipment.destination)),
          state: liveState(l, shipment),
        );
        if (handle == null) {
          say(l.liveUnavailable);
          return;
        }
        HapticFeedback.mediumImpact();
        // Kept moving by KCPL when push is on; otherwise the app moves it
        // whenever it shows this shipment.
        final push = controller.push.deviceToken;
        final token = handle.pushToken;
        if (push != null && token != null) {
          await controller.api.followLive(shipment.reference, activityToken: token, pushToken: push);
        }
        say(l.liveFollowing);
      case 'unfollow':
        if (running == null) return;
        await live.end(running.id);
        final token = running.pushToken;
        if (token != null) await controller.api.unfollowLive(token).catchError((Object _) {});
    }
  } on SignedOutException {
    await controller.expire();
  } on ApiException catch (error) {
    HapticFeedback.heavyImpact();
    say(describeFailure(l, error));
  } catch (_) {
    say(choice == 'follow' ? l.liveUnavailable : l.commonUnavailableDetail);
  }
}

/// Brings a running Live Activity up to date with what the app just read,
/// so it is right even without push.
Future<void> refreshLiveActivity(AppLocalizations l, Shipment shipment) async {
  try {
    final live = LiveActivities.current;
    final running = (await live.running()).where((a) => a.reference == shipment.reference);
    for (final activity in running) {
      shipment.status == 'delivered' ? await live.end(activity.id) : await live.update(activity.id, liveState(l, shipment));
    }
  } catch (_) {
    // The Lock Screen is a courtesy; never a failure of the page.
  }
}
