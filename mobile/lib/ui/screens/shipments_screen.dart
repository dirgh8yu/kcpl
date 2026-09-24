import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/tiles.dart';

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
  return [shipment.reference, shipment.origin, shipment.destination, shipment.carrier ?? '', shipment.carrierReference ?? '']
      .any((field) => field.toLowerCase().contains(needle));
}

class ShipmentsScreen extends StatefulWidget {
  const ShipmentsScreen({super.key});

  @override
  State<ShipmentsScreen> createState() => _ShipmentsScreenState();
}

class _ShipmentsScreenState extends State<ShipmentsScreen> {
  ShipmentFocus _focus = ShipmentFocus.all;
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final labels = {
      ShipmentFocus.all: l.shipsFocusAll,
      ShipmentFocus.active: l.shipsFocusActive,
      ShipmentFocus.inTransit: l.shipsFocusInTransit,
      ShipmentFocus.attention: l.shipsFocusAttention,
      ShipmentFocus.delivered: l.shipsFocusDelivered,
    };

    return AsyncView<List<Shipment>>(
      load: AppScope.of(context).api.shipments,
      builder: (context, shipments) {
        final visible = shipments.where((s) => matchesFocus(s, _focus) && matchesQuery(s, _query)).toList();
        return ListView(
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: TextField(
                decoration: InputDecoration(
                  hintText: l.shipsSearchPlaceholder,
                  prefixIcon: const Icon(Icons.search_rounded),
                  isDense: true,
                ),
                onChanged: (value) => setState(() => _query = value),
              ),
            ),
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                children: [
                  for (final focus in ShipmentFocus.values)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(labels[focus]!),
                        selected: _focus == focus,
                        onSelected: (_) => setState(() => _focus = focus),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            if (shipments.isEmpty)
              EmptyState(icon: Icons.inventory_2_outlined, title: l.shipsEmptyTitle, description: l.shipsEmptyDescription)
            else if (visible.isEmpty)
              EmptyState(
                icon: Icons.filter_alt_off_outlined,
                title: l.shipsEmptyFilteredTitle,
                description: l.shipsEmptyFilteredDescription,
              )
            else
              Panel(children: [for (final shipment in visible) ShipmentTile(shipment)]),
          ],
        );
      },
    );
  }
}
