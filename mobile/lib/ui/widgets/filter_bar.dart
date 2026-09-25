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
        // The search field iOS puts under a large title.
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 12),
          child: SizedBox(
            height: 36,
            child: TextField(
              onChanged: onQuery,
              textInputAction: TextInputAction.search,
              style: context.type.bodyLarge,
              decoration: InputDecoration(
                hintText: hint,
                prefixIcon: Padding(
                  padding: const EdgeInsetsDirectional.only(start: 8, end: 4),
                  child: Icon(KIcons.search, size: 18, color: context.palette.secondary),
                ),
                prefixIconConstraints: const BoxConstraints(minWidth: 30, minHeight: 36),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 8),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
          ),
        ),
        SizedBox(
          height: 34,
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
                    label: Text(
                      entry.value,
                      style: TextStyle(color: entry.key == selected ? context.palette.surface : context.palette.ink),
                    ),
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
        const SizedBox(height: 14),
      ],
    );
  }
}
