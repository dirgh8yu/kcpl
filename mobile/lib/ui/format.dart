import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

// Dates and amounts are records, so they read the same in either language,
// exactly as the web portal formats them (app/portal/portal-format.ts).

/// Loads the en-GB date symbols. Must complete before the first date is
/// formatted: Flutter only loads symbols for the UI locale, and a Nepali UI
/// would otherwise throw on the first shipment date.
Future<void> initFormatting() => initializeDateFormatting('en_GB');

final _date = DateFormat('d MMM yyyy', 'en_GB');
final _shortDate = DateFormat('d MMM', 'en_GB');
final _dateTime = DateFormat('d MMM yyyy, HH:mm', 'en_GB');

DateTime? _parse(String? value) {
  if (value == null || value.isEmpty) return null;
  return DateTime.tryParse(value.length <= 10 ? '${value}T00:00:00Z' : value);
}

String formatDate(String? value) {
  final parsed = _parse(value);
  if (parsed == null) return value == null || value.isEmpty ? '—' : value;
  // A calendar day is a day, not an instant: never shift it by time zone.
  return _date.format(value!.length <= 10 ? parsed.toUtc() : parsed.toLocal());
}

String formatDateTime(String? value) {
  final parsed = _parse(value);
  if (parsed == null) return value == null || value.isEmpty ? '—' : value;
  return _dateTime.format(parsed.toLocal());
}

String formatMoney(double amount, String currency) {
  final digits = currency == 'JPY' ? 0 : 2;
  return NumberFormat.currency(locale: 'en_US', name: currency, symbol: '$currency\u00a0', decimalDigits: digits)
      .format(amount);
}

String formatBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

String route(String origin, String destination) {
  if (origin.isEmpty && destination.isEmpty) return '—';
  // An en dash rather than an arrow: every bundled and system font has it.
  return '${origin.isEmpty ? '—' : origin} – ${destination.isEmpty ? '—' : destination}';
}

/// The number alone, for sentences that place the currency themselves.
String formatAmount(double amount, String currency) =>
    NumberFormat.currency(locale: 'en_US', name: currency, symbol: '', decimalDigits: currency == 'JPY' ? 0 : 2)
        .format(amount);

/// "27 Sept": for rows, where the year is almost always this one.
String formatShortDate(String? value) {
  final parsed = _parse(value);
  if (parsed == null) return value == null || value.isEmpty ? '—' : value;
  final day = value!.length <= 10 ? parsed.toUtc() : parsed.toLocal();
  return day.year == DateTime.now().year ? _shortDate.format(day) : _date.format(day);
}

/// "Kolkata" from "Kolkata, India": the name a row can afford.
String place(String value) => value.split(',').first.trim();

/// "India" from "Kolkata, India", or empty.
String region(String value) {
  final at = value.indexOf(',');
  return at < 0 ? '' : value.substring(at + 1).trim();
}
