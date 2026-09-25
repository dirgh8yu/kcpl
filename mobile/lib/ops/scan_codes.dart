/// Which pieces of scanned text could be a job's identifier, most likely
/// first. Text read from a photo of a container door or a document is mostly
/// noise ("MAX GROSS", weights, dates); these are the few worth a tap.
library;

const _letterValues = {
  'A': 10, 'B': 12, 'C': 13, 'D': 14, 'E': 15, 'F': 16, 'G': 17, 'H': 18, 'I': 19, 'J': 20, 'K': 21, 'L': 23, 'M': 24, //
  'N': 25, 'O': 26, 'P': 27, 'Q': 28, 'R': 29, 'S': 30, 'T': 31, 'U': 32, 'V': 34, 'W': 35, 'X': 36, 'Y': 37, 'Z': 38,
};

/// "MSCU 123456 7" as "MSCU1234567": letters and digits only, upper case.
String compact(String value) => value.toUpperCase().replaceAll(RegExp('[^A-Z0-9]'), '');

/// An ISO 6346 container number whose check digit agrees: four letters
/// (the fourth U, J or Z), six digits, and the check digit. The check is
/// what separates a real number from a misread one.
bool isContainerNumber(String value) {
  final code = compact(value);
  if (!RegExp(r'^[A-Z]{3}[UJZ]\d{7}$').hasMatch(code)) return false;
  var sum = 0;
  for (var i = 0; i < 10; i++) {
    final char = code[i];
    final digit = int.tryParse(char) ?? _letterValues[char]!;
    sum += digit << i;
  }
  return sum % 11 % 10 == int.parse(code[10]);
}

final _container = RegExp(r'[A-Z]{3}[UJZ][\s-]?\d{6}[\s-]?\d');
final _kcpl = RegExp(r'KCPL[-\s]?[A-Z0-9]{1,6}(?:[-\s][A-Z0-9]{1,8}){1,3}');
final _awb = RegExp(r'\b\d{3}[-\s]?\d{8}\b');
final _token = RegExp(r'[A-Z0-9][A-Z0-9/\-]{5,}');

/// Candidates from lines of recognised text: container numbers that pass
/// their check digit, then KCPL references, then air waybills, then other
/// long codes that mix letters and digits. At most [limit].
List<String> scanCandidates(Iterable<String> lines, {int limit = 6}) {
  final containers = <String>[];
  final references = <String>[];
  final waybills = <String>[];
  final others = <String>[];
  for (final raw in lines) {
    final line = raw.toUpperCase();
    for (final match in _container.allMatches(line)) {
      final code = compact(match.group(0)!);
      if (isContainerNumber(code)) containers.add(code);
    }
    for (final match in _kcpl.allMatches(line)) {
      references.add(match.group(0)!.replaceAll(' ', '-'));
    }
    for (final match in _awb.allMatches(line)) {
      final digits = compact(match.group(0)!);
      waybills.add('${digits.substring(0, 3)}-${digits.substring(3)}');
    }
    for (final match in _token.allMatches(line)) {
      final token = match.group(0)!;
      final code = compact(token);
      if (code.length >= 6 && RegExp('[A-Z]').hasMatch(code) && RegExp(r'\d').hasMatch(code)) others.add(token);
    }
  }
  final seen = <String>{};
  return [
    for (final candidate in [...containers, ...references, ...waybills, ...others])
      if (seen.add(compact(candidate))) candidate,
  ].take(limit).toList();
}
