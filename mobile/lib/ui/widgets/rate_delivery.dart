import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../motion.dart';
import '../screens/pay_screen.dart' show PaymentBrowser;
import '../theme.dart';
import 'common.dart';
import 'compose.dart';

/// "How did this delivery go?", asked once after delivery. One tap on a star
/// is the answer; a comment is offered, never required. A low score goes to
/// the team that handled it; a happy customer may be pointed to a review.
class RateDeliveryCard extends StatefulWidget {
  const RateDeliveryCard({super.key, required this.reference});
  final String reference;

  @override
  State<RateDeliveryCard> createState() => _RateDeliveryCardState();
}

class _RateDeliveryCardState extends State<RateDeliveryCard> {
  final _comment = TextEditingController();
  int _score = 0;
  bool _sending = false;
  String? _error;
  RatingReceipt? _receipt;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final api = AppScope.read(context).api;
    setState(() {
      _sending = true;
      _error = null;
    });
    RatingReceipt? receipt;
    final error = await attempt(context, () async {
      receipt = await api.rateDelivery(widget.reference, _score, comment: _comment.text.trim());
    });
    if (!mounted) return;
    if (receipt != null) HapticFeedback.lightImpact();
    setState(() {
      _sending = false;
      _error = error;
      _receipt = receipt;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final receipt = _receipt;
    final child = receipt != null
        ? Column(
            key: const ValueKey('thanks'),
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l.rateThanks, style: context.type.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(receipt.message, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
              if (receipt.reviewUrl case final url?) ...[
                const SizedBox(height: 12),
                OutlinedButton(onPressed: () => PaymentBrowser.open(url), child: Text(l.rateReview)),
              ],
            ],
          )
        : Column(
            key: const ValueKey('ask'),
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l.rateTitle, style: context.type.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(l.rateHint, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var score = 1; score <= 5; score++)
                    Semantics(
                      selected: score == _score,
                      inMutuallyExclusiveGroup: true,
                      child: IconButton(
                        tooltip: l.rateScore(score),
                        iconSize: 32,
                        onPressed: _sending
                            ? null
                            : () {
                                HapticFeedback.selectionClick();
                                setState(() => _score = score);
                              },
                        icon: Icon(score <= _score ? KIcons.starOn : KIcons.star, color: score <= _score ? p.accent : p.tertiary),
                      ),
                    ),
                ],
              ),
              if (_score > 0) ...[
                const SizedBox(height: 4),
                DecoratedBox(
                  decoration: BoxDecoration(color: p.paper, borderRadius: BorderRadius.circular(10)),
                  child: TextField(
                    controller: _comment,
                    enabled: !_sending,
                    minLines: 1,
                    maxLines: 4,
                    maxLength: 1000,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: cardField(l.rateComment).copyWith(counterText: '', isDense: true, contentPadding: const EdgeInsets.all(12)),
                  ),
                ),
                const SizedBox(height: 10),
                ErrorLine(_error),
                SendButton(label: l.rateSend, busy: _sending, onPressed: _send),
              ],
            ],
          );
    // The card grows to the comment box and settles on the thanks; under
    // Reduce Motion the new state simply takes its place.
    return GroupCard(
      padding: const EdgeInsets.fromLTRB(kGutter, 14, kGutter, 14),
      child: Motion.reduced(context)
          ? child
          : AnimatedSize(
              duration: Motion.reveal,
              curve: Motion.easeOut,
              alignment: Alignment.topCenter,
              child: AnimatedSwitcher(duration: Motion.swap, child: child),
            ),
    );
  }
}
