import 'package:flutter/cupertino.dart' show CupertinoDatePicker, CupertinoDatePickerMode, showCupertinoModalPopup;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets/capture.dart';
import '../widgets/common.dart';
import '../widgets/compose.dart';
import '../widgets/sheet_route.dart';

/// True when a receipt was sent.
Future<bool> openSendReceipt(BuildContext context, Invoice invoice) async =>
    await Navigator.of(context).push<bool>(SheetRoute<bool>(builder: (_) => SendReceiptScreen(invoice: invoice))) ?? false;

/// "I have paid this", with the bank's receipt attached. A claim for KCPL
/// accounts to match against the bank; the invoice changes only once they
/// have.
class SendReceiptScreen extends StatefulWidget {
  const SendReceiptScreen({super.key, required this.invoice});
  final Invoice invoice;

  @override
  State<SendReceiptScreen> createState() => _SendReceiptScreenState();
}

class _SendReceiptScreenState extends State<SendReceiptScreen> {
  late final _amount = TextEditingController(text: _plain(widget.invoice.balanceDue));
  final _note = TextEditingController();
  DateTime _paidOn = DateTime.now();
  Attachment? _file;
  bool _busy = false;
  double? _progress;
  String? _error;
  SendReceipt? _sent;

  static String _plain(double value) => value <= 0 ? '' : (value % 1 == 0 ? value.toStringAsFixed(0) : value.toStringAsFixed(2));

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final l = AppLocalizations.of(context);
    try {
      final file = await pickAttachment(context, name: 'receipt-${widget.invoice.reference}', scan: true);
      if (file != null && mounted) setState(() => (_file = file, _error = null));
    } on AttachmentRefused catch (refused) {
      if (mounted) setState(() => _error = attachmentRefusal(l, refused));
    }
  }

  Future<void> _pickDate() async {
    final p = context.palette;
    var chosen = _paidOn;
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (sheet) => Container(
        height: 280,
        color: p.raised.surface,
        child: SafeArea(
          top: false,
          child: CupertinoDatePicker(
            mode: CupertinoDatePickerMode.date,
            initialDateTime: _paidOn,
            maximumDate: DateTime.now(),
            onDateTimeChanged: (value) => chosen = value,
          ),
        ),
      ),
    );
    if (mounted) setState(() => _paidOn = chosen);
  }

  Future<void> _send() async {
    final l = AppLocalizations.of(context);
    FocusScope.of(context).unfocus();
    final file = _file;
    if (file == null) {
      HapticFeedback.heavyImpact();
      setState(() => _error = l.sendChooseFile);
      return;
    }
    final text = _amount.text.replaceAll(',', '').trim();
    final amount = text.isEmpty ? null : double.tryParse(text);
    if (text.isNotEmpty && (amount == null || amount < 0)) {
      HapticFeedback.heavyImpact();
      setState(() => _error = l.receiptInvalidAmount);
      return;
    }
    final api = AppScope.read(context).api;
    setState(() => (_busy = true, _progress = 0, _error = null));
    SendReceipt? receipt;
    final error = await attempt(context, () async {
      receipt = await api.sendRemittance(
        widget.invoice.reference,
        RemittanceDraft(
          file: file,
          amount: amount,
          currency: widget.invoice.currency,
          paidOn: _paidOn.toIso8601String().substring(0, 10),
          note: _note.text,
        ),
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
    if (sent != null) return DoneView(title: l.sentTitle, body: sent.message, reference: widget.invoice.reference);
    final invoice = widget.invoice;
    return ComposeScaffold(
      title: l.receiptTitle,
      error: _error,
      action: SendButton(label: l.sendToKcpl, onPressed: _send, busy: _busy, progress: _progress),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
          child: Text(
            '${invoice.reference} · ${l.invdBalanceDue} ${formatMoney(invoice.balanceDue, invoice.currency)}',
            style: context.type.bodyMedium?.copyWith(color: p.secondary),
          ),
        ),
        SectionHeader(l.receiptFile),
        AttachmentField(file: _file, onPick: _pick, enabled: !_busy, hint: l.captureHint),
        const SizedBox(height: 20),
        GroupCard(
          child: Column(
            children: [
              TextField(
                controller: _amount,
                enabled: !_busy,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: context.type.bodyLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                decoration: cardField(
                  l.receiptAmount,
                  suffix: Text(invoice.currency, style: context.type.bodyLarge?.copyWith(color: p.secondary)),
                ).copyWith(labelText: l.receiptAmount, floatingLabelBehavior: FloatingLabelBehavior.always),
              ),
              const Divider(indent: kGutter),
              RowTile(
                onTap: _busy ? null : _pickDate,
                title: Text(l.receiptPaidOn),
                trailing: Text(formatDate(_paidOn.toIso8601String())),
                chevron: true,
              ),
            ],
          ),
        ),
        SectionHeader(l.receiptNote),
        GroupCard(
          child: TextField(
            controller: _note,
            enabled: !_busy,
            minLines: 2,
            maxLines: 4,
            maxLength: 1000,
            buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
            textCapitalization: TextCapitalization.sentences,
            style: context.type.bodyLarge,
            decoration: cardField(l.receiptNoteHint),
          ),
        ),
        Footnote(l.receiptFootnote),
      ],
    );
  }
}
