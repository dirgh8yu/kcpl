import 'package:flutter/material.dart';

import '../theme.dart';

/// Search above a row of filter pills: black when chosen, grey when not.
class FilterBar<T> extends StatelessWidget {
  const FilterBar({
    super.key,
    required this.hint,
    required this.onQuery,
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  final String hint;
  final ValueChanged<String> onQuery;
  final Map<T, String> options;
  final T selected;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 12),
          child: TextField(
            onChanged: onQuery,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: hint,
              prefixIcon: Icon(KIcons.search, size: 18),
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
        SizedBox(
          height: 40,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: kGutter),
            children: [
              for (final entry in options.entries)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    // Set here: chips don't resolve a per-state label colour
                    // from the theme on every platform.
                    label: Text(entry.value, style: TextStyle(color: entry.key == selected ? context.palette.paper : context.palette.ink)),
                    selected: entry.key == selected,
                    onSelected: (_) {
                      if (entry.key == selected) return;
                      onSelected(entry.key);
                    },
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}
