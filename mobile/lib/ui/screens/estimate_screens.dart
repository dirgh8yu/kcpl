import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../l10n/app_localizations.dart';
import '../estimates.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/compose.dart';
import '../widgets/sheet_route.dart';

Future<void> openStorageEstimate(BuildContext context, FreeTime freeTime) =>
    Navigator.of(context).push(SheetRoute<void>(builder: (_) => StorageEstimateScreen(freeTime: freeTime)));

Future<void> openDutyEstimate(BuildContext context) => Navigator.of(context).push(SheetRoute<void>(builder: (_) => const DutyEstimateScreen()));

/// "What will storage cost if we collect on Thursday?": days past free time
/// at the daily rate KCPL recorded.
class StorageEstimateScreen extends StatefulWidget {
  const StorageEstimateScreen({super.key, required this.freeTime});
  final FreeTime freeTime;

  @override
  State<StorageEstimateScreen> createState() => _StorageEstimateScreenState();
}

class _StorageEstimateScreenState extends State<StorageEstimateScreen> {
  int _inDays = 0;

  void _step(int by) {
    final next = (_inDays + by).clamp(0, 90);
    if (next == _inDays) return;
    HapticFeedback.selectionClick();
    setState(() => _inDays = next);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final freeTime = widget.freeTime;
    final estimate = storageEstimate(freeTime, _inDays);
    final currency = freeTime.chargeCurrency;
    final rate = freeTime.dailyCharge;
    final cost = estimate.cost;
    return ComposeScaffold(
      title: l.estStorageTitle,
      children: [
        if (freeTime.location != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
            child: Text(freeTime.location!, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
          ),
        const SizedBox(height: 16),
        GroupCard(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
          child: Row(
            children: [
              IconButton(
                tooltip: l.estSooner,
                onPressed: _inDays == 0 ? null : () => _step(-1),
                icon: const Icon(Icons.remove_rounded),
              ),
              Expanded(
                child: Semantics(
                  liveRegion: true,
                  child: Text(l.estCollect(_inDays), textAlign: TextAlign.center, style: context.type.titleMedium),
                ),
              ),
              IconButton(tooltip: l.estLater, onPressed: () => _step(1), icon: const Icon(Icons.add_rounded)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        RowGroup(
          children: [
            DetailRow(l.freeTimeDeadline, formatDate(freeTime.status.deadline)),
            DetailRow(
              l.estCharge,
              cost == null || currency == null ? '—' : formatMoney(cost, currency),
              strong: true,
              emphasis: estimate.days > 0 ? Emphasis.attention : Emphasis.normal,
            ),
            DetailRow(l.estDaysOver(estimate.days), rate == null || currency == null ? '—' : l.estPerDay(formatMoney(rate, currency))),
          ],
        ),
        Footnote(rate == null ? l.estNoRate : l.estStorageFoot),
      ],
    );
  }
}

/// A rough idea of what customs will ask for: the customer picks the bands
/// their goods fall in; KCPL confirms the real ones from the HS code.
class DutyEstimateScreen extends StatefulWidget {
  const DutyEstimateScreen({super.key});

  @override
  State<DutyEstimateScreen> createState() => _DutyEstimateScreenState();
}

class _DutyEstimateScreenState extends State<DutyEstimateScreen> {
  final _cif = TextEditingController();
  double _duty = 0.10;
  double _excise = 0;

  @override
  void dispose() {
    _cif.dispose();
    super.dispose();
  }

  String _percent(double rate) => '${(rate * 100).round()}%';

  Widget _rates(List<double> rates, double selected, ValueChanged<double> onSelected, {String? zero}) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: kGutter),
    child: Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final rate in rates)
          ChoiceChip(
            label: Text(rate == 0 && zero != null ? zero : _percent(rate)),
            selected: rate == selected,
            showCheckmark: false,
            onSelected: (_) {
              HapticFeedback.selectionClick();
              onSelected(rate);
            },
          ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cif = double.tryParse(_cif.text.replaceAll(',', '').trim()) ?? 0;
    final estimate = DutyEstimate(cif: cif, dutyRate: _duty, exciseRate: _excise);
    String npr(double value) => formatMoney(value, 'NPR');
    return ComposeScaffold(
      title: l.estDutyTitle,
      children: [
        GroupCard(
          padding: EdgeInsets.zero,
          child: TextField(
            controller: _cif,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
            onChanged: (_) => setState(() {}),
            style: context.type.titleMedium,
            decoration: cardField(l.estCif).copyWith(labelText: l.estCif, hintText: '0'),
          ),
        ),
        SectionHeader(l.estDutyRate, top: 20),
        _rates(DutyEstimate.dutyRates, _duty, (rate) => setState(() => _duty = rate)),
        SectionHeader(l.estExcise, top: 20),
        _rates(DutyEstimate.exciseRates, _excise, (rate) => setState(() => _excise = rate), zero: l.estNone),
        const SizedBox(height: 24),
        Semantics(
          liveRegion: true,
          child: RowGroup(
            children: [
              DetailRow(l.estLineDuty, npr(estimate.duty)),
              DetailRow(l.estLineExcise, npr(estimate.excise)),
              DetailRow(l.estLineVat, npr(estimate.vat)),
              DetailRow(l.estTotal, npr(estimate.total), strong: true),
            ],
          ),
        ),
        Footnote(l.estDutyFoot),
      ],
    );
  }
}
