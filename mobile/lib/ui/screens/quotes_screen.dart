import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/compose.dart';
import '../widgets/sheet_route.dart';
import 'quote_screen.dart';

void openQuotes(BuildContext context) => Navigator.of(context).push(SheetRoute<void>(builder: (_) => const QuotesScreen()));

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
        GroupCard(child: EmptyState(icon: KIcons.invoice, title: l.reqNoQuotesTitle, description: l.reqNoQuotesDescription))
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
        if (await Navigator.of(context).push<bool>(SheetRoute<bool>(builder: (_) => QuoteDetailScreen(quote: quote, canProceed: canProceed))) == true &&
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
            TextSpan(text: state, style: TextStyle(color: quote.bookingRequestedAt != null || quote.booked ? p.ink : null)),
          ],
        ),
      ),
      chevron: true,
    );
  }
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
  bool _busy = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _proceed() async {
    final api = AppScope.read(context).api;
    setState(() => (_busy = true, _error = null));
    final error = await attempt(context, () => api.acceptQuote(widget.quote.reference, note: _note.text.trim()));
    if (!mounted) return;
    if (error != null) {
      HapticFeedback.heavyImpact();
      setState(() => (_busy = false, _error = error));
      return;
    }
    HapticFeedback.mediumImpact();
    setState(() => _done = true);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final quote = widget.quote;
    if (_done) {
      return DoneView(title: l.quoteProceedDone, body: l.reqBookingSent(quote.reference), reference: quote.reference);
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
                    text: ' · ${quote.expired() ? l.quoteExpired(formatDate(quote.validUntil)) : l.quoteValidUntil(formatDate(quote.validUntil))}',
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
          Padding(padding: const EdgeInsets.only(top: 20), child: Notice(title: l.quoteBooked(quote.shipmentReference!), emphasis: Emphasis.normal))
        else if (quote.bookingRequestedAt != null)
          Padding(padding: const EdgeInsets.only(top: 20), child: Notice(title: l.quoteAsked, body: formatDateTime(quote.bookingRequestedAt), emphasis: Emphasis.normal))
        else if (quote.expired())
          Padding(padding: const EdgeInsets.only(top: 20), child: Notice(title: l.quoteExpiredBody))
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
          Footnote(l.quoteProceedFootnote),
        ],
      ],
    );
  }
}
