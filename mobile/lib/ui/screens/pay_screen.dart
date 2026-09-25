import 'dart:async';

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
Future<bool> openPay(BuildContext context, Invoice invoice, List<String> gateways) async =>
    await Navigator.of(context).push<bool>(SheetRoute<bool>(builder: (_) => PayScreen(invoice: invoice, gateways: gateways))) ?? false;

/// Paying an invoice's balance through Khalti, eSewa or connectIPS. The
/// phone never holds a merchant key or signs anything: KCPL's site hands the
/// browser to the gateway, the gateway sends it back to KCPL, and KCPL
/// confirms with the gateway before a rupee is applied. This screen only
/// waits and asks.
class PayScreen extends StatefulWidget {
  const PayScreen({super.key, required this.invoice, required this.gateways, this.pollEvery = const Duration(seconds: 3)});
  final Invoice invoice;
  final List<String> gateways;
  final Duration pollEvery;

  @override
  State<PayScreen> createState() => _PayScreenState();
}

class _PayScreenState extends State<PayScreen> {
  String? _starting;

  /// The gateway the current payment went to.
  String? _gateway;
  PaymentStart? _started;
  PaymentStatus? _status;
  String? _error;
  Timer? _poll;
  AppLifecycleListener? _lifecycle;

  @override
  void dispose() {
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
    final error = await attempt(context, () async => started = await api.startPayment(widget.invoice.reference, gateway));
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
    final amount = formatMoney(invoice.balanceDue, invoice.currency);
    final status = _status;

    if (status != null && (status.paid || status.review)) {
      return DoneView(
        title: status.paid ? l.payPaid : l.payReview,
        body: status.paid
            ? l.payPaidBody(formatMoney(status.amount, invoice.currency), invoice.reference)
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
          SectionHeader(l.payChoose(amount), top: 4),
          RowGroup(
            children: [
              for (final gateway in widget.gateways)
                RowTile(
                  onTap: _starting == null ? () => _start(gateway) : null,
                  leading: _GatewayMark(gateway),
                  title: Text(paymentGatewayNames[gateway] ?? gateway),
                  trailing: _starting == gateway ? const KcplLoader(size: 20) : null,
                  chevron: _starting != gateway,
                ),
            ],
          ),
          Footnote(l.payFootnote),
        ],
      );
    }

    return ComposeScaffold(
      title: l.payOnline,
      error: _error,
      action: _started != null && !(status?.failed ?? false)
          ? TextButton(onPressed: _again, child: Text(l.cancel))
          : FilledButton(onPressed: () => Navigator.of(context).maybePop(), child: Text(l.cancel)),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter + 4, 0, kGutter, 16),
          child: Text(invoice.reference, style: context.type.bodyMedium?.copyWith(color: context.palette.secondary)),
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
              Text(l.payWaitingBody, style: context.type.bodyMedium?.copyWith(color: p.secondary), textAlign: TextAlign.center),
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
