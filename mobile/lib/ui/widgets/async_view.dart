import 'package:flutter/material.dart';

import '../../api/kcpl_api.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import 'common.dart';

/// Loads one thing and renders it, with the same loading, failure, retry and
/// pull-to-refresh behaviour on every screen. Reloads by itself when the
/// agent switches customer.
class AsyncView<T> extends StatefulWidget {
  const AsyncView({super.key, required this.load, required this.builder, this.onMissing});

  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data) builder;

  /// Shown instead of the generic failure when the server says "not found".
  final Widget Function(BuildContext context, ApiException error)? onMissing;

  @override
  State<AsyncView<T>> createState() => _AsyncViewState<T>();
}

class _AsyncViewState<T> extends State<AsyncView<T>> {
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
      if (first) {
        _fetch();
      } else {
        // A different customer: never show the previous one's data meanwhile.
        setState(() => _data = null);
        _fetch();
      }
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
      // Access withdrawn mid-session: the login itself is no longer valid
      // for the portal, so retrying cannot help.
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

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final error = _error;
    if (data != null) {
      return RefreshIndicator(onRefresh: _fetch, child: widget.builder(context, data));
    }
    if (_loading) return const Center(child: CircularProgressIndicator(strokeWidth: 2.5));

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
    return ListView(
      children: [
        EmptyState(
          icon: network ? Icons.wifi_off_rounded : Icons.cloud_off_rounded,
          title: l.commonUnavailableTitle,
          description: message,
          action: OutlinedButton(onPressed: _fetch, child: Text(l.retry)),
        ),
      ],
    );
  }
}
