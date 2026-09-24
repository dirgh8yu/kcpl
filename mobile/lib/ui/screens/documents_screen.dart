import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../labels.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/tiles.dart';

enum DocumentDirection { all, fromKcpl, sentByYou }

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  DocumentDirection _direction = DocumentDirection.all;
  String _query = '';

  bool _matches(AppLocalizations l, DocumentRow document) {
    if (_direction == DocumentDirection.fromKcpl && document.fromCustomer) return false;
    if (_direction == DocumentDirection.sentByYou && !document.fromCustomer) return false;
    final needle = _query.trim().toLowerCase();
    if (needle.isEmpty) return true;
    return [document.filename, document.shipmentReference, documentTypeLabel(l, document.documentType)]
        .any((field) => field.toLowerCase().contains(needle));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final labels = {
      DocumentDirection.all: l.docsAll,
      DocumentDirection.fromKcpl: l.docsFromKcpl,
      DocumentDirection.sentByYou: l.docsSentByYou,
    };

    return AsyncView<DocumentsPage>(
      load: AppScope.of(context).api.documents,
      builder: (context, page) {
        final visible = page.documents.where((d) => _matches(l, d)).toList();
        return ListView(
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: TextField(
                decoration: InputDecoration(hintText: l.docsSearchPlaceholder, prefixIcon: const Icon(Icons.search_rounded), isDense: true),
                onChanged: (value) => setState(() => _query = value),
              ),
            ),
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                children: [
                  for (final direction in DocumentDirection.values)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(labels[direction]!),
                        selected: _direction == direction,
                        onSelected: (_) => setState(() => _direction = direction),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            if (page.documents.isEmpty)
              EmptyState(icon: Icons.description_outlined, title: l.docsEmptyTitle, description: l.docsEmptyDescription)
            else if (visible.isEmpty)
              EmptyState(icon: Icons.filter_alt_off_outlined, title: l.docsEmptyFilteredTitle, description: l.shipsEmptyFilteredDescription)
            else
              Panel(children: [for (final document in visible) DocumentTile(document)]),
            if (page.total > page.scanned)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Text(
                  l.docsCoverage('${page.scanned}', '${page.total}'),
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
              ),
          ],
        );
      },
    );
  }
}
