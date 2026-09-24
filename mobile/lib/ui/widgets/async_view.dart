import 'package:flutter/material.dart';

import '../../api/kcpl_api.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
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
  });

  final String title;
  final Future<T> Function() load;

  /// The page body, as plain widgets laid out top to bottom.
  final List<Widget> Function(BuildContext context, T data) builder;

  /// Shown instead of the generic failure when the server says "not found".
  final Widget Function(BuildContext context, ApiException error)? onMissing;

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
    final generation = AppScope.of(context).generation;
    if (_generation != generation) {
      final first = _generation == null;
      _generation = generation;
      // A different customer: never show the previous one's data meanwhile.
      if (!first) setState(() => _data = null);
      _fetch();
    }
  }

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
      if (mounted) await AppScope.read(context).expire();
    } on ApiException catch (error) {
      // Access withdrawn mid-session: retrying cannot help.
      if (error.code == 'denied' && mounted) {
        await AppScope.read(context).expire();
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
    final network = (error is ApiException && error.code == 'network') ||
        (error is AuthFailure && error.kind == AuthFailureKind.network);
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

    final body = <Widget>[
      if (data != null)
        SliverList(delegate: SliverChildListDelegate(widget.builder(context, data)))
      else if (_loading)
        const SliverToBoxAdapter(child: Skeleton())
      else if (error != null)
        SliverFillRemaining(hasScrollBody: false, child: Center(child: _failure(context, error))),
      const SliverToBoxAdapter(child: SizedBox(height: 48)),
    ];

    return RefreshIndicator(
      onRefresh: _fetch,
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
