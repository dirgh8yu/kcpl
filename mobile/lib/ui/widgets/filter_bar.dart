import 'package:flutter/material.dart';

import '../theme.dart';

/// Search above a row of filter pills: black when chosen, grey when not.
class FilterBar<T> extends StatefulWidget {
  const FilterBar({
    super.key,
    required this.hint,
    required this.clearLabel,
    required this.query,
    required this.onQuery,
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  final String hint;
  final String clearLabel;
  final String query;
  final ValueChanged<String> onQuery;
  final Map<T, String> options;
  final T selected;
  final ValueChanged<T> onSelected;

  @override
  State<FilterBar<T>> createState() => _FilterBarState<T>();
}

class _FilterBarState<T> extends State<FilterBar<T>> {
  late final TextEditingController _query;

  @override
  void initState() {
    super.initState();
    _query = TextEditingController(text: widget.query);
  }

  @override
  void didUpdateWidget(FilterBar<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_query.text != widget.query) {
      _query.value = TextEditingValue(
        text: widget.query,
        selection: TextSelection.collapsed(offset: widget.query.length),
      );
    }
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _clear() {
    _query.clear();
    setState(() {});
    widget.onQuery('');
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // The search field iOS puts under a large title.
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 12),
          child: SizedBox(
            height: 48,
            child: TextField(
              controller: _query,
              onChanged: (value) {
                setState(() {});
                widget.onQuery(value);
              },
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => FocusScope.of(context).unfocus(),
              style: context.type.bodyLarge,
              decoration: InputDecoration(
                hintText: widget.hint,
                prefixIcon: Padding(
                  padding: const EdgeInsetsDirectional.only(start: 8, end: 4),
                  child: Icon(KIcons.search, size: 18, color: context.palette.secondary),
                ),
                prefixIconConstraints: const BoxConstraints(minWidth: 30, minHeight: 48),
                suffixIcon: _query.text.isEmpty
                    ? null
                    : IconButton(tooltip: widget.clearLabel, onPressed: _clear, icon: const Icon(KIcons.clear, size: 18)),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
          ),
        ),
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: kGutter),
            children: [
              for (final entry in widget.options.entries)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    // Set here: chips don't resolve a per-state label colour
                    // from the theme on every platform.
                    label: Text(
                      entry.value,
                      style: TextStyle(color: entry.key == widget.selected ? context.palette.surface : context.palette.ink),
                    ),
                    selected: entry.key == widget.selected,
                    onSelected: (_) {
                      if (entry.key == widget.selected) return;
                      widget.onSelected(entry.key);
                    },
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
      ],
    );
  }
}
