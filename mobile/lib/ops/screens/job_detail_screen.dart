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
import 'field_note_screen.dart';

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
        load: () => api.job(reference),
        leading: preview == null ? 0 : 2,
        placeholder: preview == null ? null : (context) => _lead(context, preview),
        onMissing: (context, _) => const EmptyState(
          icon: KIcons.noResults,
          title: 'Job not found',
          description: 'It may have been closed or moved outside your branches.',
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
          trailing: job.urgent ? 'Urgent' : null,
          subtitle: job.currentLocation != null && job.status != 'delivered' ? l.overviewNowAt(job.currentLocation!) : job.primaryBranch,
        ),
      ),
    ];
  }

  List<Widget> _body(BuildContext context, JobFile file) {
    final l = AppLocalizations.of(context);
    final job = file.job;

    return [
      SectionHeader('Owner'),
      if (job.ownerName == null)
        const Notice(title: 'Unassigned', body: 'Nobody owns this job yet. Assign it from the Job File on the web.')
      else
        RowGroup(
          children: [_OwnerRow(name: job.ownerName!, title: file.ownerTitle, phone: job.ownerPhone, branch: job.primaryBranch)],
        ),
      if (file.tasks.isEmpty) ...[
        SectionHeader('Tasks'),
        const GroupCard(
          child: EmptyState(icon: KIcons.tasks, title: 'No tasks', description: 'Tasks added in the Job File appear here.'),
        ),
      ] else
        _Checklist(
          label: 'Tasks',
          key: ValueKey('tasks-${job.reference}'),
          items: [
            for (final task in file.tasks)
              _Item(
                id: task.id,
                title: task.title,
                detail: [if (!task.completed) dueLine(task.dueAt), if (task.assignee != null) task.assignee!].join(' · '),
                attention: task.overdue(DateTime.now()),
                completed: task.completed,
              ),
          ],
          onToggle: (id, value) => OpsScope.read(context).api.setTask(job.reference, id, value),
        ),
      if (file.customs.isNotEmpty) ...[
        _Checklist(
          label: 'Customs',
          key: ValueKey('customs-${job.reference}'),
          items: [
            for (final step in file.customs)
              _Item(id: step.id, title: step.title, detail: step.required ? 'Required' : 'Optional', completed: step.completed),
          ],
          onToggle: (id, value) => OpsScope.read(context).api.setCustomsStep(job.reference, id, value),
        ),
      ],
      if (file.blockers.isNotEmpty) ...[
        SectionHeader('Before closeout'),
        for (final blocker in file.blockers)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Notice(title: blocker, emphasis: Emphasis.normal),
          ),
      ],
      SectionHeader('From the field'),
      RowGroup(
        indent: RowGroup.iconIndent,
        children: [
          RowTile(
            onTap: () async {
              if (await openFieldNote(context, job.reference) && context.mounted) await AsyncPage.reload(context);
            },
            leading: Icon(KIcons.camera, size: 22, color: context.palette.accent),
            title: Text('Add a note or photo', style: TextStyle(color: context.palette.accent)),
          ),
          for (final note in file.fieldNotes)
            RowTile(
              leading: Icon(note.photoFilename == null ? KIcons.note : KIcons.image, size: 20, color: context.palette.secondary),
              title: Text(note.text.isEmpty ? (note.photoFilename ?? 'Photo') : note.text),
              subtitle: Text(
                [?note.author, formatDateTime(note.createdAt), if (note.photoFilename != null && note.text.isNotEmpty) 'Photo'].join(' · '),
              ),
            ),
        ],
      ),
      if (file.internalNotes != null) ...[
        SectionHeader('Notes'),
        GroupCard(
          padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 12),
          child: Text(file.internalNotes!, style: context.type.bodyLarge),
        ),
      ],
      SectionHeader('Details'),
      RowGroup(
        children: [
          if (job.customerName.isNotEmpty) DetailRow('Customer', job.customerName),
          DetailRow('Priority', priorityLabels[job.priority] ?? job.priority, emphasis: job.urgent ? Emphasis.attention : Emphasis.normal),
          DetailRow('Branch', job.primaryBranch),
          if (file.handlingBranches.any((b) => b != job.primaryBranch)) DetailRow('Handling', file.handlingBranches.join(', ')),
          DetailRow(l.shipsColCarrier, job.carrier ?? '—'),
          DetailRow(l.shipCarrierReference, file.carrierReference ?? '—'),
          DetailRow(l.shipCurrentLocation, job.currentLocation ?? l.shipNotReported),
          if (file.internalReference != null) DetailRow('Internal ref', file.internalReference!),
          DetailRow(l.overviewOrigin, job.origin.isEmpty ? '—' : job.origin),
          DetailRow(l.overviewDestination, job.destination.isEmpty ? '—' : job.destination),
        ],
      ),
      if (file.canViewCosts && (file.revenueTotals.isNotEmpty || file.costTotals.isNotEmpty)) ...[
        SectionHeader('Profitability'),
        for (final currency in {...file.revenueTotals.keys, ...file.costTotals.keys})
          RowGroup(
            children: [
              DetailRow('Revenue', formatMoney(file.revenueTotals[currency] ?? 0, currency)),
              DetailRow('Cost', formatMoney(file.costTotals[currency] ?? 0, currency)),
              DetailRow(
                'Profit',
                formatMoney(file.profitTotals[currency] ?? 0, currency),
                strong: true,
                emphasis: (file.profitTotals[currency] ?? 0) < 0 ? Emphasis.attention : Emphasis.normal,
              ),
              if (file.marginPercent[currency] != null) DetailRow('Margin', '${file.marginPercent[currency]!.toStringAsFixed(1)}%'),
            ],
          ),
      ],
    ];
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
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      messenger.showSnackBar(const SnackBar(content: Text('That could not be opened on this device.')));
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
                action(KIcons.phone, 'Call $name', Uri(scheme: 'tel', path: digits)),
                action(KIcons.whatsapp, 'WhatsApp $name', Uri.https('wa.me', '/${digits.replaceAll('+', '')}')),
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
  const _Checklist({super.key, required this.label, required this.items, required this.onToggle});

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
      final message = error is ApiException && error.message.isNotEmpty ? error.message : 'That change was not saved. Try again.';
      messenger.showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = widget.items.where((item) => _pending[item.id] ?? item.completed).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader('${widget.label} · $done of ${widget.items.length} done'),
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            for (final item in widget.items)
              _CheckRow(item: item, completed: _pending[item.id] ?? item.completed, onTap: () => _toggle(item)),
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
