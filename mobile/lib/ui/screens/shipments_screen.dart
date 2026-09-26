import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../motion.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/filter_bar.dart';
import '../widgets/rows.dart';
import '../icons.dart';

enum ShipmentFocus { all, active, inTransit, attention, delivered }

/// Same buckets as the web portal (portal-shipments-workspace.tsx).
bool matchesFocus(Shipment shipment, ShipmentFocus focus) => switch (focus) {
  ShipmentFocus.all => true,
  ShipmentFocus.active => !shipment.delivered,
  ShipmentFocus.inTransit => shipment.status == 'in_transit',
  ShipmentFocus.attention => shipment.status == 'exception',
  ShipmentFocus.delivered => shipment.delivered,
};

bool matchesQuery(Shipment shipment, String query) {
  final needle = query.trim().toLowerCase();
  if (needle.isEmpty) return true;
  return [
    shipment.reference,
    shipment.origin,
    shipment.destination,
    shipment.carrier ?? '',
    shipment.carrierReference ?? '',
  ].any((field) => field.toLowerCase().contains(needle));
}

class ShipmentsScreen extends StatefulWidget {
  const ShipmentsScreen({super.key});

  @override
  State<ShipmentsScreen> createState() => _ShipmentsScreenState();
}

class _ShipmentsScreenState extends State<ShipmentsScreen> {
  ShipmentFocus _focus = ShipmentFocus.all;
  String _query = '';
  int? _generation;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final generation = AppScope.of(context).generation;
    if (_generation == generation) return;
    _generation = generation;
    _focus = ShipmentFocus.all;
    _query = '';
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return AsyncPage<List<Shipment>>(
      title: l.chromeShipments,
      load: AppScope.of(context).api.shipments,
      builder: (context, shipments) {
        final visible = shipments.where((s) => matchesFocus(s, _focus) && matchesQuery(s, _query)).toList();
        return [
          FilterBar<ShipmentFocus>(
            hint: l.shipsSearchPlaceholder,
            clearLabel: l.searchClear,
            query: _query,
            onQuery: (value) => setState(() => _query = value),
            options: {
              ShipmentFocus.all: l.shipsFocusAll,
              ShipmentFocus.active: l.shipsFocusActive,
              ShipmentFocus.inTransit: l.shipsFocusInTransit,
              ShipmentFocus.attention: l.shipsFocusAttention,
              ShipmentFocus.delivered: l.shipsFocusDelivered,
            },
            selected: _focus,
            onSelected: (focus) => setState(() => _focus = focus),
          ),
          FilterSwap(
            filter: _focus,
            child: shipments.isEmpty
                ? EmptyState(icon: KIcons.shipments, title: l.shipsEmptyTitle, description: l.shipsEmptyDescription)
                : visible.isEmpty
                ? EmptyState(icon: KIcons.noResults, title: l.shipsEmptyFilteredTitle, description: l.shipsEmptyFilteredDescription)
                : RowGroup(children: [for (final shipment in visible) ShipmentRow(shipment)]),
          ),
        ];
      },
    );
  }
}
