import '../api/models.dart';

/// Rough sums a customer can do on the phone. Neither is a charge: the
/// carrier's invoice decides storage, and customs decides duty.

/// Days beyond free time if the cargo is collected [inDays] from today, and
/// what they would cost at the rate KCPL recorded. Null cost when no rate is
/// on the record.
({int days, double? cost}) storageEstimate(FreeTime freeTime, int inDays) {
  final status = freeTime.status;
  final over = status.state == 'expired' ? status.daysOverdue + inDays : inDays - status.daysRemaining;
  final days = over < 0 ? 0 : over;
  final rate = freeTime.dailyCharge;
  return (days: days, cost: rate == null ? null : rate * days);
}

/// Nepal's order of charges at import: customs duty on the CIF value,
/// excise on value plus duty, and VAT at 13% on all three.
class DutyEstimate {
  const DutyEstimate({required this.cif, required this.dutyRate, required this.exciseRate});

  static const vatRate = 0.13;

  /// The duty bands most goods fall in; the HS code decides which.
  static const dutyRates = [0.0, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.80];
  static const exciseRates = [0.0, 0.05, 0.10, 0.15, 0.30, 0.60];

  final double cif;
  final double dutyRate;
  final double exciseRate;

  double get duty => cif * dutyRate;
  double get excise => (cif + duty) * exciseRate;
  double get vat => (cif + duty + excise) * vatRate;

  /// What is paid at customs (the goods' own value is not in it).
  double get total => duty + excise + vat;
}
