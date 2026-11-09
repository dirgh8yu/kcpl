/*
 * Customs points on Nepal's two land borders, west to east, as [English, Nepali].
 *
 * India border: the Department of Customs' own list of offices
 * (customs.gov.np/pages/customs-offices, read 2026-11-09), with its Nepali names.
 *
 * China border: the department's China-border offices as Wikipedia's "Department of
 * Customs (Nepal)" lists them. The department's own site names only Rasuwa, Tatopani
 * and Mustang among these, so KCPL confirms the other six before they are relied on.
 */
export const customsPoints = {
  china: [
    ["Yari", "यारी"], ["Mugu", "मुगु"], ["Mustang", "मुस्ताङ"], ["Larke", "लार्के"], ["Rasuwa", "रसुवा"],
    ["Tatopani", "तातोपानी"], ["Lamabagar", "लामाबगर"], ["Kimathanka", "किमाथाङ्का"], ["Olangchung Gola", "ओलाङचुङगोला"],
  ],
  india: [
    ["Kanchanpur", "कञ्चनपुर"], ["Darchula", "दार्चुला"], ["Kailali", "कैलाली"], ["Sati", "सत्ती"], ["Nepalgunj", "नेपालगन्ज"],
    ["Krishnanagar", "कृष्णनगर"], ["Suthauli", "सुठौली"], ["Bhairahawa", "भैरहवा"], ["Maheshpur", "महेशपुर"], ["Triveni", "त्रिवेणी"],
    ["Birgunj", "वीरगन्ज"], ["Gaur", "गौर"], ["Sarlahi", "सर्लाही"], ["Jaleshwar", "जलेश्वर"], ["Janakpur", "जनकपुर"],
    ["Siraha", "सिराहा"], ["Thadhi", "ठाँडी"], ["Rajbiraj", "राजविराज"], ["Sunsari", "सुनसरी"], ["Biratnagar", "विराटनगर"],
    ["Bhadrapur", "भद्रपुर"], ["Mechi", "मेची"], ["Pashupatinagar", "पशुपतिनगर"],
  ],
} as const satisfies Record<"china" | "india", readonly (readonly [string, string])[]>;
