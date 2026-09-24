/// The frame the bundled map covers (assets/map/asia.kmap).
const mapWest = 48.0;
const mapEast = 142.0;
const mapSouth = -2.0;
const mapNorth = 46.0;

/// A point on the globe, in degrees.
class GeoPoint {
  const GeoPoint(this.lat, this.lon);
  final double lat;
  final double lon;

  /// Whether the land mask covers it, so the map can be drawn around it.
  bool get onMap => lon >= mapWest && lon <= mapEast && lat >= mapSouth && lat <= mapNorth;
}

/// The places KCPL's freight passes through, by the names desks write
/// them. Matching is on whole words, so "Birgunj ICD, Nepal", "ICD Birgunj"
/// and "Birgunj" all land on the map, and anything unknown is left off it
/// rather than guessed.
const _places = <String, GeoPoint>{
  // Nepal: gateways, dry ports and cities.
  'birgunj icd': GeoPoint(27.03, 84.86),
  'sirsiya': GeoPoint(27.03, 84.86),
  'birgunj': GeoPoint(27.01, 84.88),
  'biratnagar': GeoPoint(26.45, 87.27),
  'bhairahawa': GeoPoint(27.51, 83.42),
  'siddharthanagar': GeoPoint(27.51, 83.42),
  'kathmandu tia': GeoPoint(27.70, 85.36),
  'tia': GeoPoint(27.70, 85.36),
  'tribhuvan': GeoPoint(27.70, 85.36),
  'kathmandu': GeoPoint(27.72, 85.32),
  'kalanki': GeoPoint(27.69, 85.28),
  'chobhar': GeoPoint(27.66, 85.29),
  'lalitpur': GeoPoint(27.67, 85.32),
  'bhaktapur': GeoPoint(27.67, 85.43),
  'pokhara': GeoPoint(28.21, 83.99),
  'nepalgunj': GeoPoint(28.05, 81.62),
  'dhangadhi': GeoPoint(28.68, 80.60),
  'kakarvitta': GeoPoint(26.65, 88.17),
  'kakarbhitta': GeoPoint(26.65, 88.17),
  'janakpur': GeoPoint(26.73, 85.93),
  'hetauda': GeoPoint(27.43, 85.03),
  'butwal': GeoPoint(27.70, 83.45),
  'tatopani': GeoPoint(27.95, 85.94),
  'rasuwagadhi': GeoPoint(28.28, 85.38),
  'kerung': GeoPoint(28.40, 85.33),
  'gyirong': GeoPoint(28.40, 85.33),
  // India: ports, borders and cities.
  'kolkata': GeoPoint(22.57, 88.36),
  'calcutta': GeoPoint(22.57, 88.36),
  'haldia': GeoPoint(22.07, 88.07),
  'visakhapatnam': GeoPoint(17.69, 83.22),
  'vizag': GeoPoint(17.69, 83.22),
  'nhava sheva': GeoPoint(18.95, 72.95),
  'jnpt': GeoPoint(18.95, 72.95),
  'mumbai': GeoPoint(18.95, 72.84),
  'mundra': GeoPoint(22.74, 69.72),
  'kandla': GeoPoint(23.03, 70.22),
  'chennai': GeoPoint(13.08, 80.27),
  'cochin': GeoPoint(9.93, 76.27),
  'kochi': GeoPoint(9.93, 76.27),
  'tuticorin': GeoPoint(8.76, 78.13),
  'new delhi': GeoPoint(28.61, 77.21),
  'delhi': GeoPoint(28.61, 77.21),
  'bengaluru': GeoPoint(12.97, 77.59),
  'bangalore': GeoPoint(12.97, 77.59),
  'ahmedabad': GeoPoint(23.02, 72.57),
  'hyderabad': GeoPoint(17.39, 78.49),
  'raxaul': GeoPoint(26.98, 84.85),
  'jogbani': GeoPoint(26.42, 87.27),
  'sunauli': GeoPoint(27.47, 83.46),
  'panitanki': GeoPoint(26.63, 88.18),
  'siliguri': GeoPoint(26.73, 88.40),
  // Bangladesh and Sri Lanka.
  'chittagong': GeoPoint(22.36, 91.78),
  'chattogram': GeoPoint(22.36, 91.78),
  'dhaka': GeoPoint(23.81, 90.41),
  'mongla': GeoPoint(22.49, 89.60),
  'colombo': GeoPoint(6.93, 79.86),
  // China.
  'shanghai': GeoPoint(31.23, 121.47),
  'ningbo': GeoPoint(29.87, 121.54),
  'shenzhen': GeoPoint(22.54, 114.06),
  'guangzhou': GeoPoint(23.13, 113.26),
  'hong kong': GeoPoint(22.32, 114.17),
  'xiamen': GeoPoint(24.48, 118.09),
  'qingdao': GeoPoint(36.07, 120.38),
  'tianjin': GeoPoint(39.34, 117.36),
  'yiwu': GeoPoint(29.32, 120.08),
  'kunming': GeoPoint(25.04, 102.72),
  'chengdu': GeoPoint(30.57, 104.07),
  'lhasa': GeoPoint(29.65, 91.17),
  'shigatse': GeoPoint(29.27, 88.88),
  // East and South-East Asia.
  'busan': GeoPoint(35.10, 129.04),
  'seoul': GeoPoint(37.57, 126.98),
  'incheon': GeoPoint(37.46, 126.71),
  'tokyo': GeoPoint(35.68, 139.69),
  'yokohama': GeoPoint(35.44, 139.64),
  'osaka': GeoPoint(34.69, 135.50),
  'singapore': GeoPoint(1.35, 103.82),
  'port klang': GeoPoint(3.00, 101.40),
  'kuala lumpur': GeoPoint(3.14, 101.69),
  'bangkok': GeoPoint(13.76, 100.50),
  'laem chabang': GeoPoint(13.08, 100.88),
  'ho chi minh': GeoPoint(10.82, 106.63),
  'haiphong': GeoPoint(20.84, 106.69),
  'hanoi': GeoPoint(21.03, 105.85),
  'jakarta': GeoPoint(-6.21, 106.85),
  // The Gulf and beyond: off the map, but a route can still point to them.
  'jebel ali': GeoPoint(25.01, 55.06),
  'dubai': GeoPoint(25.20, 55.27),
  'abu dhabi': GeoPoint(24.45, 54.38),
  'doha': GeoPoint(25.29, 51.53),
  'karachi': GeoPoint(24.86, 67.00),
  'istanbul': GeoPoint(41.01, 28.98),
  'rotterdam': GeoPoint(51.92, 4.48),
  'antwerp': GeoPoint(51.22, 4.40),
  'hamburg': GeoPoint(53.55, 9.99),
  'frankfurt': GeoPoint(50.11, 8.68),
  'london': GeoPoint(51.51, -0.13),
  'toulouse': GeoPoint(43.60, 1.44),
  'paris': GeoPoint(48.86, 2.35),
  'milan': GeoPoint(45.46, 9.19),
  'new york': GeoPoint(40.71, -74.01),
  'los angeles': GeoPoint(34.05, -118.24),
  'sao paulo': GeoPoint(-23.55, -46.63),
  'sydney': GeoPoint(-33.87, 151.21),
  'melbourne': GeoPoint(-37.81, 144.96),
};

// Longest names first, so "birgunj icd" wins over "birgunj".
final _names = _places.keys.toList()..sort((a, b) => b.length.compareTo(a.length));
final _cache = <String, GeoPoint?>{};

/// Where [text] is, if it names a place this map knows.
GeoPoint? locate(String? text) {
  if (text == null || text.trim().isEmpty) return null;
  return _cache.putIfAbsent(text, () {
    final words = ' ${text.toLowerCase().replaceAll('ã', 'a').replaceAll(RegExp(r'[^a-z]+'), ' ').trim()} ';
    for (final name in _names) {
      if (words.contains(' $name ')) return _places[name];
    }
    return null;
  });
}
