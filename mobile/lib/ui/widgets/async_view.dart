import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/kcpl_api.dart';
import '../../session_host.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../motion.dart';
import '../theme.dart';
import 'common.dart';
import 'large_title.dart';

/// A screen with a large title that collapses into the bar as it scrolls,
/// which loads one thing and renders it. Every screen gets the same
/// skeleton, failure, retry and pull-to-refresh behaviour, and reloads by
/// itself when an agent switches customer.
class AsyncPage<T> extends StatefulWidget {
  const AsyncPage({
    super.key,
    required this.title,
    required this.load,
    required this.builder,
    this.onMissing,
    this.placeholder,
    this.leading = 0,
  });

  final String title;
  final Future<T> Function() load;

  /// The page body, as plain widgets laid out top to bottom.
  final List<Widget> Function(BuildContext context, T data) builder;

  /// Shown instead of the generic failure when the server says "not found".
  final Widget Function(BuildContext context, ApiException error)? onMissing;

  /// What can be drawn before the data arrives, from something the previous
  /// screen already had. It makes the first frames real content instead of
  /// a skeleton, and gives a shared-element flight somewhere to land.
  final List<Widget> Function(BuildContext context)? placeholder;

  /// How many leading widgets the placeholder and the loaded page share.
  /// They stay put when the data lands; everything after them fades up.
  final int leading;

  @override
  State<AsyncPage<T>> createState() => _AsyncPageState<T>();
}

class _AsyncPageState<T> extends State<AsyncPage<T>> {
  T? _data;
  Object? _error;
  bool _loading = true;
  int? _generation;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final generation = SessionScope.of(context).generation;
    if (_generation != generation) {
      final first = _generation == null;
      _generation = generation;
      // A different customer: never show the previous one's data meanwhile.
      if (!first) setState(() => _data = null);
      _fetch();
    }
  }

  Future<void> _refresh() {
    HapticFeedback.mediumImpact();
    return _fetch();
  }

  /// Wraps each widget so the page arrives top to bottom. The shared lead
  /// keeps its identity across loading and loaded; the rest is keyed by
  /// state, so real content fades in over the placeholder rather than
  /// popping into its slot.
  List<Widget> _staged(List<Widget> children, {required bool loaded}) => [
    for (var i = 0; i < children.length; i++)
      i < widget.leading
          ? Reveal(key: ValueKey('lead$i'), animate: false, child: children[i])
          : Reveal(key: ValueKey('${loaded ? 'data' : 'wait'}$i'), index: i - widget.leading, child: children[i]),
  ];

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.load();
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } on SignedOutException {
      if (mounted) await SessionScope.read(context).expire();
    } on ApiException catch (error) {
      // Access withdrawn mid-session: retrying cannot help.
      if (error.code == 'denied' && mounted) {
        await SessionScope.read(context).expire();
        return;
      }
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Widget _failure(BuildContext context, Object error) {
    if (error is ApiException && error.missing && widget.onMissing != null) {
      return widget.onMissing!(context, error);
    }
    final l = AppLocalizations.of(context);
    final network =
        (error is ApiException && error.code == 'network') || (error is AuthFailure && error.kind == AuthFailureKind.network);
    final message = error is ApiException && error.message.isNotEmpty && !network && error.code != 'unavailable'
        ? error.message
        : network
        ? l.networkError
        : l.commonUnavailableDetail;
    return EmptyState(
      icon: network ? Icons.wifi_off_rounded : Icons.cloud_off_rounded,
      title: l.commonUnavailableTitle,
      description: message,
      action: OutlinedButton(onPressed: _fetch, child: Text(l.retry)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final data = _data;
    final error = _error;

    final placeholder = widget.placeholder;
    final body = <Widget>[
      if (data != null)
        SliverList(delegate: SliverChildListDelegate(_staged(widget.builder(context, data), loaded: true)))
      else if (_loading && placeholder != null)
        SliverList(delegate: SliverChildListDelegate(_staged([...placeholder(context), const Skeleton(rows: 4)], loaded: false)))
      else if (_loading)
        const SliverToBoxAdapter(child: Skeleton())
      else if (error != null)
        SliverFillRemaining(hasScrollBody: false, child: Center(child: _failure(context, error))),
      const SliverToBoxAdapter(child: SizedBox(height: 48)),
    ];

    return RefreshIndicator(
      onRefresh: _refresh,
      color: p.ink,
      backgroundColor: p.paper,
      edgeOffset: 108,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          LargeTitleBar(title: widget.title),
          ...body,
        ],
      ),
    );
  }
}
