import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/kcpl_api.dart' show ApiException;
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../ui/format.dart';
import '../../ui/labels.dart';
import '../../ui/motion.dart';
import '../../ui/screens/overview_screen.dart' show JourneyGraphic;
import '../../ui/theme.dart';
import '../../ui/widgets/async_view.dart';
import '../../ui/widgets/common.dart';
import '../ops_controller.dart';
import '../ops_format.dart';
import '../ops_models.dart';
import '../delivery_queue.dart';
import '../note_queue.dart';
import 'delivery_screen.dart';
import 'field_note_screen.dart';
import 'job_actions.dart';
import '../ops_l10n.dart';

class JobDetailScreen extends StatelessWidget {
  const JobDetailScreen({super.key, required this.reference, this.preview});
  final String reference;

  /// The row this was opened from: its journey draws at once, and the
  /// Today card's journey lands here.
  final OpsJob? preview;

  @override
  Widget build(BuildContext context) {
    final api = OpsScope.of(context).api;
    final preview = this.preview;
    return Scaffold(
      body: AsyncPage<JobFile>(
        title: reference,
        load: () async {
          // Delivery Control is read beside the Job File; if it cannot be,
          // the rest of the job still shows.
          final loaded = await Future.wait<Object?>([
            api.job(reference),
            api.delivery(reference).then<DeliveryControl?>((d) => d, onError: (Object _) => null),
          ]);
          return (loaded[0] as JobFile).withDelivery(loaded[1] as DeliveryControl?);
        },
        leading: preview == null ? 0 : 2,
        placeholder: preview == null ? null : (context) => _lead(context, preview),
        onMissing: (context, _) => EmptyState(
          icon: KIcons.noResults,
          title: context.l.opsJobNotFound,
          description: context.l.opsJobNotFoundBody,
        ),
        builder: (context, file) => [..._lead(context, file.job), ..._body(context, file)],
      ),
    );
  }

  List<Widget> _lead(BuildContext context, OpsJob job) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    return [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
        child: Text(
          [if (job.customerName.isNotEmpty) job.customerName, modeLabel(l, job.mode), if (job.carrier != null) job.carrier!].join(' · '),
          style: context.type.bodyMedium?.copyWith(color: p.secondary),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(kGutter, 16, kGutter, 0),
        child: JourneyGraphic(
          shipment: job.asShipment,
          trailing: job.urgent ? context.l.opsPriorityUrgent : null,
          subtitle: job.currentLocation != null && job.status != 'delivered' ? l.overviewNowAt(job.currentLocation!) : job.primaryBranch,
        ),
      ),
    ];
  }

  List<Widget> _body(BuildContext context, JobFile file) {
    final l = AppLocalizations.of(context);
    final job = file.job;

    return [
      SectionHeader(context.l.opsOwner),
      RowGroup(
        indent: job.ownerName == null ? RowGroup.iconIndent : 68,
        children: [
          if (job.ownerName != null) _OwnerRow(name: job.ownerName!, title: file.ownerTitle, phone: job.ownerPhone, branch: job.primaryBranch),
          if (!file.jobClosed)
            _ActionRow(
              icon: KIcons.reassign,
              label: job.ownerName == null ? context.l.opsAssignSomeone : context.l.opsGiveToSomeone,
              onTap: () async {
                if (await reassignJob(context, job) && context.mounted) await AsyncPage.reload(context);
              },
            ),
        ],
      ),
      if (job.ownerName == null) Footnote(context.l.opsNoOwner),
      if (file.tasks.isEmpty) ...[
        SectionHeader(context.l.opsTasks),
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            if (!file.jobClosed)
              _ActionRow(
                icon: KIcons.add,
                label: context.l.opsNewTask,
                onTap: () async {
                  if (await openAddTask(context, file) && context.mounted) await AsyncPage.reload(context);
                },
              ),
          ],
        ),
        Footnote(context.l.opsNoTasks),
      ] else
        _Checklist(
          add: file.jobClosed
              ? null
              : () async {
                  if (await openAddTask(context, file) && context.mounted) await AsyncPage.reload(context);
                },
          label: context.l.opsTasks,
          key: ValueKey('tasks-${job.reference}'),
          items: [
            for (final task in file.tasks)
              _Item(
                id: task.id,
                title: task.title,
                detail: [if (!task.completed) dueLine(context.l, task.dueAt), if (task.assignee != null) task.assignee!].join(' · '),
                attention: task.overdue(DateTime.now()),
                completed: task.completed,
              ),
          ],
          onToggle: (id, value) => OpsScope.read(context).api.setTask(job.reference, id, value),
        ),
      if (file.customs.isNotEmpty) ...[
        _Checklist(
          label: context.l.opsCustoms,
          key: ValueKey('customs-${job.reference}'),
          items: [
            for (final step in file.customs)
              _Item(id: step.id, title: step.title, detail: step.required ? context.l.opsRequired : context.l.opsOptional, completed: step.completed),
          ],
          onToggle: (id, value) => OpsScope.read(context).api.setCustomsStep(job.reference, id, value),
        ),
      ],
      if (file.blockers.isNotEmpty) ...[
        SectionHeader(context.l.opsBeforeCloseout),
        for (final blocker in file.blockers)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Notice(title: blocker, emphasis: Emphasis.normal),
          ),
      ],
      _DeliverySection(file: file),
      SectionHeader(context.l.opsFromField),
      _FieldNotes(reference: job.reference, notes: file.fieldNotes),
      if (file.internalNotes != null) ...[
        SectionHeader(context.l.opsNotes),
        GroupCard(
          padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 12),
          child: Text(file.internalNotes!, style: context.type.bodyLarge),
        ),
      ],
      SectionHeader(context.l.opsDetails),
      RowGroup(
        children: [
          if (job.customerName.isNotEmpty) DetailRow(context.l.opsCustomer, job.customerName),
          DetailRow(context.l.opsPriority, priorityLabel(context.l, job.priority), emphasis: job.urgent ? Emphasis.attention : Emphasis.normal),
          DetailRow(context.l.opsBranch, job.primaryBranch),
          if (file.handlingBranches.any((b) => b != job.primaryBranch)) DetailRow(context.l.opsHandling, file.handlingBranches.join(', ')),
          DetailRow(l.shipsColCarrier, job.carrier ?? '—'),
          DetailRow(l.shipCarrierReference, file.carrierReference ?? '—'),
          DetailRow(l.shipCurrentLocation, job.currentLocation ?? l.shipNotReported),
          if (file.internalReference != null) DetailRow(context.l.opsInternalRef, file.internalReference!),
          DetailRow(l.overviewOrigin, job.origin.isEmpty ? '—' : job.origin),
          DetailRow(l.overviewDestination, job.destination.isEmpty ? '—' : job.destination),
        ],
      ),
      if (file.canViewCosts && (file.revenueTotals.isNotEmpty || file.costTotals.isNotEmpty)) ...[
        SectionHeader(context.l.opsProfitability),
        for (final currency in {...file.revenueTotals.keys, ...file.costTotals.keys})
          RowGroup(
            children: [
              DetailRow(context.l.opsRevenue, formatMoney(file.revenueTotals[currency] ?? 0, currency)),
              DetailRow(context.l.opsCost, formatMoney(file.costTotals[currency] ?? 0, currency)),
              DetailRow(
                context.l.opsProfit,
                formatMoney(file.profitTotals[currency] ?? 0, currency),
                strong: true,
                emphasis: (file.profitTotals[currency] ?? 0) < 0 ? Emphasis.attention : Emphasis.normal,
              ),
              if (file.marginPercent[currency] != null) DetailRow(context.l.opsMargin, '${file.marginPercent[currency]!.toStringAsFixed(1)}%'),
            ],
          ),
      ],
      const SizedBox(height: 28),
      if (file.jobClosed)
        Footnote(context.l.opsJobIsClosed)
      else
        RowGroup(
          children: [
            RowTile(
              onTap: () async {
                if (await openCloseJob(context, file) && context.mounted) await AsyncPage.reload(context);
              },
              title: Center(child: Text(context.l.opsCloseJobEllipsis, style: TextStyle(color: context.palette.accent))),
            ),
          ],
        ),
    ];
  }

}

/// Delivery on the job: how the last attempt went, where proof stands, and
/// the next step. A delivery recorded without signal shows here until it has
/// gone, and then the page refreshes to show it as KCPL has it.
class _DeliverySection extends StatefulWidget {
  const _DeliverySection({required this.file});
  final JobFile file;

  @override
  State<_DeliverySection> createState() => _DeliverySectionState();
}

class _DeliverySectionState extends State<_DeliverySection> {
  late final DeliveryQueue _queue = OpsScope.read(context).deliveries;
  late bool _waiting = _queue.waitingFor(widget.file.job.reference) != null;

  @override
  void initState() {
    super.initState();
    _queue.addListener(_changed);
  }

  @override
  void dispose() {
    _queue.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    final waiting = _queue.waitingFor(widget.file.job.reference) != null;
    final sent = _waiting && !waiting;
    _waiting = waiting;
    if (!mounted) return;
    setState(() {});
    if (sent) AsyncPage.reload(context);
  }

  Future<void> _queued(QueuedDelivery delivery) async {
    final discard = await showModalBottomSheet<bool>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 12),
              child: Text(
                delivery.refusal ?? context.l.opsQueuedDeliveryBody,
                style: sheet.type.bodyMedium?.copyWith(color: sheet.palette.secondary),
              ),
            ),
            RowGroup(
              children: [
                RowTile(
                  onTap: () => Navigator.of(sheet).pop(true),
                  title: Center(child: Text(context.l.opsDeleteDelivery, style: TextStyle(color: sheet.palette.accent))),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (discard == true) await _queue.discard(delivery.id);
  }

  @override
  Widget build(BuildContext context) {
    final file = widget.file;
    final control = file.delivery;
    final pending = _queue.waitingFor(file.job.reference);
    final p = context.palette;
    final latest = control?.latest;
    final String? action = pending != null || control == null || file.jobClosed
        ? null
        : control.open != null
        ? context.l.opsRecordHowItWent
        : control.awaitingPod != null
        ? context.l.opsAddProof
        : file.job.status == 'delivered'
        ? null
        : context.l.opsStartDelivery;
    if (latest == null && action == null && pending == null) return const SizedBox.shrink();
    final photos = control?.evidence.where((e) => e.kind == 'photo').length ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(context.l.opsDelivery),
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            if (pending != null)
              RowTile(
                onTap: () => _queued(pending),
                leading: Icon(KIcons.outbox, size: 20, color: pending.refusal == null ? p.secondary : p.accent),
                title: Text(pending.delivered
                    ? (pending.recipientName.isEmpty ? context.l.opsDelivered : context.l.opsReceivedBy(pending.recipientName))
                    : pending.status == 'refused'
                    ? context.l.opsRefused
                    : context.l.opsNotDelivered),
                subtitle: Text(
                  pending.refusal ?? [context.l.opsWaitingForSignal, formatDateTime(pending.recordedAt.toUtc().toIso8601String()), if (pending.evidence.isNotEmpty) context.l.opsProofCount(pending.evidence.length)].join(' · '),
                  style: pending.refusal == null ? null : TextStyle(color: p.accent),
                ),
              ),
            if (latest != null)
              RowTile(
                leading: Icon(KIcons.truck, size: 20, color: latest.status == 'failed' || latest.status == 'refused' ? p.accent : p.secondary),
                title: Text(context.l.opsAttemptLabel(latest.number, attemptLabel(context.l, latest))),
                subtitle: Text(
                  [
                    if (latest.failureReason != null) latest.failureReason!,
                    if (latest.status == 'delivered' && latest.recipientRelation != null) latest.recipientRelation!,
                    formatDateTime(latest.eventTime ?? latest.scheduledFor),
                  ].join(' · '),
                ),
              ),
            if (control != null && (latest?.status == 'delivered' || control.evidence.isNotEmpty))
              RowTile(
                leading: Icon(KIcons.signature, size: 20, color: control.podStatus == 'rejected' ? p.accent : p.secondary),
                title: Text(podLabel(context.l, control.podStatus)),
                subtitle: control.evidence.isEmpty
                    ? null
                    : Text(
                        [
                          if (control.evidence.any((e) => e.kind == 'signature')) context.l.opsSignature,
                          if (photos > 0) context.l.opsPhotoCount(photos),
                          if (control.evidence.any((e) => e.kind == 'document')) context.l.opsDocument,
                        ].join(' · '),
                      ),
              ),
            if (action != null)
              _ActionRow(
                icon: KIcons.delivery,
                label: action,
                onTap: () async {
                  if (await openDelivery(context, file.job.reference, control!) && context.mounted) await AsyncPage.reload(context);
                },
              ),
          ],
        ),
      ],
    );
  }
}

String attemptLabel(AppLocalizations l, DeliveryAttempt attempt) => switch (attempt.status) {
  'scheduled' => l.opsScheduled,
  'out_for_delivery' => l.opsOutForDelivery,
  'delivered' => attempt.recipientName == null ? l.opsDelivered : l.opsReceivedBy(attempt.recipientName!),
  'refused' => l.opsRefused,
  _ => l.opsNotDelivered,
};

String podLabel(AppLocalizations l, String status) => switch (status) {
  'received' => l.opsPodReceived,
  'verified' => l.opsPodVerified,
  'rejected' => l.opsPodRejected,
  _ => l.opsPodNone,
};

/// An action in a list, in the accent colour, as iOS writes "Add…" rows.
class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = context.palette.accent;
    return RowTile(
      onTap: onTap,
      leading: Icon(icon, size: 22, color: accent),
      title: Text(label, style: TextStyle(color: accent)),
    );
  }
}

/// Notes on the job, and under them any written here without signal that
/// are still on the phone. When one of those goes, the page refreshes to
/// show it as KCPL has it.
class _FieldNotes extends StatefulWidget {
  const _FieldNotes({required this.reference, required this.notes});
  final String reference;
  final List<FieldNote> notes;

  @override
  State<_FieldNotes> createState() => _FieldNotesState();
}

class _FieldNotesState extends State<_FieldNotes> {
  late final NoteQueue _queue = OpsScope.read(context).notes;
  late int _waiting = _queue.waitingFor(widget.reference).length;

  @override
  void initState() {
    super.initState();
    _queue.addListener(_changed);
  }

  @override
  void dispose() {
    _queue.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    final waiting = _queue.waitingFor(widget.reference).length;
    final sent = waiting < _waiting;
    _waiting = waiting;
    if (!mounted) return;
    setState(() {});
    if (sent) AsyncPage.reload(context);
  }

  Future<void> _queued(QueuedNote note) async {
    final discard = await showModalBottomSheet<bool>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 12),
              child: Text(
                note.refusal ?? context.l.opsQueuedNoteBody,
                style: sheet.type.bodyMedium?.copyWith(color: sheet.palette.secondary),
              ),
            ),
            RowGroup(
              children: [
                RowTile(
                  onTap: () => Navigator.of(sheet).pop(true),
                  title: Center(child: Text(context.l.opsDeleteNote, style: TextStyle(color: sheet.palette.accent))),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (discard == true) await _queue.discard(note.id);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final waiting = _queue.waitingFor(widget.reference);
    return RowGroup(
      indent: RowGroup.iconIndent,
      children: [
        _ActionRow(
          icon: KIcons.camera,
          label: context.l.opsAddNote,
          onTap: () async {
            if (await openFieldNote(context, widget.reference) && context.mounted) await AsyncPage.reload(context);
          },
        ),
        for (final note in waiting.reversed)
          RowTile(
            onTap: () => _queued(note),
            leading: Icon(KIcons.outbox, size: 20, color: note.refusal == null ? p.secondary : p.accent),
            title: Text(note.text.isEmpty ? (note.photo?.filename ?? context.l.opsPhoto) : note.text),
            subtitle: Text(
              note.refusal ?? [context.l.opsWaitingForSignal, formatDateTime(note.createdAt.toUtc().toIso8601String()), if (note.photo != null) context.l.opsPhoto].join(' · '),
              style: note.refusal == null ? null : TextStyle(color: p.accent),
            ),
          ),
        for (final note in widget.notes)
          RowTile(
            leading: Icon(note.photoFilename == null ? KIcons.note : KIcons.image, size: 20, color: p.secondary),
            title: Text(note.text.isEmpty ? (note.photoFilename ?? context.l.opsPhoto) : note.text),
            subtitle: Text(
              [?note.author, formatDateTime(note.createdAt), if (note.photoFilename != null && note.text.isNotEmpty) context.l.opsPhoto].join(' · '),
            ),
          ),
      ],
    );
  }
}

class _OwnerRow extends StatelessWidget {
  const _OwnerRow({required this.name, this.title, this.phone, required this.branch});
  final String name;
  final String? title;
  final String? phone;
  final String branch;

  Future<void> _launch(BuildContext context, Uri uri) async {
    final messenger = ScaffoldMessenger.of(context);
    final failed = context.l.opsCouldNotOpen;
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      messenger.showSnackBar(SnackBar(content: Text(failed)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final digits = phone?.replaceAll(RegExp(r'[^0-9+]'), '');
    Widget action(IconData icon, String label, Uri uri) => Padding(
      padding: const EdgeInsets.only(left: 8),
      child: Pressable(
        child: Material(
          color: p.fill,
          shape: const CircleBorder(),
          child: IconButton(tooltip: label, icon: Icon(icon, size: 18), onPressed: () => _launch(context, uri)),
        ),
      ),
    );
    return RowTile(
      leading: CircleAvatar(
        radius: 18,
        backgroundColor: p.fill,
        child: Text(initials(name), style: context.type.titleSmall?.copyWith(color: p.secondary)),
      ),
      title: Text(name),
      subtitle: Text([?title, branch].join(' · ')),
      trailing: digits == null || digits.isEmpty
          ? null
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                action(KIcons.phone, context.l.opsCall(name), Uri(scheme: 'tel', path: digits)),
                action(KIcons.whatsapp, context.l.opsWhatsApp(name), Uri.https('wa.me', '/${digits.replaceAll('+', '')}')),
              ],
            ),
    );
  }
}

class _Item {
  const _Item({required this.id, required this.title, required this.detail, required this.completed, this.attention = false});
  final String id;
  final String title;
  final String detail;
  final bool completed;
  final bool attention;
}

/// A tickable list, Reminders-style. A tick shows at once and is saved
/// behind it; if the save fails the tick comes back off and says so.
class _Checklist extends StatefulWidget {
  const _Checklist({super.key, required this.label, required this.items, required this.onToggle, this.add});

  /// Adds a task: a "New task" row closes the list, as in Reminders.
  final VoidCallback? add;

  /// The section title. The count beside it follows ticks as they happen.
  final String label;
  final List<_Item> items;
  final Future<void> Function(String id, bool completed) onToggle;

  @override
  State<_Checklist> createState() => _ChecklistState();
}

class _ChecklistState extends State<_Checklist> {
  final Map<String, bool> _pending = {};

  @override
  void didUpdateWidget(_Checklist oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Fresh data from the server wins wherever it now agrees.
    _pending.removeWhere((id, value) => widget.items.any((i) => i.id == id && i.completed == value));
  }

  Future<void> _toggle(_Item item) async {
    final next = !(_pending[item.id] ?? item.completed);
    final controller = OpsScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _pending[item.id] = next);
    next ? HapticFeedback.lightImpact() : HapticFeedback.selectionClick();
    try {
      await widget.onToggle(item.id, next);
    } on SignedOutException {
      await controller.expire();
    } catch (error) {
      if (!mounted) return;
      setState(() => _pending.remove(item.id));
      HapticFeedback.heavyImpact();
      final message = error is ApiException && error.message.isNotEmpty ? error.message : context.l.opsChangeNotSaved;
      messenger.showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = widget.items.where((item) => _pending[item.id] ?? item.completed).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(context.l.opsDoneOf(widget.label, done, widget.items.length)),
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            for (final item in widget.items)
              _CheckRow(item: item, completed: _pending[item.id] ?? item.completed, onTap: () => _toggle(item)),
            if (widget.add != null) _ActionRow(icon: KIcons.add, label: context.l.opsNewTask, onTap: widget.add!),
          ],
        ),
      ],
    );
  }
}

class _CheckRow extends StatelessWidget {
  const _CheckRow({required this.item, required this.completed, required this.onTap});
  final _Item item;
  final bool completed;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final reduced = Motion.reduced(context);
    final duration = reduced ? Duration.zero : Motion.swap;
    return Semantics(
      checked: completed,
      button: true,
      child: RowTile(
        onTap: onTap,
        leading: AnimatedContainer(
          duration: duration,
          curve: Motion.easeOut,
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: completed ? p.ink : Colors.transparent,
            border: Border.all(color: completed ? p.ink : (item.attention ? p.accent : p.tertiary), width: 1.6),
          ),
          child: AnimatedSwitcher(
            duration: duration,
            switchInCurve: Motion.easeOut,
            transitionBuilder: morphTransition,
            child: completed
                ? Icon(KIcons.check, key: const ValueKey('on'), size: 13, color: p.surface)
                : const SizedBox(key: ValueKey('off')),
          ),
        ),
        title: AnimatedDefaultTextStyle(
          duration: duration,
          curve: Motion.easeOut,
          style: (context.type.bodyLarge ?? const TextStyle()).copyWith(
            color: completed ? p.secondary : p.ink,
            decoration: completed ? TextDecoration.lineThrough : TextDecoration.none,
            decorationColor: p.tertiary,
          ),
          child: Text(item.title),
        ),
        subtitle: item.detail.isEmpty ? null : Text(item.detail, style: TextStyle(color: item.attention && !completed ? p.accent : null)),
      ),
    );
  }
}
