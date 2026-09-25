import 'package:flutter_test/flutter_test.dart';
import 'package:kcpl_customer/ops/scan_codes.dart';

void main() {
  test('a container number is checked by its check digit', () {
    expect(isContainerNumber('CSQU3054383'), isTrue, reason: 'the ISO 6346 worked example');
    expect(isContainerNumber('CSQU 305438 3'), isTrue);
    expect(isContainerNumber('CSQU3054384'), isFalse, reason: 'a misread digit fails the check');
    expect(isContainerNumber('CSQA3054383'), isFalse, reason: 'the fourth letter is U, J or Z');
    expect(isContainerNumber('KCPL-2609-0142'), isFalse);
  });

  test('from the text on a container door, the number comes first and the noise stays out', () {
    final lines = ['MAX GROSS 30480 KG', 'CSQU 305438 3', '22G1', 'TARE 2200 KG', 'Ref KCPL-2609-0142'];
    final candidates = scanCandidates(lines);
    expect(candidates.first, 'CSQU3054383');
    expect(candidates, contains('KCPL-2609-0142'));
    expect(candidates, isNot(contains('30480')), reason: 'a weight is not an identifier');
  });

  test('an air waybill is found and written the usual way', () {
    expect(scanCandidates(['AWB 784 55120934']), contains('784-55120934'));
  });

  test('each identifier is offered once, and only a few', () {
    final candidates = scanCandidates(['CSQU3054383', 'CSQU 305438 3', for (var i = 0; i < 20; i++) 'AB12CD$i']);
    expect(candidates.where((c) => compact(c) == 'CSQU3054383').length, 1);
    expect(candidates.length, lessThanOrEqualTo(6));
  });
}
