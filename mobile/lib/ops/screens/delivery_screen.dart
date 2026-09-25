import 'package:flutter/cupertino.dart' show CupertinoSlidingSegmentedControl;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/kcpl_api.dart' show ApiException;
import '../../api/models.dart';
import '../../l10n/app_localizations.dart';
import '../../ui/motion.dart';
import '../../ui/theme.dart';
import '../../ui/widgets/capture.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/compose.dart';
import '../../ui/widgets/sheet_route.dart';
import '../delivery_queue.dart';
import '../field_location.dart';
import '../ops_api.dart';
import '../ops_controller.dart';
import '../ops_models.dart';
import 'signature_screen.dart';
import '../ops_l10n.dart';

/// Opens the right step for where the delivery stands. True when something
/// was recorded.
Future<bool> openDelivery(BuildContext context, String reference, DeliveryControl control) {
  final open = control.open;
  final awaiting = control.awaitingPod;
  final Widget screen = open != null
      ? DeliveryOutcomeScreen(reference: reference, attempt: open)
      : awaiting != null
      ? DeliveryOutcomeScreen(reference: reference, attempt: awaiting, podOnly: true)
      : StartDeliveryScreen(reference: reference);
  return Navigator.of(context).push<bool>(SheetRoute<bool>(builder: (_) => screen)).then((v) => v ?? false);
}

/// Out for delivery: opens an attempt now, with who is taking it.
class StartDeliveryScreen extends StatefulWidget {
  const StartDeliveryScreen({super.key, required this.reference});
  final String reference;

  @override
  State<StartDeliveryScreen> createState() => _StartDeliveryScreenState();
}

class _StartDeliveryScreenState extends State<StartDeliveryScreen> {
  final _driver = TextEditingController();
  final _vehicle = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _driver.text = OpsScope.read(context).session?.displayName ?? '';
  }

  @override
  void dispose() {
    _driver.dispose();
    _vehicle.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    final api = OpsScope.read(context).api;
    setState(() => (_busy = true, _error = null));
    final queue = OpsScope.read(context).deliveries;
    DeliveryAttempt? started;
    var offline = false;
    final error = await attempt(context, () async {
      try {
        started = await api.startDelivery(widget.reference, driverName: _driver.text.trim(), vehicle: _vehicle.text.trim());
      } on ApiException catch (failure) {
        // No signal at the gate: the delivery is still recorded here and the
        // attempt is started with it, once KCPL can be reached.
        if (failure.code != 'network' || !queue.ready) rethrow;
        offline = true;
        started = const DeliveryAttempt(id: '', number: 0, status: 'out_for_delivery');
      }
    });
    if (!mounted) return;
    if (error != null || started == null) {
      HapticFeedback.heavyImpact();
      setState(() => (_busy = false, _error = error));
      return;
    }
    HapticFeedback.mediumImpact();
    // Straight on to recording how it goes: the same sheet, the next step.
    final recorded = await Navigator.of(context).pushReplacement<bool, bool>(
      SheetRoute<bool>(
        builder: (_) =>
            DeliveryOutcomeScreen(reference: widget.reference, attempt: started!, justStarted: true, offlineDriver: offline ? _driver.text.trim() : null),
      ),
    );
    if (recorded != null && mounted) Navigator.of(context).pop(recorded);
  }

  @override
  Widget build(BuildContext context) {
    return ComposeScaffold(
      title: context.l.opsOutForDelivery,
      error: _error,
      action: SendButton(label: context.l.opsStartDelivery, onPressed: _start, busy: _busy),
      children: [
        SectionHeader(context.l.opsTakenBy, top: 8),
        GroupCard(
          child: Column(
            children: [
              TextField(
                controller: _driver,
                enabled: !_busy,
                textCapitalization: TextCapitalization.words,
                style: context.type.bodyLarge,
                decoration: cardField(context.l.opsDriverHint),
              ),
              Divider(height: 0.33, thickness: 0.33, indent: kGutter, color: context.palette.hairline),
              TextField(
                controller: _vehicle,
                enabled: !_busy,
                textCapitalization: TextCapitalization.characters,
                style: context.type.bodyLarge,
                decoration: cardField(context.l.opsVehicleHint),
              ),
            ],
          ),
        ),
        Footnote(context.l.opsStartFootnote),
      ],
    );
  }
}

enum _Outcome { delivered, failed, refused }

/// Who took it, as KCPL records it (in English, as a record); the chips show
/// each in the reader's language.
const _relations = ['Consignee', 'Their staff', 'Security', 'Family'];

String _relationLabel(BuildContext context, String relation) => switch (relation) {
  'Consignee' => context.l.opsRelConsignee,
  'Their staff' => context.l.opsRelStaff,
  'Security' => context.l.opsRelSecurity,
  'Family' => context.l.opsRelFamily,
  _ => context.l.opsRelOther,
};

/// How the attempt ended. Delivered takes who received it, a signature
/// and photos, and where it happened; the rest take a reason. Evidence goes
/// to the desk as received: nothing here marks POD verified or the shipment
/// Delivered, which is decided at the desk once POD is checked.
class DeliveryOutcomeScreen extends StatefulWidget {
  const DeliveryOutcomeScreen({super.key, required this.reference, required this.attempt, this.podOnly = false, this.justStarted = false, this.offlineDriver});
  final String reference;
  final DeliveryAttempt attempt;

  /// Delivered already; only proof is being added.
  final bool podOnly;
  final bool justStarted;

  /// Set when the attempt could not be started for lack of signal: who is
  /// taking it, for when it is started with the recorded outcome.
  final String? offlineDriver;

  /// Recorded on the phone only, so far.
  bool get offline => attempt.id.isEmpty;

  @override
  State<DeliveryOutcomeScreen> createState() => _DeliveryOutcomeScreenState();
}

class _DeliveryOutcomeScreenState extends State<DeliveryOutcomeScreen> {
  _Outcome _outcome = _Outcome.delivered;
  final _recipient = TextEditingController();
  final _relation = TextEditingController();
  final _phone = TextEditingController();
  final _reason = TextEditingController();
  String? _relationChoice;
  Attachment? _signature;
  final List<Attachment> _photos = [];

  FieldFix? _fix;
  bool _locating = false;
  bool _located = false;

  bool _busy = false;
  double? _progress;
  String? _error;

  /// The outcome is on the server; only evidence is left to send.
  late bool _recorded = widget.podOnly;
  bool _done = false;

  /// Kept on the phone to send when there is signal.
  bool _kept = false;

  @override
  void initState() {
    super.initState();
    if (!widget.podOnly) _locate();
  }

  @override
  void dispose() {
    _recipient.dispose();
    _relation.dispose();
    _phone.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _locate() async {
    setState(() => _locating = true);
    final fix = await FieldLocation.current();
    if (!mounted) return;
    setState(() => (_fix = fix, _locating = false, _located = true));
  }

  String get _signer {
    final name = _recipient.text.trim();
    final relation = _relationChoice == context.l.opsRelOther ? _relation.text.trim() : (_relationChoice ?? '');
    return [if (name.isNotEmpty) name, if (relation.isNotEmpty) relation].join(' · ');
  }

  Future<void> _sign() async {
    FocusScope.of(context).unfocus();
    final signature = await captureSignature(
      context,
      name: 'pod-signature-${widget.reference}-${DateTime.now().millisecondsSinceEpoch}',
      signer: _signer.isEmpty ? context.l.opsRecipient : _signer,
    );
    if (signature != null && mounted) setState(() => (_signature = signature, _error = null));
  }

  Future<void> _addPhoto() async {
    final l = AppLocalizations.of(context);
    try {
      final photo = await pickAttachment(context, name: 'pod-photo-${widget.reference}-${DateTime.now().millisecondsSinceEpoch}', files: false);
      if (photo != null && mounted) {
        setState(() {
          _photos.add(photo);
          _error = null;
        });
      }
    } on AttachmentRefused catch (refused) {
      if (mounted) setState(() => _error = attachmentRefusal(l, refused));
    }
  }

  String? _check() {
    if (_outcome == _Outcome.delivered) {
      if (!_recorded && _recipient.text.trim().length < 2) return context.l.opsNeedRecipient;
      if (_signature == null && _photos.isEmpty) return context.l.opsNeedProof;
      return null;
    }
    if (_reason.text.trim().length < 6) return context.l.opsNeedReason;
    return null;
  }

  Future<void> _submit() async {
    final problem = _check();
    if (problem != null) {
      HapticFeedback.heavyImpact();
      setState(() => _error = problem);
      return;
    }
    FocusScope.of(context).unfocus();
    final api = OpsScope.read(context).api;
    final evidence = _outcome == _Outcome.delivered
        ? [if (_signature != null) ('signature', _signature!), for (final photo in _photos) ('photo', photo)]
        : const <(String, Attachment)>[];
    setState(() => (_busy = true, _error = null, _progress = evidence.isEmpty ? null : 0));
    final queue = OpsScope.read(context).deliveries;
    final recordedAt = DateTime.now();

    // Whatever has not reached KCPL is kept, from the step that failed on.
    Future<void> keep() async {
      final remaining = [if (_signature != null) ('signature', _signature!), for (final photo in _photos) ('photo', photo)];
      await queue.add(
        (id, owner) => QueuedDelivery(
          id: id,
          owner: owner,
          reference: widget.reference,
          recordedAt: recordedAt,
          status: _outcome.name,
          attemptId: widget.offline ? null : widget.attempt.id,
          driverName: widget.offlineDriver ?? '',
          recipientName: _recipient.text.trim(),
          recipientRelation: _relationChoice == context.l.opsRelOther ? _relation.text.trim() : (_relationChoice ?? ''),
          recipientPhone: _phone.text.trim(),
          failureReason: _reason.text.trim(),
          latitude: _fix?.latitude,
          longitude: _fix?.longitude,
          outcomeSent: _recorded,
          evidence: _outcome == _Outcome.delivered ? remaining : const [],
        ),
      );
      _kept = true;
    }

    final error = await attempt(context, () async {
      if (widget.offline) return keep();
      try {
        await _send(api, evidence, recordedAt);
      } on ApiException catch (failure) {
        if (failure.code != 'network' || !queue.ready) rethrow;
        await keep();
      }
    });
    if (!mounted) return;
    if (error != null) {
      HapticFeedback.heavyImpact();
      setState(() => (_busy = false, _progress = null, _error = error));
      return;
    }
    HapticFeedback.mediumImpact();
    setState(() => _done = true);
  }

  Future<void> _send(OpsApi api, List<(String, Attachment)> evidence, DateTime recordedAt) async {
    if (!_recorded) {
      await api.recordDelivery(
        widget.reference,
        widget.attempt.id,
        status: _outcome.name,
        recipientName: _recipient.text.trim(),
        recipientRelation: _relationChoice == context.l.opsRelOther ? _relation.text.trim() : (_relationChoice ?? ''),
        recipientPhone: _phone.text.trim(),
        failureReason: _reason.text.trim(),
        latitude: _fix?.latitude,
        longitude: _fix?.longitude,
        at: recordedAt,
      );
      _recorded = true;
    }
    // Each piece of evidence that lands is removed, so a retry after a
    // dropped signal sends only what is still missing.
    final total = evidence.length;
    for (var i = 0; i < total; i++) {
      final (kind, file) = evidence[i];
      await api.addPodEvidence(
        widget.reference,
        widget.attempt.id,
        kind,
        file,
        onProgress: (fraction) {
          if (mounted) setState(() => _progress = (i + fraction) / total);
        },
      );
      if (kind == 'signature') {
        _signature = null;
      } else {
        _photos.remove(file);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_done && _kept) {
      return DoneView(
        title: context.l.opsSavedOnPhone,
        body: context.l.opsSavedDeliveryBody,
        reference: widget.reference,
      );
    }
    if (_done) {
      final delivered = _outcome == _Outcome.delivered;
      return DoneView(
        title: delivered ? (widget.podOnly ? context.l.opsProofSent : context.l.opsDeliveryRecorded) : context.l.opsAttemptRecorded,
        body: delivered
            ? context.l.opsPodWithDesk(widget.reference)
            : context.l.opsExceptionOpened(widget.reference),
        reference: widget.reference,
      );
    }
    final delivered = _outcome == _Outcome.delivered;
    final action = _recorded && !widget.podOnly
        ? context.l.opsSendProof
        : widget.podOnly
        ? context.l.opsSendTo(widget.reference)
        : delivered
        ? context.l.opsRecordDelivery
        : context.l.opsRecordAttempt;
    return ComposeScaffold(
      title: widget.podOnly
          ? context.l.opsProofOfDelivery
          : widget.offline
          ? context.l.opsDelivery
          : context.l.opsAttemptN(widget.attempt.number),
      error: _error,
      action: SendButton(label: action, onPressed: _submit, busy: _busy, progress: _progress),
      children: [
        if (!widget.podOnly && !_recorded)
          Padding(
            padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 0),
            child: SizedBox(
              width: double.infinity,
              child: CupertinoSlidingSegmentedControl<_Outcome>(
                groupValue: _outcome,
                onValueChanged: _busy
                    ? (_) {}
                    : (value) {
                        if (value == null) return;
                        HapticFeedback.selectionClick();
                        setState(() => (_outcome = value, _error = null));
                      },
                children: {
                  _Outcome.delivered: Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text(context.l.opsDelivered)),
                  _Outcome.failed: Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text(context.l.opsNotDelivered)),
                  _Outcome.refused: Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text(context.l.opsRefused)),
                },
              ),
            ),
          ),
        // The two forms share a place; one gives way to the other without
        // the button jumping.
        AnimatedSwitcher(
          duration: Motion.reduced(context) ? Duration.zero : Motion.swap,
          switchInCurve: Motion.easeOut,
          switchOutCurve: Motion.easeOut,
          layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
          child: KeyedSubtree(
            key: ValueKey(delivered),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: delivered ? _deliveredFields(context) : _failedFields(context)),
          ),
        ),
        if (!widget.podOnly && !_recorded) ...[SectionHeader(context.l.opsWhere), _LocationRow(fix: _fix, locating: _locating, located: _located, onRetry: _locate)],
        Footnote(
          delivered
              ? context.l.opsProofFootnote
              : context.l.opsExceptionFootnote,
        ),
      ],
    );
  }

  List<Widget> _deliveredFields(BuildContext context) {
    final p = context.palette;
    return [
      if (!_recorded) ...[
        SectionHeader(context.l.opsReceivedByHeader),
        GroupCard(
          child: Column(
            children: [
              TextField(
                controller: _recipient,
                enabled: !_busy,
                textCapitalization: TextCapitalization.words,
                style: context.type.bodyLarge,
                onChanged: (_) => setState(() {}),
                decoration: cardField(context.l.opsFullName),
              ),
              Divider(height: 0.33, thickness: 0.33, indent: kGutter, color: p.hairline),
              TextField(
                controller: _phone,
                enabled: !_busy,
                keyboardType: TextInputType.phone,
                style: context.type.bodyLarge,
                decoration: cardField(context.l.opsPhoneOptional),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 0),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final relation in [..._relations, 'Other'])
                ChoiceChip(
                  // Set here: chips don't resolve a per-state label colour
                  // from the theme on every platform.
                  label: Text(_relationLabel(context, relation), style: TextStyle(color: _relationChoice == relation ? p.surface : p.ink)),
                  selected: _relationChoice == relation,
                  onSelected: _busy
                      ? null
                      : (on) {
                          HapticFeedback.selectionClick();
                          setState(() => _relationChoice = on ? relation : null);
                        },
                ),
            ],
          ),
        ),
        if (_relationChoice == context.l.opsRelOther)
          GroupCard(
            margin: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 0),
            child: TextField(
              controller: _relation,
              enabled: !_busy,
              autofocus: true,
              textCapitalization: TextCapitalization.sentences,
              style: context.type.bodyLarge,
              decoration: cardField(context.l.opsRelationHint),
            ),
          ),
      ],
      SectionHeader(context.l.opsProof),
      RowGroup(
        indent: RowGroup.iconIndent,
        children: [
          RowTile(
            onTap: _busy ? null : _sign,
            leading: Icon(KIcons.signature, size: 22, color: _signature == null ? p.accent : p.ink),
            title: Text(_signature == null ? context.l.opsGetSignature : context.l.opsSigned, style: TextStyle(color: _signature == null ? p.accent : null)),
            subtitle: _signature == null ? null : Text(_signer.isEmpty ? context.l.opsSignAgain : context.l.opsSignedBy(_signer)),
            trailing: _signature == null
                ? null
                : ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Image.memory(Uint8List.fromList(_signature!.bytes), height: 36, width: 72, fit: BoxFit.contain),
                  ),
          ),
          RowTile(
            onTap: _busy ? null : _addPhoto,
            leading: Icon(KIcons.camera, size: 22, color: p.accent),
            title: Text(_photos.isEmpty ? context.l.opsPhotographDelivery : context.l.opsAnotherPhoto, style: TextStyle(color: p.accent)),
            subtitle: _photos.isEmpty ? Text(context.l.opsPhotoHint) : null,
          ),
        ],
      ),
      if (_photos.isNotEmpty)
        SizedBox(
          height: 92,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 0),
            itemCount: _photos.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, index) => _Thumb(
              photo: _photos[index],
              onRemove: _busy
                  ? null
                  : () {
                      HapticFeedback.lightImpact();
                      setState(() => _photos.removeAt(index));
                    },
            ),
          ),
        ),
    ];
  }

  List<Widget> _failedFields(BuildContext context) => [
    SectionHeader(_outcome == _Outcome.refused ? context.l.opsWhyRefused : context.l.opsWhyNotDelivered),
    GroupCard(
      child: TextField(
        controller: _reason,
        enabled: !_busy,
        minLines: 3,
        maxLines: 6,
        textCapitalization: TextCapitalization.sentences,
        style: context.type.bodyLarge,
        decoration: cardField(_outcome == _Outcome.refused ? context.l.opsRefusedHint : context.l.opsFailedHint),
      ),
    ),
  ];
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.photo, this.onRemove});
  final Attachment photo;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Image.memory(Uint8List.fromList(photo.bytes), width: 80, height: 80, fit: BoxFit.cover, gaplessPlayback: true),
        ),
        if (onRemove != null)
          Positioned(
            top: -6,
            right: -6,
            child: Semantics(
              button: true,
              label: context.l.opsRemovePhoto,
              child: GestureDetector(
                onTap: onRemove,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: p.ink,
                    shape: BoxShape.circle,
                    border: Border.all(color: p.paper, width: 2),
                  ),
                  child: Icon(KIcons.close, size: 12, color: p.paper),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _LocationRow extends StatelessWidget {
  const _LocationRow({required this.fix, required this.locating, required this.located, required this.onRetry});
  final FieldFix? fix;
  final bool locating;
  final bool located;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final fix = this.fix;
    final String title;
    final String? subtitle;
    if (locating) {
      title = context.l.opsLocating;
      subtitle = null;
    } else if (fix != null) {
      title = '${fix.latitude.toStringAsFixed(5)}, ${fix.longitude.toStringAsFixed(5)}';
      subtitle = context.l.opsWithinMetres(fix.accuracy.round());
    } else {
      title = located ? context.l.opsNoLocation : context.l.opsLocation;
      subtitle = context.l.opsLocationHint;
    }
    return RowGroup(
      indent: RowGroup.iconIndent,
      children: [
        RowTile(
          onTap: locating || fix != null ? null : onRetry,
          leading: Icon(KIcons.location, size: 22, color: fix != null ? p.ink : p.secondary),
          title: Text(title, style: fix != null ? const TextStyle(fontFeatures: [FontFeature.tabularFigures()]) : null),
          subtitle: subtitle == null ? null : Text(subtitle),
        ),
      ],
    );
  }
}
