import 'dart:async';

import 'package:clock/clock.dart';
import 'package:flutter/material.dart';

import '../../api/kcpl_api.dart';
import '../../session_host.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../motion.dart';
import '../theme.dart';
import 'common.dart';
import 'k_refresh.dart';
import 'large_title.dart';
import 'sheet_route.dart';

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

/// How often a page on screen refreshes itself: the web register's interval.
const autoRefreshEvery = Duration(seconds: 60);

/// Coming back to a page refreshes it unless it loaded more recently than
/// this, so a quick glance away and back does not refetch.
const refreshOnReturnAfter = Duration(seconds: 5);

class _AsyncPageState<T> extends State<AsyncPage<T>> with WidgetsBindingObserver {
  T? _data;
  Object? _error;
  bool _loading = true;
  int? _generation;

  /// Stays current while it is on screen and the app is open: every minute,
  /// and again on coming back to it. Hidden tabs, covered pages and a
  /// backgrounded app make no requests.
  Timer? _timer;
  bool? _visible;
  bool _foreground = true;
  DateTime? _loadedAt;

  /// Only the newest request may land, so a slow reply for the previous
  /// customer can never overwrite the current one.
  int _request = 0;
  bool _inFlight = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _foreground =
        WidgetsBinding.instance.lifecycleState != AppLifecycleState.paused &&
        WidgetsBinding.instance.lifecycleState != AppLifecycleState.hidden;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

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
    // Hidden tabs and fully covered pages have their tickers turned off; a
    // page under a sheet stays drawn, so it also counts as covered while its
    // route is not the current one.
    final visible = TickerMode.valuesOf(context).enabled && (ModalRoute.of(context)?.isCurrent ?? true);
    if (visible != _visible) {
      final returning = _visible != null;
      _visible = visible;
      if (visible && returning) _refreshIfStale();
      _schedule();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    if (foreground == _foreground) return;
    _foreground = foreground;
    if (foreground && _visible == true) _refreshIfStale();
    _schedule();
  }

  void _schedule() {
    _timer?.cancel();
    _timer = null;
    if (_visible != true || !_foreground) return;
    _timer = Timer.periodic(autoRefreshEvery, (_) => _quietRefresh());
  }

  void _refreshIfStale() {
    final loadedAt = _loadedAt;
    if (loadedAt == null || clock.now().difference(loadedAt) >= refreshOnReturnAfter) _quietRefresh();
  }

  /// A refresh nobody asked for: the page stays as it is and simply updates
  /// in place when the answer arrives. A failure keeps what is shown.
  void _quietRefresh() {
    if (_inFlight || _data == null || !mounted) return;
    _fetch(quiet: true);
  }

  // The pull itself gives the haptic (KRefresh), once.
  Future<void> _refresh() => _fetch();

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

  Future<void> _fetch({bool quiet = false}) async {
    final request = ++_request;
    _inFlight = true;
    if (!quiet) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final data = await widget.load();
      if (!mounted || request != _request) return;
      _loadedAt = clock.now();
      setState(() {
        _data = data;
        _error = null;
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
      if (!mounted || request != _request || quiet) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _request || quiet) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    } finally {
      if (request == _request) _inFlight = false;
    }
  }

  Widget _failure(BuildContext context, Object error) {
    if (error is ApiException && error.missing && widget.onMissing != null) {
      return widget.onMissing!(context, error);
    }
    final l = AppLocalizations.of(context);
    final network = (error is ApiException && error.code == 'network') || (error is AuthFailure && error.kind == AuthFailureKind.network);
    final message = error is ApiException && error.message.isNotEmpty && !network && error.code != 'unavailable'
        ? error.message
        : network
        ? l.networkError
        : l.commonUnavailableDetail;
    return EmptyState(
      icon: network ? KIcons.offline : KIcons.unreachable,
      title: l.commonUnavailableTitle,
      description: message,
      action: OutlinedButton(onPressed: _fetch, child: Text(l.retry)),
    );
  }

  @override
  Widget build(BuildContext context) {
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
      // Clear of the frosted tab bar, which the page scrolls beneath.
      SliverToBoxAdapter(child: SizedBox(height: 48 + MediaQuery.paddingOf(context).bottom)),
    ];

    final scroll = CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        LargeTitleBar(title: widget.title),
        ...body,
      ],
    );
    // In a sheet, pulling down closes it; the page still refreshes itself.
    if (SheetRoute.of(context)) return scroll;
    return KRefresh(onRefresh: _refresh, edgeOffset: MediaQuery.paddingOf(context).top + 98, child: scroll);
  }
}
