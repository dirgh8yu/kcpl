import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../labels.dart';
import '../motion.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/filter_bar.dart';
import '../widgets/rows.dart';
import '../icons.dart';

enum DocumentDirection { all, fromKcpl, sentByYou }

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  DocumentDirection _direction = DocumentDirection.all;
  String _query = '';
  int? _generation;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final generation = AppScope.of(context).generation;
    if (_generation == generation) return;
    _generation = generation;
    _direction = DocumentDirection.all;
    _query = '';
  }

  bool _matches(AppLocalizations l, DocumentRow document) {
    if (_direction == DocumentDirection.fromKcpl && document.fromCustomer) return false;
    if (_direction == DocumentDirection.sentByYou && !document.fromCustomer) return false;
    final needle = _query.trim().toLowerCase();
    if (needle.isEmpty) return true;
    return [
      document.filename,
      document.shipmentReference,
      documentTypeLabel(l, document.documentType),
    ].any((field) => field.toLowerCase().contains(needle));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return AsyncPage<DocumentsPage>(
      title: l.chromeDocuments,
      load: AppScope.of(context).api.documents,
      builder: (context, page) {
        final visible = page.documents.where((d) => _matches(l, d)).toList();
        return [
          FilterBar<DocumentDirection>(
            hint: l.docsSearchPlaceholder,
            clearLabel: l.searchClear,
            query: _query,
            onQuery: (value) => setState(() => _query = value),
            options: {
              DocumentDirection.all: l.docsAll,
              DocumentDirection.fromKcpl: l.docsFromKcpl,
              DocumentDirection.sentByYou: l.docsSentByYou,
            },
            selected: _direction,
            onSelected: (direction) => setState(() => _direction = direction),
          ),
          FilterSwap(
            filter: _direction,
            child: page.documents.isEmpty
                ? EmptyState(icon: KIcons.document, title: l.docsEmptyTitle, description: l.docsEmptyDescription)
                : visible.isEmpty
                ? EmptyState(icon: KIcons.noResults, title: l.docsEmptyFilteredTitle, description: l.shipsEmptyFilteredDescription)
                : RowGroup(children: [for (final document in visible) DocumentRowTile(document)]),
          ),
          if (page.total > page.scanned) Footnote(l.docsCoverage('${page.scanned}', '${page.total}')),
        ];
      },
    );
  }
}
