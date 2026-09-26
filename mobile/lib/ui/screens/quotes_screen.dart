import 'package:flutter/cupertino.dart' show CupertinoDatePicker, CupertinoDatePickerMode, CupertinoSlidingSegmentedControl, showCupertinoModalPopup;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/compose.dart';
import '../widgets/sheet_route.dart';
import '../widgets/split_view.dart';
import 'quote_screen.dart';

/// Beside the settings on a tablet; as a sheet otherwise.
void openQuotes(BuildContext context) {
  if (SplitView.select(context, 'quotes')) return;
  Navigator.of(context).push(SheetRoute<void>(builder: (_) => const QuotesScreen()));
}

/// Prices KCPL has given, and requests it is still pricing. A price can be
/// accepted from here: that asks the account manager to book it, exactly as
/// "Ask to proceed" does on the web.
class QuotesScreen extends StatelessWidget {
  const QuotesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = AppScope.of(context).api;
    return Scaffold(
      body: AsyncPage<QuotesPage>(title: l.quotesTitle, load: api.quotes, builder: (context, page) => _body(context, page)),
    );
  }

  List<Widget> _body(BuildContext context, QuotesPage page) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final canRequest = AppScope.of(context).session?.canSubmitRequests ?? false;
    return [
      if (canRequest)
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            RowTile(
              onTap: () => openQuote(context),
              leading: Icon(KIcons.add, size: 22, color: p.accent),
              title: Text(l.quotesNew, style: TextStyle(color: p.accent)),
            ),
          ],
        ),
      SectionHeader(l.reqQuotesTitle, top: canRequest ? 28 : 8),
      if (page.quotes.isEmpty)
        GroupCard(
          child: EmptyState(icon: KIcons.invoice, title: l.reqNoQuotesTitle, description: l.reqNoQuotesDescription),
        )
      else ...[
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [for (final quote in page.quotes) _QuoteRow(quote: quote, canProceed: canRequest)],
        ),
        Footnote(l.reqQuotesDescription),
      ],
      SectionHeader(l.reqProgressTitle),
      if (page.requests.isEmpty)
        Footnote(l.reqNothingWaitingDescription)
      else
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            for (final request in page.requests)
              RowTile(
                leading: Icon(modeIcon(request.mode), size: 20, color: p.secondary),
                title: Text(route(place(request.origin), place(request.destination))),
                subtitle: Text([request.reference, if (request.cargoType != null) request.cargoType!].join(' · ')),
                accessory: Text(formatShortDate(request.createdAt)),
              ),
          ],
        ),
    ];
  }
}

IconData modeIcon(String mode) => switch (mode) {
  'air' => KIcons.air,
  'sea' => KIcons.sea,
  'road' => KIcons.road,
  _ => KIcons.courier,
};

class _QuoteRow extends StatelessWidget {
  const _QuoteRow({required this.quote, required this.canProceed});
  final PortalQuote quote;
  final bool canProceed;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final expired = quote.expired();
    final String state;
    if (quote.booked) {
      state = l.quoteBooked(quote.shipmentReference!);
    } else if (quote.bookingRequestedAt != null) {
      state = l.quoteAsked;
    } else if (quote.validUntil != null) {
      state = expired ? l.quoteExpired(formatDate(quote.validUntil)) : l.quoteValidUntil(formatDate(quote.validUntil));
    } else {
      state = quote.reference;
    }
    return RowTile(
      onTap: () async {
        if (await Navigator.of(context).push<bool>(
                  SheetRoute<bool>(
                    builder: (_) => QuoteDetailScreen(quote: quote, canProceed: canProceed),
                  ),
                ) ==
                true &&
            context.mounted) {
          await AsyncPage.reload(context);
        }
      },
      leading: Icon(modeIcon(quote.mode), size: 20, color: p.secondary),
      title: Text(route(place(quote.origin), place(quote.destination))),
      // The price leads the second line, so the route keeps the first.
      subtitle: Text.rich(
        TextSpan(
          children: [
            if (quote.amount != null)
              TextSpan(
                text: '${formatMoney(quote.amount!, quote.currency)} · ',
                style: TextStyle(color: expired ? p.tertiary : p.ink, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            TextSpan(
              text: state,
              style: TextStyle(color: quote.bookingRequestedAt != null || quote.booked ? p.ink : null),
            ),
          ],
        ),
      ),
      chevron: true,
    );
  }
}

/// Grows to fit what it holds, from the top, without a jump; at once when
/// motion is reduced.
class _Expand extends StatelessWidget {
  const _Expand({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Motion.reduced(context)
      ? child
      : AnimatedSize(duration: Motion.reveal, curve: Motion.easeOut, alignment: Alignment.topCenter, child: child);
}

/// One price in full, and the way to accept it.
class QuoteDetailScreen extends StatefulWidget {
  const QuoteDetailScreen({super.key, required this.quote, required this.canProceed});
  final PortalQuote quote;
  final bool canProceed;

  @override
  State<QuoteDetailScreen> createState() => _QuoteDetailScreenState();
}

class _QuoteDetailScreenState extends State<QuoteDetailScreen> {
  final _note = TextEditingController();
  final _address = TextEditingController();
  final _contactName = TextEditingController();
  final _contactPhone = TextEditingController();
  bool _busy = false;
  bool _done = false;
  String? _error;

  /// KCPL collects the cargo: when and where. A request the pickup desk
  /// schedules once the booking is confirmed (docs/pickup-scheduling.md).
  bool _pickup = false;
  late DateTime _date = _today.add(const Duration(days: 1));
  String _window = 'any';

  /// The server refuses a date in the past or more than 90 days out.
  static const _maxDays = 90;
  DateTime get _today {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  String get _day => _date.toIso8601String().substring(0, 10);

  @override
  void dispose() {
    _note.dispose();
    _address.dispose();
    _contactName.dispose();
    _contactPhone.dispose();
    super.dispose();
  }

  void _togglePickup(bool on) {
    HapticFeedback.selectionClick();
    setState(() => (_pickup = on, _error = null));
  }

  Future<void> _pickDate() async {
    final p = context.palette;
    var chosen = _date;
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (sheet) => Container(
        height: 280,
        color: p.raised.surface,
        child: SafeArea(
          top: false,
          child: CupertinoDatePicker(
            mode: CupertinoDatePickerMode.date,
            initialDateTime: _date,
            minimumDate: _today,
            maximumDate: _today.add(const Duration(days: _maxDays)),
            onDateTimeChanged: (value) => chosen = DateTime(value.year, value.month, value.day),
          ),
        ),
      ),
    );
    if (mounted) setState(() => _date = chosen);
  }

  Future<void> _proceed() async {
    final l = AppLocalizations.of(context);
    final api = AppScope.read(context).api;
    FocusScope.of(context).unfocus();
    if (_pickup && _address.text.trim().length < 5) {
      HapticFeedback.heavyImpact();
      setState(() => _error = l.pickupNeedAddress);
      return;
    }
    final pickup = _pickup
        ? PickupRequest(date: _day, window: _window, address: _address.text, contactName: _contactName.text, contactPhone: _contactPhone.text)
        : null;
    setState(() => (_busy = true, _error = null));
    final error = await attempt(context, () => api.acceptQuote(widget.quote.reference, note: _note.text.trim(), pickup: pickup));
    if (!mounted) return;
    if (error != null) {
      HapticFeedback.heavyImpact();
      setState(() => (_busy = false, _error = error));
      return;
    }
    HapticFeedback.mediumImpact();
    setState(() => _done = true);
  }

  Widget _pickupForm(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final windows = {'morning': l.pickupMorning, 'afternoon': l.pickupAfternoon, 'any': l.pickupAnyTime};
    TextField field(TextEditingController controller, String hint, {TextInputType? type, int lines = 1}) => TextField(
      controller: controller,
      enabled: !_busy,
      minLines: lines,
      maxLines: lines == 1 ? 1 : 4,
      keyboardType: type,
      textCapitalization: type == null ? TextCapitalization.words : TextCapitalization.none,
      style: context.type.bodyLarge,
      decoration: cardField(hint),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        RowGroup(
          children: [
            RowTile(
              onTap: _busy ? null : _pickDate,
              title: Text(l.pickupDate),
              trailing: Text(formatDate(_day), style: context.type.bodyLarge?.copyWith(color: p.accent)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 10),
              child: Semantics(
                label: l.pickupWindow,
                child: CupertinoSlidingSegmentedControl<String>(
                  groupValue: _window,
                  onValueChanged: _busy
                      ? (_) {}
                      : (value) {
                          if (value == null) return;
                          HapticFeedback.selectionClick();
                          setState(() => _window = value);
                        },
                  children: {
                    for (final entry in windows.entries)
                      entry.key: Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: Text(entry.value)),
                  },
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        RowGroup(
          children: [
            field(_address, l.pickupAddress, type: TextInputType.streetAddress, lines: 2),
            field(_contactName, l.pickupContactName),
            field(_contactPhone, l.pickupContactPhone, type: TextInputType.phone),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final quote = widget.quote;
    if (_done) {
      return DoneView(
        title: l.quoteProceedDone,
        body: [l.reqBookingSent(quote.reference), if (_pickup) l.pickupAsked(formatDate(_day))].join('\n\n'),
        reference: quote.reference,
      );
    }
    final open = widget.canProceed && quote.canProceed();
    return ComposeScaffold(
      title: l.reqColQuote,
      error: _error,
      action: open ? SendButton(label: l.reqAskToProceed, onPressed: _proceed, busy: _busy) : null,
      children: [
        if (quote.amount != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(kGutter + 4, 4, kGutter, 0),
            child: Text(
              formatMoney(quote.amount!, quote.currency),
              style: context.type.displaySmall?.copyWith(
                fontFeatures: const [FontFeature.tabularFigures()],
                color: quote.expired() ? p.tertiary : p.ink,
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter + 4, 2, kGutter, 0),
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(text: quote.reference),
                if (quote.validUntil != null)
                  TextSpan(
                    text:
                        ' · ${quote.expired() ? l.quoteExpired(formatDate(quote.validUntil)) : l.quoteValidUntil(formatDate(quote.validUntil))}',
                    style: TextStyle(color: quote.expired() ? p.accent : null),
                  ),
              ],
            ),
            style: context.type.bodyMedium?.copyWith(color: p.secondary),
          ),
        ),
        const SizedBox(height: 20),
        RowGroup(
          children: [
            DetailRow(l.commonRoute, route(quote.origin, quote.destination)),
            DetailRow(l.shipMode, modeLabel(l, quote.mode)),
            if (quote.cargoType != null) DetailRow(l.quoteCargo, quote.cargoType!),
            if (quote.weight != null) DetailRow(l.quoteWeight, quote.weight!),
            DetailRow(l.reqColValid, quote.validUntil == null ? '—' : formatDate(quote.validUntil)),
          ],
        ),
        if (quote.note != null) ...[
          const SizedBox(height: 20),
          GroupCard(
            padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 12),
            child: Text(quote.note!, style: context.type.bodyLarge),
          ),
        ],
        if (quote.booked)
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: Notice(title: l.quoteBooked(quote.shipmentReference!), emphasis: Emphasis.normal),
          )
        else if (quote.bookingRequestedAt != null)
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: Notice(title: l.quoteAsked, body: formatDateTime(quote.bookingRequestedAt), emphasis: Emphasis.normal),
          )
        else if (quote.expired())
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: Notice(title: l.quoteExpiredBody),
          )
        else if (open) ...[
          const SizedBox(height: 20),
          GroupCard(
            child: TextField(
              controller: _note,
              enabled: !_busy,
              minLines: 2,
              maxLines: 5,
              textCapitalization: TextCapitalization.sentences,
              style: context.type.bodyLarge,
              decoration: cardField(l.quoteProceedNote),
            ),
          ),
          SectionHeader(l.pickupTitle),
          RowGroup(
            children: [
              // The whole row is the switch, as in Settings.
              MergeSemantics(
                child: RowTile(
                  onTap: _busy ? null : () => _togglePickup(!_pickup),
                  title: Text(l.pickupAsk),
                  subtitle: Text(l.pickupAskBody),
                  trailing: Switch.adaptive(value: _pickup, activeTrackColor: p.ink, onChanged: _busy ? null : _togglePickup),
                ),
              ),
            ],
          ),
          _Expand(child: _pickup ? _pickupForm(context) : const SizedBox(width: double.infinity)),
          Footnote(_pickup ? l.pickupFootnote : l.quoteProceedFootnote),
        ],
      ],
    );
  }
}
