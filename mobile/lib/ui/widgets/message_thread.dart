import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../motion.dart';
import '../theme.dart';
import 'async_view.dart';
import 'common.dart';
import 'compose.dart';
import 'large_title.dart';
import 'sheet_route.dart';

/// Opens a shipment's conversation with KCPL. The customer app and KCPL Ops
/// share it; each says which side is "mine" and brings its own words for an
/// empty thread.
Future<void> openMessageThread(
  BuildContext context, {
  required String reference,
  required Future<List<ShipmentMessage>> Function() load,
  required Future<ShipmentMessage> Function(String body) send,
  required bool Function(ShipmentMessage message) mine,
  required String emptyBody,
  String? footnote,
}) => Navigator.of(context).push(
  SheetRoute<void>(
    builder: (_) => MessageThreadScreen(reference: reference, load: load, send: send, mine: mine, emptyBody: emptyBody, footnote: footnote),
  ),
);

class MessageThreadScreen extends StatelessWidget {
  const MessageThreadScreen({
    super.key,
    required this.reference,
    required this.load,
    required this.send,
    required this.mine,
    required this.emptyBody,
    this.footnote,
    this.pollEvery = const Duration(seconds: 30),
  });

  final String reference;
  final Future<List<ShipmentMessage>> Function() load;
  final Future<ShipmentMessage> Function(String body) send;
  final bool Function(ShipmentMessage message) mine;
  final String emptyBody;
  final String? footnote;

  /// How often an open thread looks for a reply.
  final Duration pollEvery;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AsyncPage<List<ShipmentMessage>>.custom(
        load: load,
        layout: (context, messages, failure, refresh) => _Thread(
          reference: reference,
          messages: messages,
          failure: failure,
          refresh: refresh,
          send: send,
          mine: mine,
          emptyBody: emptyBody,
          footnote: footnote,
          pollEvery: pollEvery,
        ),
      ),
    );
  }
}

class _Thread extends StatefulWidget {
  const _Thread({
    required this.reference,
    required this.messages,
    required this.failure,
    required this.refresh,
    required this.send,
    required this.mine,
    required this.emptyBody,
    required this.footnote,
    required this.pollEvery,
  });

  final String reference;
  final List<ShipmentMessage>? messages;
  final Widget? failure;
  final Future<void> Function() refresh;
  final Future<ShipmentMessage> Function(String body) send;
  final bool Function(ShipmentMessage message) mine;
  final String emptyBody;
  final String? footnote;
  final Duration pollEvery;

  @override
  State<_Thread> createState() => _ThreadState();
}

class _ThreadState extends State<_Thread> {
  final _text = TextEditingController();
  final _scroll = ScrollController();

  /// Sent from here and not yet in a fresh read.
  final List<ShipmentMessage> _sent = [];
  bool _sending = false;
  String? _error;
  Timer? _poll;
  int _shown = 0;

  @override
  void initState() {
    super.initState();
    _poll = Timer.periodic(widget.pollEvery, (_) => widget.refresh());
    _text.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _poll?.cancel();
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  List<ShipmentMessage> get _all {
    final read = widget.messages ?? const [];
    final ids = {for (final m in read) m.id};
    return [...read, ..._sent.where((m) => !ids.contains(m.id))];
  }

  /// Keeps the newest in view when something arrives, as a chat does.
  void _toEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      final end = _scroll.position.maxScrollExtent;
      if (Motion.reduced(context) || (end - _scroll.offset).abs() > 1200) {
        _scroll.jumpTo(end);
      } else {
        _scroll.animateTo(end, duration: Motion.reveal, curve: Motion.easeOut);
      }
    });
  }

  Future<void> _send() async {
    final body = _text.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    final error = await attempt(context, () async {
      final message = await widget.send(body);
      _sent.add(message);
    });
    if (!mounted) return;
    if (error == null) {
      HapticFeedback.lightImpact();
      _text.clear();
    }
    setState(() {
      _sending = false;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final all = _all;
    if (all.length != _shown) {
      _shown = all.length;
      _toEnd();
    }
    final loading = widget.messages == null && widget.failure == null;
    return Column(
      children: [
        Expanded(
          child: CustomScrollView(
            controller: _scroll,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            slivers: [
              LargeTitleBar(title: l.msgTitle),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
                  child: Text(widget.reference, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
                ),
              ),
              if (widget.failure case final failure?)
                SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.only(top: 24), child: failure))
              else if (loading)
                const SliverToBoxAdapter(child: Skeleton(rows: 3))
              else if (all.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: EmptyState(icon: KIcons.message, title: l.msgEmpty, description: widget.emptyBody),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(kGutter, 16, kGutter, 8),
                  sliver: SliverList.builder(
                    itemCount: all.length,
                    itemBuilder: (context, index) {
                      final message = all[index];
                      final previous = index == 0 ? null : all[index - 1];
                      // The name once per run of messages from one person.
                      final first = previous == null || previous.author != message.author || widget.mine(previous) != widget.mine(message);
                      return _Bubble(message: message, mine: widget.mine(message), first: first);
                    },
                  ),
                ),
              if (widget.footnote case final footnote?) SliverToBoxAdapter(child: Footnote(footnote)),
            ],
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            color: p.paper,
            border: Border(top: BorderSide(color: p.hairline, width: 0.33)),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 8, 8, 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ErrorLine(_error),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: DecoratedBox(
                          decoration: BoxDecoration(color: p.surface, borderRadius: BorderRadius.circular(20)),
                          child: TextField(
                            controller: _text,
                            minLines: 1,
                            maxLines: 5,
                            maxLength: 2000,
                            enabled: !_sending,
                            textCapitalization: TextCapitalization.sentences,
                            decoration: cardField(l.msgPlaceholder).copyWith(
                              counterText: '',
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      _sending
                          ? const Padding(padding: EdgeInsets.all(12), child: SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2)))
                          : IconButton(
                              tooltip: l.msgSend,
                              onPressed: _text.text.trim().isEmpty ? null : _send,
                              icon: Icon(KIcons.send, color: _text.text.trim().isEmpty ? p.tertiary : p.accent),
                            ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.mine, required this.first});
  final ShipmentMessage message;
  final bool mine;
  final bool first;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final when = message.createdAt.isEmpty ? '' : formatDateTime(message.createdAt);
    final author = mine ? l.msgYou : message.author;
    return Semantics(
      container: true,
      label: [author, message.body, when].where((s) => s.isNotEmpty).join('. '),
      excludeSemantics: true,
      child: Padding(
        padding: EdgeInsets.only(top: first ? 12 : 3),
        child: Column(
          crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (first)
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 4),
                child: Text(
                  [author, if (when.isNotEmpty) when].join(' · '),
                  style: context.type.bodySmall?.copyWith(color: p.secondary),
                ),
              ),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
              child: DecoratedBox(
                decoration: BoxDecoration(color: mine ? p.accent : p.surface, borderRadius: BorderRadius.circular(18)),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  child: SelectableText(
                    message.body,
                    style: context.type.bodyLarge?.copyWith(color: mine ? Colors.white : p.ink),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
