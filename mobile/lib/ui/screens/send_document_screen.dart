import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../labels.dart';
import '../theme.dart';
import '../widgets/capture.dart';
import '../widgets/common.dart';
import '../widgets/compose.dart';
import '../widgets/rows.dart';
import '../widgets/sheet_route.dart';

/// The papers a customer originates, as the server's allowlist has them. A
/// bill of lading, a customs entry or a proof of delivery is KCPL's to file.
const customerDocumentTypes = [
  'commercial_invoice',
  'packing_list',
  'certificate_of_origin',
  'import_permit',
  'export_permit',
  'dangerous_goods_declaration',
  'insurance_certificate',
  'other',
];

/// KCPL asked for the document: for the first time, or again after the one
/// sent was sent back.
enum SendRequest { needed, resend }

/// Opens "Send a document" for [shipment]. [waiting] are the types KCPL is
/// waiting on, offered first; [type] is chosen already when the person came
/// from one of them. True when something was sent.
Future<bool> openSendDocument(
  BuildContext context,
  Shipment shipment, {
  String? type,
  List<String> waiting = const [],
  SendRequest? request,
}) async =>
    await Navigator.of(context).push<bool>(
      SheetRoute<bool>(
        builder: (_) => SendDocumentScreen(shipment: shipment, type: type, waiting: waiting, request: request),
      ),
    ) ??
    false;

/// A document for a shipment, the way a phone is best at it: the photo
/// first, as the big target, then what it is, then one button. The file is
/// checked by KCPL before it counts.
class SendDocumentScreen extends StatefulWidget {
  const SendDocumentScreen({super.key, required this.shipment, this.type, this.waiting = const [], this.request});
  final Shipment shipment;
  final String? type;
  final List<String> waiting;

  /// Opened from KCPL's request for [type]: the scanner is the one tap.
  final SendRequest? request;

  @override
  State<SendDocumentScreen> createState() => _SendDocumentScreenState();
}

class _SendDocumentScreenState extends State<SendDocumentScreen> {
  late String? _type = widget.type ?? (widget.waiting.length == 1 ? widget.waiting.first : null);
  Attachment? _file;
  bool _busy = false;
  double? _progress;
  String? _error;
  SendReceipt? _sent;

  List<String> get _types => [
    ...widget.waiting.where(customerDocumentTypes.contains),
    ...customerDocumentTypes.where((t) => !widget.waiting.contains(t)),
  ];

  Future<void> _pick({bool direct = false}) async {
    final l = AppLocalizations.of(context);
    final name = '${(_type ?? 'document').replaceAll('_', '-')}-${widget.shipment.reference}';
    try {
      final file = await pickAttachment(context, name: name, scan: true, direct: direct);
      if (file != null && mounted) setState(() => (_file = file, _error = null));
    } on AttachmentRefused catch (refused) {
      if (mounted) setState(() => _error = attachmentRefusal(l, refused));
    }
  }

  Future<void> _send() async {
    final l = AppLocalizations.of(context);
    final file = _file;
    final type = _type;
    if (file == null || type == null) {
      HapticFeedback.heavyImpact();
      setState(() => _error = file == null ? l.sendChooseFile : l.sendChooseKind);
      return;
    }
    final api = AppScope.read(context).api;
    setState(() => (_busy = true, _progress = 0, _error = null));
    SendReceipt? receipt;
    final error = await attempt(context, () async {
      receipt = await api.sendDocument(
        widget.shipment.reference,
        type,
        file,
        onProgress: (fraction) {
          if (mounted) setState(() => _progress = fraction);
        },
      );
    });
    if (!mounted) return;
    if (receipt != null) HapticFeedback.mediumImpact();
    setState(() => (_busy = false, _progress = null, _error = error, _sent = receipt));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final sent = _sent;
    if (sent != null) {
      return DoneView(title: l.sentTitle, body: sent.message.isEmpty ? l.sentTitle : sent.message, reference: widget.shipment.reference);
    }
    final shipment = widget.shipment;
    final request = widget.request;
    // The document asked for, in the words the checklist uses; lower case
    // mid-sentence in English.
    final label = widget.type == null ? null : documentTypeLabel(l, widget.type!);
    final asked = label != null && Localizations.localeOf(context).languageCode == 'en' ? label.toLowerCase() : label;
    return ComposeScaffold(
      title: l.sendDocTitle,
      error: _error,
      action: SendButton(label: l.sendToKcpl, onPressed: _send, busy: _busy, progress: _progress),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
          child: ShipmentLine(shipment),
        ),
        if (request != null && asked != null) ...[
          const SizedBox(height: 16),
          Notice(
            title: request == SendRequest.resend ? l.docreqResend(asked) : l.docreqNeeded(asked),
            body: l.docreqBody(shipment.reference),
          ),
          const SizedBox(height: 16),
          // The scanner, straight away: no choice to make first.
          AttachmentField(
            file: _file,
            onPick: () => _pick(direct: _file == null),
            enabled: !_busy,
            label: l.docreqScan(asked),
          ),
          if (_file == null)
            Center(
              child: TextButton(onPressed: _busy ? null : _pick, child: Text(l.docreqOther)),
            ),
        ] else ...[
          SectionHeader(l.sendDocFile),
          AttachmentField(file: _file, onPick: _pick, enabled: !_busy, hint: l.captureHint),
        ],
        SectionHeader(l.sendDocKind),
        RowGroup(
          children: [
            for (final type in _types)
              Semantics(
                selected: type == _type,
                inMutuallyExclusiveGroup: true,
                child: RowTile(
                  onTap: _busy
                      ? null
                      : () {
                          HapticFeedback.selectionClick();
                          setState(() => (_type = type, _error = null));
                        },
                  title: Text(documentTypeLabel(l, type), style: TextStyle(fontWeight: type == _type ? FontWeight.w600 : FontWeight.w400)),
                  subtitle: widget.waiting.contains(type) ? Text(l.xchgStateNeeded, style: TextStyle(color: p.accent)) : null,
                  trailing: type == _type ? Icon(KIcons.check, size: 20, color: p.ink) : const SizedBox(width: 20),
                ),
              ),
          ],
        ),
        Footnote(l.sendDocFootnote),
      ],
    );
  }
}
