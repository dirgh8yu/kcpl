import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:nepali_utils/nepali_utils.dart' show ENepaliDateTime, Language, NepaliDateFormat, NepaliDateTime;

// Dates and amounts are records, so they read the same in either language,
// exactly as the web portal formats them (app/portal/portal-format.ts).

/// Loads the en-GB date symbols. Must complete before the first date is
/// formatted: Flutter only loads symbols for the UI locale, and a Nepali UI
/// would otherwise throw on the first shipment date.
Future<void> initFormatting() => initializeDateFormatting('en_GB');

final _date = DateFormat('d MMM yyyy', 'en_GB');
final _shortDate = DateFormat('d MMM', 'en_GB');
final _dateTime = DateFormat('d MMM yyyy, HH:mm', 'en_GB');
final _clock = DateFormat('HH:mm', 'en_GB');

/// Which calendar dates are shown in. Bikram Sambat is Nepal's own; the
/// record underneath is the same instant either way.
enum DateCalendar { gregorian, bikramSambat }

/// Set from the person's choice in Account. Read by every date formatter.
DateCalendar dateCalendar = DateCalendar.gregorian;

bool get _bs => dateCalendar == DateCalendar.bikramSambat;

// Month names in English letters, as dates are records that read the same
// in either language. "BS" marks a full date so it is never taken for AD.
// A new formatter each time: nepali_utils' NepaliDateFormat keeps the first
// date it formats and returns it again for every later one.
String _bsFormat(String pattern, NepaliDateTime date) => NepaliDateFormat(pattern, Language.english).format(date);

/// A calendar day in BS: the day itself, never shifted by time zone.
String _bsDay(DateTime utcDay, {bool short = false}) {
  final nepali = DateTime.utc(utcDay.year, utcDay.month, utcDay.day, 12).toNepaliDateTime();
  return short ? _bsFormat('d MMMM', nepali) : '${_bsFormat('d MMMM yyyy', nepali)} BS';
}

/// "10:42", in the phone's own time zone.
String formatClock(DateTime value) => _clock.format(value.toLocal());

DateTime? _parse(String? value) {
  if (value == null || value.isEmpty) return null;
  return DateTime.tryParse(value.length <= 10 ? '${value}T00:00:00Z' : value);
}

String formatDate(String? value) {
  final parsed = _parse(value);
  if (parsed == null) return value == null || value.isEmpty ? '—' : value;
  // A calendar day is a day, not an instant: never shift it by time zone.
  final day = value!.length <= 10 ? parsed.toUtc() : parsed.toLocal();
  if (_bs) return _bsDay(DateTime.utc(day.year, day.month, day.day));
  return _date.format(day);
}

String formatDateTime(String? value) {
  final parsed = _parse(value);
  if (parsed == null) return value == null || value.isEmpty ? '—' : value;
  // In BS the time is Nepal's, as the calendar is.
  if (_bs) return '${_bsFormat('d MMMM yyyy, HH:mm', parsed.toUtc().toNepaliDateTime())} BS';
  return _dateTime.format(parsed.toLocal());
}

String formatMoney(double amount, String currency) {
  final digits = currency == 'JPY' ? 0 : 2;
  return NumberFormat.currency(locale: 'en_US', name: currency, symbol: '$currency\u00a0', decimalDigits: digits).format(amount);
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
    NumberFormat.currency(locale: 'en_US', name: currency, symbol: '', decimalDigits: currency == 'JPY' ? 0 : 2).format(amount);

/// "27 Sept": for rows, where the year is almost always this one.
String formatShortDate(String? value) {
  final parsed = _parse(value);
  if (parsed == null) return value == null || value.isEmpty ? '—' : value;
  final day = value!.length <= 10 ? parsed.toUtc() : parsed.toLocal();
  if (_bs) {
    final utcDay = DateTime.utc(day.year, day.month, day.day);
    final thisYear = DateTime.now().toUtc().toNepaliDateTime().year == DateTime.utc(day.year, day.month, day.day, 12).toNepaliDateTime().year;
    return _bsDay(utcDay, short: thisYear);
  }
  return day.year == DateTime.now().year ? _shortDate.format(day) : _date.format(day);
}

/// "Kolkata" from "Kolkata, India": the name a row can afford.
String place(String value) => value.split(',').first.trim();

/// "India" from "Kolkata, India", or empty.
String region(String value) {
  final at = value.indexOf(',');
  return at < 0 ? '' : value.substring(at + 1).trim();
}
