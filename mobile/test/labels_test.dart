import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/api/models.dart';
import 'package:kcpl_customer/l10n/app_localizations.dart';
import 'package:kcpl_customer/ui/format.dart';
import 'package:kcpl_customer/ui/labels.dart';

FreeTimeStatus status(String state, {int remaining = 0, int overdue = 0}) =>
    FreeTimeStatus(state: state, daysRemaining: remaining, daysOverdue: overdue);

void main() {
  setUpAll(initFormatting);
  final en = lookupAppLocalizations(const Locale('en'));
  final ne = lookupAppLocalizations(const Locale('ne'));

  test('free time reads as the web portal words it', () {
    expect(freeTimeSummary(en, 'Birgunj ICD', status('running', remaining: 3)), '3 free days left at Birgunj ICD.');
    expect(freeTimeSummary(en, null, status('running', remaining: 1)), '1 free day left.');
    expect(freeTimeSummary(en, 'Birgunj ICD', status('last_day')), 'Today is the last free day at Birgunj ICD.');
    expect(freeTimeSummary(en, null, status('expired', overdue: 1)), 'Free time ended yesterday. Charges may now apply.');
    expect(freeTimeSummary(en, 'Kolkata', status('expired', overdue: 4)), 'Free time at Kolkata ended 4 days ago. Charges may now apply.');
    expect(freeTimeSummary(en, null, status('not_set')), 'No free-time allowance recorded.');
  });

  test('Nepali puts the place where Nepali puts it', () {
    final text = freeTimeSummary(ne, 'Kolkata', status('expired', overdue: 4));
    expect(text, contains('Kolkata'));
    expect(text, contains('4'));
    expect(text, isNot(contains('{')));
  });

  test('every status, mode and document type has a real label in both languages', () {
    for (final l in [en, ne]) {
      for (final value in [
        'booking_confirmed',
        'preparing',
        'in_transit',
        'customs_clearance',
        'out_for_delivery',
        'delivered',
        'exception',
      ]) {
        expect(statusLabel(l, value), isNot(statusLabel(l, 'never-seen')), reason: value);
      }
      expect(modeLabel(l, 'ocean'), modeLabel(l, 'sea'));
      expect(documentTypeLabel(l, 'bill_of_lading'), isNot(documentTypeLabel(l, 'never-seen')));
    }
    expect(statusLabel(ne, 'delivered'), isNot(statusLabel(en, 'delivered')));
  });

  test('records are formatted the same whatever the language', () {
    expect(formatDate('2026-09-24'), '24 Sept 2026');
    expect(formatMoney(210180, 'NPR'), 'NPR 210,180.00');
    expect(formatAmount(45, 'USD'), '45.00');
    expect(formatDate(null), '—');
    expect(formatBytes(284211), '278 KB');
  });
}
