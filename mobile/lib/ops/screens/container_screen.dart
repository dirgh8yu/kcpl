import 'package:flutter/cupertino.dart' show CupertinoDatePicker, CupertinoDatePickerMode, showCupertinoModalPopup;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../ui/format.dart';
import '../../ui/theme.dart';
import '../../ui/widgets/capture.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/compose.dart';
import '../../ui/widgets/sheet_route.dart';
import '../ops_controller.dart';
import '../ops_l10n.dart';
import '../ops_models.dart';

/// Where a container is, in a few words for its row.
String containerLine(BuildContext context, OpsContainer container) {
  final l = context.l;
  if (container.emptyReturnedOn != null) return l.opsContainerBackOn(formatDate(container.emptyReturnedOn));
  if (container.deliveredOn != null) return l.opsContainerDeliveredOn(formatDate(container.deliveredOn));
  if (container.gatedOutOn != null) return l.opsContainerOutSince(formatDate(container.gatedOutOn));
  return l.opsContainerAtPort;
}

/// The updated container when a date was saved.
Future<OpsContainer?> openContainer(BuildContext context, String reference, OpsContainer container) =>
    Navigator.of(context).push<OpsContainer>(SheetRoute<OpsContainer>(builder: (_) => ContainerScreen(reference: reference, container: container)));

/// A container date from where it happens: at the port gate, at the
/// customer's door, at the empty yard. The next step for the box is chosen
/// already; the date is today unless changed; the gate receipt is one tap.
class ContainerScreen extends StatefulWidget {
  const ContainerScreen({super.key, required this.reference, required this.container});
  final String reference;
  final OpsContainer container;

  @override
  State<ContainerScreen> createState() => _ContainerScreenState();
}

class _ContainerScreenState extends State<ContainerScreen> {
  late String _movement = widget.container.next ?? 'empty_returned';
  DateTime _on = DateTime.now();
  Attachment? _photo;
  bool _busy = false;
  double? _progress;
  String? _error;

  static const _movements = ['gated_out', 'delivered', 'empty_returned'];

  String _label(String movement) => switch (movement) {
    'gated_out' => context.l.opsContainerMoveOut,
    'delivered' => context.l.opsContainerMoveDelivered,
    _ => context.l.opsContainerMoveBack,
  };

  Future<void> _pick() async {
    try {
      final file = await pickAttachment(context, name: 'gate-receipt-${widget.container.number}', scan: true);
      if (file != null && mounted) setState(() => (_photo = file, _error = null));
    } on AttachmentRefused catch (refused) {
      if (mounted) setState(() => _error = attachmentRefusal(context.l, refused));
    }
  }

  Future<void> _pickDate() async {
    final p = context.palette;
    var chosen = _on;
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (sheet) => Container(
        height: 280,
        color: p.raised.surface,
        child: SafeArea(
          top: false,
          child: CupertinoDatePicker(
            mode: CupertinoDatePickerMode.date,
            initialDateTime: _on,
            maximumDate: DateTime.now(),
            onDateTimeChanged: (value) => chosen = value,
          ),
        ),
      ),
    );
    if (mounted) setState(() => _on = chosen);
  }

  Future<void> _save() async {
    final api = OpsScope.read(context).api;
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final saved = context.l.opsContainerSaved(widget.container.number);
    setState(() => (_busy = true, _progress = 0, _error = null));
    OpsContainer? updated;
    final error = await attempt(context, () async {
      updated = await api.recordContainer(
        widget.reference,
        widget.container.number,
        _movement,
        on: _on,
        photo: _photo,
        onProgress: (fraction) {
          if (mounted) setState(() => _progress = fraction);
        },
      );
    });
    if (!mounted) return;
    if (updated != null) {
      HapticFeedback.mediumImpact();
      messenger.showSnackBar(SnackBar(content: Text(saved)));
      navigator.pop(updated);
      return;
    }
    setState(() => (_busy = false, _progress = null, _error = error));
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l;
    final p = context.palette;
    return ComposeScaffold(
      title: l.opsContainerTitle(widget.container.number),
      error: _error,
      action: SendButton(label: l.opsContainerSave, onPressed: _save, busy: _busy, progress: _progress),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
          child: Text('${widget.container.sizeType} · ${containerLine(context, widget.container)}', style: context.type.bodyMedium?.copyWith(color: p.secondary)),
        ),
        SectionHeader(l.opsContainerWhat),
        RowGroup(
          children: [
            for (final movement in _movements)
              Semantics(
                selected: movement == _movement,
                inMutuallyExclusiveGroup: true,
                child: RowTile(
                  onTap: _busy
                      ? null
                      : () {
                          HapticFeedback.selectionClick();
                          setState(() => _movement = movement);
                        },
                  title: Text(_label(movement), style: TextStyle(fontWeight: movement == _movement ? FontWeight.w600 : FontWeight.w400)),
                  trailing: movement == _movement ? Icon(KIcons.check, size: 20, color: p.ink) : const SizedBox(width: 20),
                ),
              ),
          ],
        ),
        const SizedBox(height: 20),
        RowGroup(
          children: [
            RowTile(
              onTap: _busy ? null : _pickDate,
              title: Text(l.opsContainerOn),
              trailing: Text(formatDate(_on.toIso8601String())),
              chevron: true,
            ),
          ],
        ),
        SectionHeader(l.opsContainerReceipt),
        AttachmentField(file: _photo, onPick: _pick, enabled: !_busy, hint: l.opsContainerReceiptHint),
        Footnote(l.opsContainerFootnote),
      ],
    );
  }
}
