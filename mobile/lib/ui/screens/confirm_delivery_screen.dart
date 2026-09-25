import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../theme.dart';
import '../widgets/capture.dart';
import '../widgets/common.dart';
import '../widgets/compose.dart';
import '../widgets/rows.dart';
import '../widgets/sheet_route.dart';

/// True when KCPL was told.
Future<bool> openConfirmDelivery(BuildContext context, Shipment shipment) async =>
    await Navigator.of(context).push<bool>(SheetRoute<bool>(builder: (_) => ConfirmDeliveryScreen(shipment: shipment))) ?? false;

/// "It arrived", with who took it and anything wrong, and a photo if the
/// person wants one on file. Evidence for the operator closing the job; it
/// never marks the shipment delivered.
class ConfirmDeliveryScreen extends StatefulWidget {
  const ConfirmDeliveryScreen({super.key, required this.shipment});
  final Shipment shipment;

  @override
  State<ConfirmDeliveryScreen> createState() => _ConfirmDeliveryScreenState();
}

class _ConfirmDeliveryScreenState extends State<ConfirmDeliveryScreen> {
  final _receivedBy = TextEditingController();
  final _note = TextEditingController();
  Attachment? _photo;
  bool _busy = false;
  double? _progress;
  String? _error;
  String? _done;

  @override
  void initState() {
    super.initState();
    // Most often the person confirming took delivery themselves.
    _receivedBy.text = AppScope.read(context).session?.displayName ?? '';
  }

  @override
  void dispose() {
    _receivedBy.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final l = AppLocalizations.of(context);
    try {
      final photo = await pickAttachment(context, name: 'delivery-${widget.shipment.reference}', files: false);
      if (photo != null && mounted) setState(() => (_photo = photo, _error = null));
    } on AttachmentRefused catch (refused) {
      if (mounted) setState(() => _error = attachmentRefusal(l, refused));
    }
  }

  Future<void> _confirm() async {
    FocusScope.of(context).unfocus();
    final api = AppScope.read(context).api;
    final photo = _photo;
    setState(() => (_busy = true, _error = null, _progress = null));
    SendReceipt? receipt;
    var error = await attempt(context, () async {
      receipt = await api.confirmDelivery(widget.shipment.reference, receivedBy: _receivedBy.text.trim(), note: _note.text.trim());
    });
    // The confirmation stands on its own. A photo that then fails to send is
    // said plainly, and the person can send it again from the shipment.
    if (receipt != null && photo != null && mounted) {
      setState(() => _progress = 0);
      error = await attempt(context, () async {
        await api.sendDocument(
          widget.shipment.reference,
          'other',
          photo,
          onProgress: (fraction) {
            if (mounted) setState(() => _progress = fraction);
          },
        );
      });
    }
    if (!mounted) return;
    if (receipt != null) HapticFeedback.mediumImpact();
    setState(() {
      _busy = false;
      _progress = null;
      _error = receipt == null ? error : null;
      _done = receipt == null ? null : [receipt!.message, ?error].join('\n\n');
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final done = _done;
    if (done != null) return DoneView(title: l.confirmedTitle, body: done, reference: widget.shipment.reference);
    return ComposeScaffold(
      title: l.confirmTitle,
      error: _error,
      action: SendButton(label: l.confirmTitle, onPressed: _confirm, busy: _busy, progress: _progress),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
          child: ShipmentLine(widget.shipment),
        ),
        SectionHeader(l.confirmReceivedBy),
        GroupCard(
          child: TextField(
            controller: _receivedBy,
            enabled: !_busy,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            style: context.type.bodyLarge,
            decoration: cardField(l.confirmReceivedByHint),
          ),
        ),
        SectionHeader(l.confirmNote),
        GroupCard(
          child: TextField(
            controller: _note,
            enabled: !_busy,
            minLines: 2,
            maxLines: 5,
            maxLength: 1000,
            buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
            textCapitalization: TextCapitalization.sentences,
            style: context.type.bodyLarge,
            decoration: cardField(l.confirmNoteHint),
          ),
        ),
        SectionHeader(l.confirmPhoto),
        AttachmentField(file: _photo, onPick: _pick, enabled: !_busy, hint: l.confirmPhotoOptional),
        Footnote(l.confirmFootnote),
      ],
    );
  }
}
