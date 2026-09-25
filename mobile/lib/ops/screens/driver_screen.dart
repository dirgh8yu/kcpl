import 'package:flutter/cupertino.dart' show CupertinoSlidingSegmentedControl;
import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../auth/auth_repository.dart';
import '../../ui/format.dart';
import '../../ui/motion.dart';
import '../../ui/theme.dart';
import '../../ui/widgets/async_view.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/sheet_route.dart';
import '../ops_controller.dart';
import '../ops_models.dart';
import '../route_order.dart';
import 'delivery_screen.dart';
import 'job_detail_screen.dart';

void openDriver(BuildContext context) => Navigator.of(context).push(SheetRoute<void>(builder: (_) => const DriverScreen()));

/// Opens turn-by-turn directions to [address]. Swapped in tests.
class DriverMaps {
  static Future<bool> Function(String address) open = _open;

  static Uri directions(String address, {TargetPlatform? platform}) => (platform ?? defaultTargetPlatform) == TargetPlatform.iOS
      ? Uri.https('maps.apple.com', '/', {'daddr': address, 'dirflg': 'd'})
      : Uri.https('www.google.com', '/maps/dir/', {'api': '1', 'destination': address, 'travelmode': 'driving'});

  static Future<bool> _open(String address) => launchUrl(directions(address), mode: LaunchMode.externalApplication);
}

/// Driver mode: today's stops and nothing else. The driver's own first, in
/// the order they choose (a drag, kept for the day), each with directions
/// and the delivery screen one tap away.
class DriverScreen extends StatelessWidget {
  const DriverScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = OpsScope.of(context).api;
    return Scaffold(
      body: AsyncPage<DriverDay>(
        title: 'Today’s deliveries',
        load: api.deliveries,
        builder: (context, day) => [_Route(day: day)],
      ),
    );
  }
}

class _Route extends StatefulWidget {
  const _Route({required this.day});
  final DriverDay day;

  @override
  State<_Route> createState() => _RouteState();
}

class _RouteState extends State<_Route> {
  bool _mineOnly = true;
  List<String> _order = const [];

  @override
  void initState() {
    super.initState();
    // With nothing of their own today, a driver sees everyone's.
    _mineOnly = widget.day.deliveries.any((d) => d.mine);
    OpsScope.read(context).routes.load(widget.day.day).then((order) {
      if (mounted) setState(() => _order = order);
    });
  }

  List<DriverDelivery> get _stops {
    final shown = widget.day.deliveries.where((d) => !_mineOnly || d.mine).toList();
    return RouteOrderStore.apply(shown, _order, (d) => d.reference);
  }

  void _reorder(int from, int to) {
    HapticFeedback.selectionClick();
    final stops = [..._stops];
    // onReorderItem gives the index after removal.
    final moved = stops.removeAt(from);
    stops.insert(to, moved);
    // Stops hidden by the filter keep their place after the shown ones.
    final rest = _order.where((ref) => !stops.any((s) => s.reference == ref));
    final order = [...stops.map((s) => s.reference), ...rest];
    setState(() => _order = order);
    OpsScope.read(context).routes.save(widget.day.day, order);
  }

  Future<void> _navigate(DriverDelivery stop) async {
    final messenger = ScaffoldMessenger.of(context);
    if (!await DriverMaps.open(stop.address)) {
      messenger.showSnackBar(const SnackBar(content: Text('Maps could not be opened on this phone.')));
    }
  }

  Future<void> _record(DriverDelivery stop) async {
    final controller = OpsScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final control = await controller.api.delivery(stop.reference);
      if (!mounted) return;
      if (await openDelivery(context, stop.reference, control) && mounted) await AsyncPage.reload(context);
    } on SignedOutException {
      await controller.expire();
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('The delivery could not be opened. Try again.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final all = widget.day.deliveries;
    final mine = all.where((d) => d.mine).length;
    final stops = _stops;
    final queue = OpsScope.of(context).deliveries;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 0),
          child: SizedBox(
            width: double.infinity,
            child: CupertinoSlidingSegmentedControl<bool>(
              groupValue: _mineOnly,
              onValueChanged: (value) {
                if (value == null) return;
                HapticFeedback.selectionClick();
                setState(() => _mineOnly = value);
              },
              children: {
                true: Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text('Mine · $mine')),
                false: Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text('All · ${all.length}')),
              },
            ),
          ),
        ),
        if (stops.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 24),
            child: EmptyState(
              icon: KIcons.truck,
              title: _mineOnly ? 'No deliveries for you today' : 'No deliveries today',
              description: 'Deliveries under way or due out today in your branches appear here.',
            ),
          )
        else ...[
          if (stops.first.address.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 16, kGutter, 0),
              child: Pressable(
                child: FilledButton.icon(
                  onPressed: () => _navigate(stops.first),
                  style: FilledButton.styleFrom(backgroundColor: p.accent, foregroundColor: Colors.white),
                  icon: const Icon(KIcons.location, size: 18),
                  label: Text('Directions to ${stops.first.customerName.isEmpty ? stops.first.reference : stops.first.customerName}', overflow: TextOverflow.ellipsis),
                ),
              ),
            ),
          const SectionHeader('Route', top: 20),
          ReorderableListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            buildDefaultDragHandles: false,
            padding: const EdgeInsets.symmetric(horizontal: kGutter),
            itemCount: stops.length,
            onReorderItem: _reorder,
            proxyDecorator: (child, index, animation) => Material(color: Colors.transparent, elevation: 6, borderRadius: BorderRadius.circular(kCardRadius), child: child),
            itemBuilder: (context, index) {
              final stop = stops[index];
              return Padding(
                key: ValueKey(stop.reference),
                padding: const EdgeInsets.only(bottom: 10),
                child: _Stop(
                  index: index,
                  stop: stop,
                  waiting: queue.waitingFor(stop.reference) != null,
                  onNavigate: () => _navigate(stop),
                  onRecord: () => _record(stop),
                  onOpen: () => Navigator.of(context).push(SheetRoute<void>(builder: (_) => JobDetailScreen(reference: stop.reference))),
                ),
              );
            },
          ),
          const Footnote('Hold the handle and drag to put stops in the order you will drive them. The order is kept for today.'),
        ],
      ],
    );
  }
}

class _Stop extends StatelessWidget {
  const _Stop({required this.index, required this.stop, required this.waiting, required this.onNavigate, required this.onRecord, required this.onOpen});
  final int index;
  final DriverDelivery stop;
  final bool waiting;
  final VoidCallback onNavigate;
  final VoidCallback onRecord;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final when = stop.scheduledFor == null ? null : formatClock(DateTime.parse(stop.scheduledFor!));
    final state = waiting
        ? 'Recorded · waiting for signal'
        : stop.underway
        ? 'Out for delivery${stop.attemptNumber > 1 ? ' · attempt ${stop.attemptNumber}' : ''}'
        : 'Ready to go';
    return DecoratedBox(
      decoration: BoxDecoration(color: p.surface, borderRadius: BorderRadius.circular(kCardRadius)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: stop.underway ? p.accent : p.ink, shape: BoxShape.circle),
                  child: Text(
                    '${index + 1}',
                    style: TextStyle(color: p.surface, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Semantics(
                    button: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: onOpen,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(stop.customerName.isEmpty ? stop.reference : stop.customerName, style: context.type.titleMedium),
                          const SizedBox(height: 2),
                          Text(stop.address, style: context.type.bodyMedium),
                          const SizedBox(height: 2),
                          Text(
                            [stop.reference, ?when, state].join(' · '),
                            style: context.type.bodySmall?.copyWith(color: waiting || stop.underway ? p.accent : p.secondary),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                ReorderableDragStartListener(
                  index: index,
                  child: Semantics(
                    label: 'Reorder ${stop.reference}',
                    child: Padding(padding: const EdgeInsets.all(10), child: Icon(Icons.drag_handle_rounded, color: p.tertiary)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.only(left: 40, right: 8),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: stop.address.isEmpty ? null : onNavigate,
                      icon: const Icon(KIcons.location, size: 16),
                      label: const Text('Directions'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: waiting ? null : onRecord,
                      icon: const Icon(KIcons.delivery, size: 16),
                      label: Text(stop.underway ? 'Record' : 'Start'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
