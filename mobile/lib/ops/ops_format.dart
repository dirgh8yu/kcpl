import '../l10n/app_localizations.dart';
import '../ui/format.dart';

String priorityLabel(AppLocalizations l, String priority) => switch (priority) {
  'standard' => l.opsPriorityStandard,
  'high' => l.opsPriorityHigh,
  'urgent' => l.opsPriorityUrgent,
  _ => priority,
};

/// "5 min ago", "3 h ago", "2 d ago", then a date: how long ago something
/// happened matters more to a desk than when.
String ago(AppLocalizations l, String? iso, {DateTime? now}) {
  final at = iso == null ? null : DateTime.tryParse(iso);
  if (at == null) return '—';
  final gap = (now ?? DateTime.now()).difference(at.toLocal());
  if (gap.inMinutes < 1) return l.opsJustNow;
  if (gap.inMinutes < 60) return l.opsMinutesAgo(gap.inMinutes);
  if (gap.inHours < 24) return l.opsHoursAgo(gap.inHours);
  if (gap.inDays < 7) return l.opsDaysAgo(gap.inDays);
  return formatShortDate(iso);
}

/// A task's due line: overdue first, because that is what a desk acts on.
String dueLine(AppLocalizations l, String? iso, {DateTime? now}) {
  final at = iso == null ? null : DateTime.tryParse(iso);
  if (at == null) return l.opsNoDueDate;
  final current = now ?? DateTime.now();
  final local = at.toLocal();
  if (local.isBefore(current)) return l.opsOverdueDue(ago(l, iso, now: current));
  final today = DateTime(current.year, current.month, current.day);
  final day = DateTime(local.year, local.month, local.day);
  final time = '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  if (day == today) return l.opsDueToday(time);
  if (day == today.add(const Duration(days: 1))) return l.opsDueTomorrow(time);
  return l.opsDueOn(formatShortDate(iso));
}

String initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  return (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
}
