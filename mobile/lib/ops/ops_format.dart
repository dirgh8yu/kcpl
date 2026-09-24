import '../ui/format.dart';

const priorityLabels = {'standard': 'Standard', 'high': 'High', 'urgent': 'Urgent'};

/// "5 min ago", "3 h ago", "2 d ago", then a date: how long ago something
/// happened matters more to a desk than when.
String ago(String? iso, {DateTime? now}) {
  final at = iso == null ? null : DateTime.tryParse(iso);
  if (at == null) return '—';
  final gap = (now ?? DateTime.now()).difference(at.toLocal());
  if (gap.inMinutes < 1) return 'just now';
  if (gap.inMinutes < 60) return '${gap.inMinutes} min ago';
  if (gap.inHours < 24) return '${gap.inHours} h ago';
  if (gap.inDays < 7) return '${gap.inDays} d ago';
  return formatShortDate(iso);
}

/// A task's due line: overdue first, because that is what a desk acts on.
String dueLine(String? iso, {DateTime? now}) {
  final at = iso == null ? null : DateTime.tryParse(iso);
  if (at == null) return 'No due date';
  final current = now ?? DateTime.now();
  final local = at.toLocal();
  if (local.isBefore(current)) return 'Overdue · due ${ago(iso, now: current)}';
  final today = DateTime(current.year, current.month, current.day);
  final day = DateTime(local.year, local.month, local.day);
  final time = '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  if (day == today) return 'Due today $time';
  if (day == today.add(const Duration(days: 1))) return 'Due tomorrow $time';
  return 'Due ${formatShortDate(iso)}';
}

String initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  return (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
}
