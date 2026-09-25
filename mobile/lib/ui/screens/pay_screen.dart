import 'dart:async';

import 'package:flutter/cupertino.dart' show CupertinoSlidingSegmentedControl;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/compose.dart';
import '../widgets/kcpl_loader.dart';
import '../widgets/sheet_route.dart';

/// Opens the gateway's page. Swapped in tests; on a phone it is the system
/// browser, where the person's saved wallet logins already are.
class PaymentBrowser {
  static Future<bool> Function(Uri url) open = (url) => launchUrl(url, mode: LaunchMode.externalApplication);
}

/// True when a payment went through (paid, or received for accounts).
Future<bool> openPay(BuildContext context, Invoice invoice, PaymentOptions options) async =>
    await Navigator.of(context).push<bool>(
      SheetRoute<bool>(
        builder: (_) => PayScreen(invoice: invoice, options: options),
      ),
    ) ??
    false;

/// Paying an invoice's balance, or part of it, through Khalti, eSewa or
/// connectIPS. An invoice in another currency is paid in rupees at Nepal
/// Rastra Bank's selling rate, fixed by KCPL when the payment starts. The
/// phone never holds a merchant key or signs anything: KCPL's site hands the
/// browser to the gateway, the gateway sends it back to KCPL, and KCPL
/// confirms with the gateway before a rupee is applied. This screen only
/// waits and asks.
class PayScreen extends StatefulWidget {
  const PayScreen({super.key, required this.invoice, required this.options, this.pollEvery = const Duration(seconds: 3)});
  final Invoice invoice;
  final PaymentOptions options;
  final Duration pollEvery;

  @override
  State<PayScreen> createState() => _PayScreenState();
}

class _PayScreenState extends State<PayScreen> {
  String? _starting;

  /// Paying part of the balance, and how much of it (in the invoice's currency).
  bool _part = false;
  final _amount = TextEditingController();

  /// The gateway the current payment went to.
  String? _gateway;
  PaymentStart? _started;
  PaymentStatus? _status;
  String? _error;
  Timer? _poll;
  AppLifecycleListener? _lifecycle;

  double? get _paying {
    if (!_part) return widget.options.balance;
    final value = double.tryParse(_amount.text.replaceAll(',', '').trim());
    return value == null ? null : (value * 100).roundToDouble() / 100;
  }

  /// Why the amount can't be paid, or null when it can. Nothing is said
  /// before anything is typed.
  String? _amountProblem(AppLocalizations l) {
    if (!_part) return null;
    final paying = _paying;
    if (paying == null || paying <= 0) return _amount.text.trim().isEmpty ? '' : l.payEnterAmount;
    if (paying > widget.options.balance + 0.004) return l.payTooMuch;
    if (widget.options.npr(paying) < widget.options.minimumNpr) return l.payTooLittle(widget.options.minimumNpr);
    return null;
  }

  @override
  void dispose() {
    _amount.dispose();
    _poll?.cancel();
    _lifecycle?.dispose();
    super.dispose();
  }

  Future<void> _start(String gateway) async {
    final l = AppLocalizations.of(context);
    final api = AppScope.read(context).api;
    HapticFeedback.selectionClick();
    setState(() => (_starting = gateway, _error = null));
    PaymentStart? started;
    final amount = _part ? _paying : null;
    final error = await attempt(context, () async => started = await api.startPayment(widget.invoice.reference, gateway, amount: amount));
    if (!mounted) return;
    if (error != null || started == null) {
      HapticFeedback.heavyImpact();
      setState(() => (_starting = null, _error = error));
      return;
    }
    setState(() => (_started = started, _gateway = gateway, _starting = null));
    // Coming back from the browser is the likeliest moment it has finished.
    _lifecycle = AppLifecycleListener(onResume: _check);
    _poll = Timer.periodic(widget.pollEvery, (_) => _check());
    if (!await PaymentBrowser.open(started!.url) && mounted) setState(() => _error = l.payCouldNotOpen);
  }

  Future<void> _check() async {
    final started = _started;
    if (started == null || (_status?.settled ?? false)) return;
    try {
      final status = await AppScope.read(context).api.payment(started.intent);
      if (!mounted) return;
      if (status.settled) {
        _poll?.cancel();
        status.failed ? HapticFeedback.heavyImpact() : HapticFeedback.mediumImpact();
      }
      setState(() => _status = status);
    } on SignedOutException {
      _poll?.cancel();
      if (mounted) await AppScope.read(context).expire();
    } catch (_) {
      // A missed check on a weak signal is simply tried again.
    }
  }

  void _again() {
    _poll?.cancel();
    _lifecycle?.dispose();
    _lifecycle = null;
    setState(() => (_started = null, _status = null, _error = null));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final invoice = widget.invoice;
    final options = widget.options;
    final paying = _paying;
    final problem = _amountProblem(l);
    final ready = paying != null && problem == null;
    // What leaves the customer's wallet: always rupees.
    final rupees = formatMoney(options.npr(ready ? paying : options.balance), 'NPR');
    final status = _status;

    if (status != null && (status.paid || status.review)) {
      return DoneView(
        title: status.paid ? l.payPaid : l.payReview,
        body: status.paid
            ? l.payPaidBody(formatMoney(status.amount, 'NPR'), invoice.reference)
            : status.message ?? l.payReviewBody(invoice.reference),
        reference: invoice.reference,
      );
    }

    final Widget body;
    if (_started != null && !(status?.failed ?? false)) {
      body = _Waiting(
        key: const ValueKey('waiting'),
        gateway: paymentGatewayNames[_gateway] ?? '',
        onReopen: () => PaymentBrowser.open(_started!.url),
      );
    } else {
      body = Column(
        key: const ValueKey('choose'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (status?.failed ?? false)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Notice(title: l.payFailed, body: status!.message ?? l.payFailedBody),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: kGutter),
            child: SizedBox(
              width: double.infinity,
              child: CupertinoSlidingSegmentedControl<bool>(
                groupValue: _part,
                onValueChanged: (value) {
                  if (value == null || _starting != null) return;
                  HapticFeedback.selectionClick();
                  setState(() => _part = value);
                },
                children: {
                  false: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Text(l.payWhole, overflow: TextOverflow.ellipsis),
                  ),
                  true: Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: Text(l.payPart)),
                },
              ),
            ),
          ),
          if (_part) ...[
            const SizedBox(height: 12),
            GroupCard(
              padding: EdgeInsets.zero,
              child: TextField(
                controller: _amount,
                autofocus: true,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                onChanged: (_) => setState(() {}),
                style: context.type.titleMedium,
                decoration: cardField(l.payAmount(options.currency))
                    .copyWith(labelText: l.payAmount(options.currency), hintText: formatAmount(options.balance, options.currency)),
              ),
            ),
            if (problem != null && problem.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(kGutter + 4, 8, kGutter, 0),
                child: Semantics(
                  liveRegion: true,
                  child: Text(problem, style: context.type.bodyMedium?.copyWith(color: context.palette.accent)),
                ),
              ),
          ],
          if (options.foreign) ...[
            const SizedBox(height: 16),
            Notice(
              emphasis: Emphasis.normal,
              title: l.payInRupees(rupees),
              body: l.payRate(options.currency, options.rate.toStringAsFixed(2), formatDate(options.rateDate)),
            ),
          ],
          SectionHeader(l.payChoose(rupees), top: 20),
          RowGroup(
            children: [
              for (final gateway in options.gateways)
                RowTile(
                  onTap: _starting == null && ready ? () => _start(gateway) : null,
                  leading: _GatewayMark(gateway),
                  title: Text(paymentGatewayNames[gateway] ?? gateway),
                  trailing: _starting == gateway ? const KcplLoader(size: 20) : null,
                  chevron: _starting != gateway,
                ),
            ],
          ),
          Footnote(_part ? '${l.payFootnote} ${l.payPartFootnote}' : l.payFootnote),
        ],
      );
    }

    return ComposeScaffold(
      title: l.payOnline,
      error: _error,
      // Choosing needs no footer: each gateway row is the action.
      action: _started != null && !(status?.failed ?? false) ? TextButton(onPressed: _again, child: Text(l.cancel)) : null,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter + 4, 0, kGutter, 16),
          child: Text(
            '${invoice.reference} · ${l.payOwed(formatMoney(options.balance, options.currency))}',
            style: context.type.bodyMedium?.copyWith(color: context.palette.secondary),
          ),
        ),
        AnimatedSwitcher(
          duration: Motion.reduced(context) ? Duration.zero : Motion.swap,
          switchInCurve: Motion.easeOut,
          switchOutCurve: Motion.easeOut,
          child: body,
        ),
      ],
    );
  }
}

class _Waiting extends StatelessWidget {
  const _Waiting({super.key, required this.gateway, required this.onReopen});
  final String gateway;
  final VoidCallback onReopen;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GroupCard(
          padding: const EdgeInsets.fromLTRB(kGutter, 20, kGutter, 20),
          child: Column(
            children: [
              const KcplLoader(size: 44),
              const SizedBox(height: 16),
              Text(l.payWaiting, style: context.type.titleMedium, textAlign: TextAlign.center),
              const SizedBox(height: 6),
              Text(
                l.payWaitingBody,
                style: context.type.bodyMedium?.copyWith(color: p.secondary),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        RowGroup(
          children: [
            RowTile(
              onTap: onReopen,
              title: Text(l.payOpenAgain, style: TextStyle(color: p.accent)),
              subtitle: gateway.isEmpty ? null : Text(gateway),
            ),
          ],
        ),
      ],
    );
  }
}

/// Each gateway's colour, as people recognise them at a till: a plain
/// lettered disc rather than a logo the app has no licence to draw.
class _GatewayMark extends StatelessWidget {
  const _GatewayMark(this.gateway);
  final String gateway;

  static const _colours = {'khalti': Color(0xFF5C2D91), 'esewa': Color(0xFF60BB46), 'connectips': Color(0xFF1C4E9D)};

  @override
  Widget build(BuildContext context) {
    final name = paymentGatewayNames[gateway] ?? gateway;
    return ExcludeSemantics(
      child: Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: _colours[gateway] ?? context.palette.fill, borderRadius: BorderRadius.circular(8)),
        child: Text(
          name.substring(0, 1).toUpperCase(),
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
    );
  }
}
