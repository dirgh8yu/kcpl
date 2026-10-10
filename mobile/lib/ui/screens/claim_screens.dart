import 'package:flutter/cupertino.dart'
    show CupertinoActionSheet, CupertinoActionSheetAction, CupertinoDatePicker, CupertinoDatePickerMode, showCupertinoModalPopup;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/capture.dart';
import '../widgets/common.dart';
import '../widgets/compose.dart';
import '../widgets/rows.dart';
import '../widgets/sheet_route.dart';

/// The words for each kind of claim, as the screen offers them.
String claimKindLabel(AppLocalizations l, String kind) => switch (kind) {
  'damage' => l.claimKindDamage,
  'shortage' => l.claimKindShortage,
  'loss' => l.claimKindLoss,
  'delay' => l.claimKindDelay,
  _ => l.claimKindOther,
};

String claimStatusLabel(AppLocalizations l, String status) => switch (status) {
  'filed' => l.claimStatusFiled,
  'settled' => l.claimStatusSettled,
  'rejected' => l.claimStatusRejected,
  'withdrawn' => l.claimStatusWithdrawn,
  _ => l.claimStatusReported,
};

/// The claims on [shipment], with "Report a problem" at the top.
Future<void> openClaims(BuildContext context, Shipment shipment) =>
    Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => ClaimsScreen(shipment: shipment)));

class ClaimsScreen extends StatelessWidget {
  const ClaimsScreen({super.key, required this.shipment});
  final Shipment shipment;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = AppScope.of(context).api;
    final canSend = AppScope.of(context).session?.canSubmitRequests ?? false;
    return Scaffold(
      body: AsyncPage<List<CargoClaim>>(
        title: l.claimsTitle,
        load: () => api.claims(shipment.reference),
        builder: (context, claims) => [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
            child: ShipmentLine(shipment),
          ),
          const SizedBox(height: 16),
          if (canSend)
            RowGroup(
              indent: RowGroup.iconIndent,
              children: [
                RowTile(
                  onTap: () async {
                    final sent = await Navigator.of(context).push<bool>(SheetRoute<bool>(builder: (_) => ReportClaimScreen(shipment: shipment)));
                    if (sent == true && context.mounted) await AsyncPage.reload(context);
                  },
                  leading: Icon(KIcons.camera, size: 22, color: context.palette.accent),
                  title: Text(l.claimTitle, style: TextStyle(color: context.palette.accent)),
                  subtitle: Text(l.claimEntryHint),
                  chevron: true,
                ),
              ],
            ),
          if (claims.isNotEmpty) ...[
            SectionHeader(l.claimsTitle),
            RowGroup(children: [for (final claim in claims) _ClaimRow(shipment: shipment, claim: claim, canSend: canSend)]),
          ],
          Footnote(l.claimFootnote),
        ],
      ),
    );
  }
}

class _ClaimRow extends StatelessWidget {
  const _ClaimRow({required this.shipment, required this.claim, required this.canSend});
  final Shipment shipment;
  final CargoClaim claim;
  final bool canSend;

  String? _settled(AppLocalizations l) {
    if (claim.status != 'settled') return null;
    final amount = claim.compensationAmount == null ? null : formatMoney(claim.compensationAmount!, claim.currency);
    return switch (claim.compensationMethod) {
      'credit_note' when amount != null => l.claimSettledCredit(amount),
      'refund' when amount != null => l.claimSettledRefund(amount),
      'insurer_paid' => l.claimSettledInsurer,
      _ => null,
    };
  }

  Future<void> _withdraw(BuildContext context) async {
    final l = AppLocalizations.of(context);
    final confirmed = await showCupertinoModalPopup<bool>(
      context: context,
      builder: (sheet) => CupertinoActionSheet(
        message: Text(l.claimWithdrawConfirm),
        actions: [
          CupertinoActionSheetAction(isDestructiveAction: true, onPressed: () => Navigator.pop(sheet, true), child: Text(l.claimWithdraw)),
        ],
        cancelButton: CupertinoActionSheetAction(isDefaultAction: true, onPressed: () => Navigator.pop(sheet, false), child: Text(l.cancel)),
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final api = AppScope.read(context).api;
    final error = await attempt(context, () => api.withdrawClaim(shipment.reference, claim.id));
    if (!context.mounted) return;
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
      return;
    }
    await AsyncPage.reload(context);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final settled = _settled(l);
    final emphasis = claim.status == 'rejected' ? Emphasis.attention : claim.status == 'withdrawn' ? Emphasis.muted : Emphasis.normal;
    final lines = [
      '${claimKindLabel(l, claim.kind)} · ${formatDate(claim.noticedOn)}${claim.claimedAmount == null ? '' : ' · ${formatMoney(claim.claimedAmount!, claim.currency)}'}',
      ?settled,
    ];
    return RowTile(
      onTap: claim.canWithdraw && canSend ? () => _withdraw(context) : null,
      title: Text(l.claimNumber(claim.number)),
      subtitle: Text(lines.join('\n')),
      trailing: StatusText(claimStatusLabel(l, claim.status), emphasis),
    );
  }
}

/// "Report a problem": what happened, when it was found, a sentence about
/// it, and photos taken there and then. Notice to the carrier or insurer has
/// a deadline, so this is short.
class ReportClaimScreen extends StatefulWidget {
  const ReportClaimScreen({super.key, required this.shipment});
  final Shipment shipment;

  @override
  State<ReportClaimScreen> createState() => _ReportClaimScreenState();
}

class _ReportClaimScreenState extends State<ReportClaimScreen> {
  String _kind = 'damage';
  DateTime _foundOn = DateTime.now();
  final _description = TextEditingController();
  final _value = TextEditingController();
  final List<Attachment> _photos = [];
  bool _busy = false;
  double? _progress;
  String? _error;
  SendReceipt? _sent;

  @override
  void dispose() {
    _description.dispose();
    _value.dispose();
    super.dispose();
  }

  Future<void> _addPhoto() async {
    final l = AppLocalizations.of(context);
    if (_photos.length >= claimMaxPhotos) return;
    try {
      final file = await pickAttachment(context, name: 'claim-${widget.shipment.reference}-${_photos.length + 1}');
      if (file != null && mounted) {
        setState(() {
          _photos.add(file);
          _error = null;
        });
      }
    } on AttachmentRefused catch (refused) {
      if (mounted) setState(() => _error = attachmentRefusal(l, refused));
    }
  }

  Future<void> _pickDate() async {
    final p = context.palette;
    var chosen = _foundOn;
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (sheet) => Container(
        height: 280,
        color: p.raised.surface,
        child: SafeArea(
          top: false,
          child: CupertinoDatePicker(
            mode: CupertinoDatePickerMode.date,
            initialDateTime: _foundOn,
            maximumDate: DateTime.now(),
            onDateTimeChanged: (value) => chosen = value,
          ),
        ),
      ),
    );
    if (mounted) setState(() => _foundOn = chosen);
  }

  Future<void> _send() async {
    final l = AppLocalizations.of(context);
    FocusScope.of(context).unfocus();
    if (_description.text.trim().length < 10) {
      HapticFeedback.heavyImpact();
      setState(() => _error = l.claimNeedDescription);
      return;
    }
    final text = _value.text.replaceAll(',', '').trim();
    final value = text.isEmpty ? null : double.tryParse(text);
    if (text.isNotEmpty && (value == null || value < 0)) {
      HapticFeedback.heavyImpact();
      setState(() => _error = l.claimInvalidValue);
      return;
    }
    final api = AppScope.read(context).api;
    setState(() => (_busy = true, _progress = 0, _error = null));
    SendReceipt? receipt;
    final error = await attempt(context, () async {
      receipt = await api.sendClaim(
        widget.shipment.reference,
        ClaimDraft(
          kind: _kind,
          description: _description.text,
          noticedOn: _foundOn.toIso8601String().substring(0, 10),
          claimedAmount: value,
          photos: List.of(_photos),
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
    if (sent != null) {
      return DoneView(title: l.sentTitle, body: sent.message, reference: widget.shipment.reference, onDone: () => Navigator.of(context).pop(true));
    }
    return ComposeScaffold(
      title: l.claimTitle,
      error: _error,
      action: SendButton(label: l.sendToKcpl, onPressed: _send, busy: _busy, progress: _progress),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
          child: ShipmentLine(widget.shipment),
        ),
        SectionHeader(l.claimWhat),
        RowGroup(
          children: [
            for (final kind in claimKinds)
              Semantics(
                selected: kind == _kind,
                inMutuallyExclusiveGroup: true,
                child: RowTile(
                  onTap: _busy
                      ? null
                      : () {
                          HapticFeedback.selectionClick();
                          setState(() => _kind = kind);
                        },
                  title: Text(claimKindLabel(l, kind), style: TextStyle(fontWeight: kind == _kind ? FontWeight.w600 : FontWeight.w400)),
                  trailing: kind == _kind ? Icon(KIcons.check, size: 20, color: p.ink) : const SizedBox(width: 20),
                ),
              ),
          ],
        ),
        SectionHeader(l.claimDescribe),
        GroupCard(
          child: TextField(
            controller: _description,
            enabled: !_busy,
            minLines: 3,
            maxLines: 6,
            maxLength: 2000,
            buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
            textCapitalization: TextCapitalization.sentences,
            style: context.type.bodyLarge,
            decoration: cardField(l.claimDescribeHint),
          ),
        ),
        const SizedBox(height: 20),
        GroupCard(
          child: Column(
            children: [
              RowTile(
                onTap: _busy ? null : _pickDate,
                title: Text(l.claimFoundOn),
                trailing: Text(formatDate(_foundOn.toIso8601String())),
                chevron: true,
              ),
              const Divider(indent: kGutter),
              TextField(
                controller: _value,
                enabled: !_busy,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: context.type.bodyLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                decoration: cardField(
                  l.claimValue,
                  suffix: Text('NPR', style: context.type.bodyLarge?.copyWith(color: p.secondary)),
                ).copyWith(labelText: l.claimValue, floatingLabelBehavior: FloatingLabelBehavior.always),
              ),
            ],
          ),
        ),
        SectionHeader(l.claimPhotos),
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            for (final (index, photo) in _photos.indexed)
              RowTile(
                leading: Icon(KIcons.image, size: 22, color: p.secondary),
                title: Text(photo.filename, maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: IconButton(
                  tooltip: l.claimRemovePhoto,
                  onPressed: _busy ? null : () => setState(() => _photos.removeAt(index)),
                  icon: Icon(KIcons.clear, size: 20, color: p.secondary),
                ),
              ),
            if (_photos.length < claimMaxPhotos)
              RowTile(
                onTap: _busy ? null : _addPhoto,
                leading: Icon(KIcons.camera, size: 22, color: p.accent),
                title: Text(l.claimAddPhoto, style: TextStyle(color: p.accent)),
                trailing: _photos.isEmpty ? null : Text(l.claimPhotoCount(_photos.length, claimMaxPhotos), style: TextStyle(color: p.secondary)),
              ),
          ],
        ),
        Footnote(l.claimFootnote),
      ],
    );
  }
}
