import 'package:flutter/cupertino.dart' show CupertinoButton, CupertinoDatePicker, CupertinoDatePickerMode, showCupertinoModalPopup;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/kcpl_api.dart' show ApiException;
import '../../auth/auth_repository.dart';
import '../../ui/format.dart';
import '../../ui/theme.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/compose.dart';
import '../../ui/widgets/sheet_route.dart';
import '../ops_controller.dart';
import '../ops_format.dart';
import '../ops_models.dart';
import '../ops_l10n.dart';

Future<T?> _sheet<T>(BuildContext context, Widget screen) => Navigator.of(context).push<T>(SheetRoute<T>(builder: (_) => screen));

/// "2026-09-25T17:00" in Nepal, whatever zone the phone is set to: the Job
/// File reads due times as Nepal wall-clock time.
String nepalWallClock(DateTime moment) {
  final nepal = moment.toUtc().add(const Duration(hours: 5, minutes: 45));
  String two(int v) => v.toString().padLeft(2, '0');
  return '${nepal.year}-${two(nepal.month)}-${two(nepal.day)}T${two(nepal.hour)}:${two(nepal.minute)}';
}

// Staff -----------------------------------------------------------------------

/// Chooses a colleague: to own the job, or to do a task.
Future<StaffOption?> pickStaff(BuildContext context, {required String title, String? current}) =>
    _sheet<StaffOption>(context, StaffPickerScreen(title: title, current: current));

class StaffPickerScreen extends StatefulWidget {
  const StaffPickerScreen({super.key, required this.title, this.current});
  final String title;

  /// The email of whoever has it now, ticked.
  final String? current;

  @override
  State<StaffPickerScreen> createState() => _StaffPickerScreenState();
}

class _StaffPickerScreenState extends State<StaffPickerScreen> {
  late final Future<List<StaffOption>> _staff = OpsScope.read(context).api.staff();
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return ComposeScaffold(
      title: widget.title,
      children: [
        GroupCard(
          margin: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 0),
          child: TextField(
            controller: _query,
            onChanged: (_) => setState(() {}),
            style: context.type.bodyLarge,
            decoration: cardField(context.l.opsSearchStaff, suffix: Icon(KIcons.search, size: 18, color: p.tertiary)),
          ),
        ),
        FutureBuilder<List<StaffOption>>(
          future: _staff,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              final error = snapshot.error;
              if (error is SignedOutException) OpsScope.read(context).expire();
              return Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Notice(title: error is ApiException && error.message.isNotEmpty ? error.message : context.l.opsStaffFailed),
              );
            }
            if (!snapshot.hasData) return const Padding(padding: EdgeInsets.only(top: 16), child: Skeleton(rows: 4));
            final query = _query.text.trim().toLowerCase();
            final matches = snapshot.data!
                .where((s) => query.isEmpty || s.name.toLowerCase().contains(query) || s.branches.any((b) => b.toLowerCase().contains(query)))
                .toList();
            if (matches.isEmpty) {
              return Padding(
                padding: EdgeInsets.only(top: 16),
                child: EmptyState(icon: KIcons.noResults, title: context.l.opsNobodyFound, description: context.l.opsStaffEmpty),
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SectionHeader(context.l.opsStaffHeader, top: 20),
                RowGroup(
                  indent: 68,
                  children: [
                    for (final person in matches)
                      Semantics(
                        selected: person.email.toLowerCase() == widget.current?.toLowerCase(),
                        child: RowTile(
                          onTap: () {
                            HapticFeedback.selectionClick();
                            Navigator.of(context).pop(person);
                          },
                          leading: CircleAvatar(
                            radius: 18,
                            backgroundColor: p.fill,
                            child: Text(initials(person.name), style: context.type.titleSmall?.copyWith(color: p.secondary)),
                          ),
                          title: Text(person.name),
                          subtitle: Text([?person.jobTitle, person.branches.join(', ')].join(' · ')),
                          trailing: person.email.toLowerCase() == widget.current?.toLowerCase() ? Icon(KIcons.check, size: 20, color: p.ink) : null,
                        ),
                      ),
                  ],
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

/// Gives the job to someone else, after one confirming tap. True when done.
Future<bool> reassignJob(BuildContext context, OpsJob job) async {
  final owner = await pickStaff(context, title: job.ownerName == null ? context.l.opsAssignJob : context.l.opsGiveJobTo, current: job.ownerEmail);
  if (owner == null || !context.mounted) return false;
  if (owner.email.toLowerCase() == job.ownerEmail?.toLowerCase()) return false;
  final messenger = ScaffoldMessenger.of(context);
  final controller = OpsScope.read(context);
  final l = context.l;
  try {
    await controller.api.reassign(job.reference, owner);
    HapticFeedback.mediumImpact();
    messenger.showSnackBar(SnackBar(content: Text(l.opsNowWith(job.reference, owner.name))));
    return true;
  } on SignedOutException {
    await controller.expire();
  } catch (error) {
    HapticFeedback.heavyImpact();
    messenger.showSnackBar(
      SnackBar(content: Text(error is ApiException && error.message.isNotEmpty ? error.message : l.opsReassignFailed)),
    );
  }
  return false;
}

// Tasks -------------------------------------------------------------------------

/// True when a task was added.
Future<bool> openAddTask(BuildContext context, JobFile file) async =>
    await _sheet<bool>(context, AddTaskScreen(file: file)) ?? false;

enum _Due { none, today, tomorrow, pick }

class AddTaskScreen extends StatefulWidget {
  const AddTaskScreen({super.key, required this.file});
  final JobFile file;

  @override
  State<AddTaskScreen> createState() => _AddTaskScreenState();
}

class _AddTaskScreenState extends State<AddTaskScreen> {
  final _title = TextEditingController();
  final _detail = TextEditingController();
  late String _branch;
  late final List<String> _branches;
  _Due _due = _Due.none;
  DateTime? _picked;
  StaffOption? _assignee;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final session = OpsScope.read(context).session;
    final job = widget.file.job;
    final handling = {job.primaryBranch, ...widget.file.handlingBranches}.where((b) => b.isNotEmpty);
    // Work can only be made for a branch the job has and the person may act in.
    _branches = [
      for (final branch in handling)
        if (session == null || session.canAccessAllBranches || session.branches.contains(branch)) branch,
    ];
    _branch = _branches.isEmpty ? job.primaryBranch : _branches.first;
  }

  @override
  void dispose() {
    _title.dispose();
    _detail.dispose();
    super.dispose();
  }

  DateTime? get _dueAt {
    final now = DateTime.now();
    return switch (_due) {
      _Due.none => null,
      _Due.today => DateTime(now.year, now.month, now.day, 17),
      _Due.tomorrow => DateTime(now.year, now.month, now.day + 1, 10),
      _Due.pick => _picked,
    };
  }

  Future<void> _pickDue() async {
    final now = DateTime.now();
    var chosen = _picked ?? DateTime(now.year, now.month, now.day, now.hour + 2);
    final p = context.palette;
    final ok = await showCupertinoModalPopup<bool>(
      context: context,
      builder: (popup) => Container(
        height: 320,
        color: p.surface,
        child: SafeArea(
          top: false,
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: CupertinoButton(onPressed: () => Navigator.of(popup).pop(true), child: Text(context.l.opsDone)),
              ),
              Expanded(
                child: CupertinoDatePicker(
                  initialDateTime: chosen,
                  minimumDate: DateTime(now.year, now.month, now.day),
                  minuteInterval: 5,
                  mode: CupertinoDatePickerMode.dateAndTime,
                  onDateTimeChanged: (value) => chosen = value,
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (ok == true && mounted) setState(() => (_picked = chosen, _due = _Due.pick));
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    if (title.isEmpty) {
      HapticFeedback.heavyImpact();
      setState(() => _error = context.l.opsNeedTaskTitle);
      return;
    }
    final api = OpsScope.read(context).api;
    final due = _dueAt;
    setState(() => (_busy = true, _error = null));
    final error = await attempt(
      context,
      () => api.addTask(
        widget.file.job.reference,
        title: title,
        detail: _detail.text.trim(),
        branch: _branch,
        dueAt: due == null ? '' : nepalWallClock(due),
        assignee: _assignee,
      ),
    );
    if (!mounted) return;
    if (error != null) {
      HapticFeedback.heavyImpact();
      setState(() => (_busy = false, _error = error));
      return;
    }
    HapticFeedback.mediumImpact();
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    ChoiceChip chip(_Due value, String label) => ChoiceChip(
      label: Text(label, style: TextStyle(color: _due == value ? p.surface : p.ink)),
      selected: _due == value,
      onSelected: _busy
          ? null
          : (_) {
              HapticFeedback.selectionClick();
              if (value == _Due.pick) {
                _pickDue();
              } else {
                setState(() => _due = value);
              }
            },
    );
    return ComposeScaffold(
      title: context.l.opsNewTask,
      error: _error,
      action: SendButton(label: context.l.opsAddTo(widget.file.job.reference), onPressed: _save, busy: _busy),
      children: [
        GroupCard(
          margin: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 0),
          child: Column(
            children: [
              TextField(
                controller: _title,
                enabled: !_busy,
                autofocus: true,
                textCapitalization: TextCapitalization.sentences,
                style: context.type.bodyLarge,
                decoration: cardField(context.l.opsTitle),
              ),
              Divider(height: 0.33, thickness: 0.33, indent: kGutter, color: p.hairline),
              TextField(
                controller: _detail,
                enabled: !_busy,
                minLines: 1,
                maxLines: 4,
                textCapitalization: TextCapitalization.sentences,
                style: context.type.bodyLarge,
                decoration: cardField(context.l.opsNotesOptional),
              ),
            ],
          ),
        ),
        SectionHeader(context.l.opsDue),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: kGutter),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              chip(_Due.none, context.l.opsNoDate),
              chip(_Due.today, context.l.opsToday5pm),
              chip(_Due.tomorrow, context.l.opsTomorrow10am),
              chip(_Due.pick, _due == _Due.pick && _picked != null ? formatDateTime(_picked!.toUtc().toIso8601String()) : context.l.opsPick),
            ],
          ),
        ),
        SectionHeader(context.l.opsAssignedTo),
        RowGroup(
          children: [
            RowTile(
              onTap: _busy
                  ? null
                  : () async {
                      final person = await pickStaff(context, title: context.l.opsAssignTask, current: _assignee?.email);
                      if (person != null && mounted) setState(() => _assignee = person);
                    },
              title: Text(_assignee?.name ?? context.l.opsNobodyYet),
              subtitle: _assignee == null ? null : Text(_assignee!.jobTitle ?? _assignee!.email),
              chevron: true,
            ),
          ],
        ),
        if (_branches.length > 1) ...[
          SectionHeader(context.l.opsBranch),
          RowGroup(
            children: [
              for (final branch in _branches)
                Semantics(
                  selected: branch == _branch,
                  inMutuallyExclusiveGroup: true,
                  child: RowTile(
                    onTap: _busy
                        ? null
                        : () {
                            HapticFeedback.selectionClick();
                            setState(() => _branch = branch);
                          },
                    title: Text(branch),
                    trailing: branch == _branch ? Icon(KIcons.check, size: 20, color: p.ink) : const SizedBox(width: 20),
                  ),
                ),
            ],
          ),
        ] else
          Footnote(context.l.opsTaskFootnote(_branch)),
      ],
    );
  }
}

// Closeout ------------------------------------------------------------------------

/// True when the job was closed.
Future<bool> openCloseJob(BuildContext context, JobFile file) async =>
    await _sheet<bool>(context, CloseJobScreen(file: file)) ?? false;

/// Closing a job: what still stands in the way, in the Job File's words. Only
/// Management may close over them, and only with a reason the Job File keeps.
class CloseJobScreen extends StatefulWidget {
  const CloseJobScreen({super.key, required this.file});
  final JobFile file;

  @override
  State<CloseJobScreen> createState() => _CloseJobScreenState();
}

class _CloseJobScreenState extends State<CloseJobScreen> {
  late List<String> _blockers = widget.file.closeBlockers;
  late bool _canOverride = OpsScope.read(context).session?.role == 'management';
  final _reason = TextEditingController();
  bool _busy = false;
  bool _closed = false;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _close() async {
    final overriding = _blockers.isNotEmpty;
    if (overriding && _reason.text.trim().length < 8) {
      HapticFeedback.heavyImpact();
      setState(() => _error = context.l.opsNeedOverride);
      return;
    }
    final api = OpsScope.read(context).api;
    setState(() => (_busy = true, _error = null));
    CloseoutBlocked? blocked;
    final error = await attempt(context, () async {
      try {
        await api.closeJob(widget.file.job.reference, overrideReason: overriding ? _reason.text.trim() : '');
      } on CloseoutBlocked catch (refusal) {
        blocked = refusal;
      }
    });
    if (!mounted) return;
    final refusal = blocked;
    if (refusal != null) {
      HapticFeedback.heavyImpact();
      setState(() {
        _busy = false;
        _blockers = refusal.blockers;
        _canOverride = refusal.canOverride;
        _error = context.l.opsNotClosed;
      });
      return;
    }
    if (error != null) {
      HapticFeedback.heavyImpact();
      setState(() => (_busy = false, _error = error));
      return;
    }
    HapticFeedback.mediumImpact();
    setState(() => _closed = true);
  }

  @override
  Widget build(BuildContext context) {
    final reference = widget.file.job.reference;
    if (_closed) {
      return DoneView(title: context.l.opsJobClosed, body: context.l.opsJobClosedBody, reference: reference);
    }
    final blocked = _blockers.isNotEmpty;
    return ComposeScaffold(
      title: context.l.opsCloseJob,
      error: _error,
      // Without the authority to close over blockers there is nothing to press.
      action: blocked && !_canOverride ? null : SendButton(label: blocked ? context.l.opsCloseAnyway : context.l.opsCloseReference(reference), onPressed: _close, busy: _busy),
      children: [
        if (!blocked) ...[
          const SizedBox(height: 4),
          Notice(
            title: context.l.opsReadyToClose,
            body: context.l.opsReadyToCloseBody,
            emphasis: Emphasis.normal,
          ),
        ] else ...[
          SectionHeader(context.l.opsStillOpen, top: 8),
          for (final blocker in _blockers)
            Padding(padding: const EdgeInsets.only(bottom: 8), child: Notice(title: blocker)),
          if (_canOverride) ...[
            SectionHeader(context.l.opsOverrideReason),
            GroupCard(
              child: TextField(
                controller: _reason,
                enabled: !_busy,
                minLines: 2,
                maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                style: context.type.bodyLarge,
                decoration: cardField(context.l.opsOverrideHint),
              ),
            ),
          ] else
            Footnote(context.l.opsCloseBlockedFootnote),
        ],
      ],
    );
  }
}
