---
name: Kapileshwor Cargo public website
description: A transit diagram for moving freight into and out of Nepal; one crimson line, stations on it, and the quote form sitting on the line.
colors:
  crimson: "#dc143c"
  crimson-deep: "#b80f31"
  ink: "#101010"
  canvas: "#f6f6f3"
  paper: "#ffffff"
  muted: "#565650"
  placeholder: "#74746d"
  rule: "rgb(16 16 16 / 16%)"
  rule-on-ink: "rgb(255 255 255 / 30%)"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(40px, 6.1vw, 92px)"
    fontWeight: 500
    lineHeight: 1.01
    letterSpacing: "-0.04em"
  page-title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(38px, 5.6vw, 84px)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  band-title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(36px, 6vw, 92px)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  stop-title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(30px, 4.2vw, 62px)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  feature-title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(28px, 3.6vw, 52px)"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  panel-title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.4vw, 34px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  block-title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(20px, 1.8vw, 26px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  item-title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(18px, 1.4vw, 21px)"
    fontWeight: 600
    letterSpacing: "-0.01em"
  lead:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(16px, 1.3vw, 19px)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.55
  control:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1
  input:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 600
rounded:
  none: "0px"
  station: "50%"
spacing:
  page-margin: "clamp(16px, 4.4vw, 64px)"
  content-inset: "clamp(72px, 9vw, 150px)"
  spine-inset: "24px"
  line: "8px"
  header: "72px"
  stop-top: "clamp(64px, 8vw, 128px)"
  stop-bottom: "clamp(32px, 4vw, 56px)"
  band: "clamp(48px, 6vw, 88px)"
  end-band: "clamp(64px, 9vw, 136px)"
  column-gap: "clamp(32px, 5vw, 88px)"
components:
  button-primary:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.crimson-deep}"
  button-small:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  button-white:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.crimson}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "52px"
  button-white-hover:
    backgroundColor: "{colors.canvas}"
  route-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  form-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  mode-option-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
  plate:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "clamp(20px, 3vw, 36px)"
  result-plate:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "clamp(18px, 2.4vw, 28px)"
  station:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.station}"
    size: "18px"
  feature-band:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.paper}"
  end-band:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.paper}"
    typography: "{typography.band-title}"
---

# Design System: Kapileshwor Cargo public website

Scope: every public page in all four languages, plus the customer sign-in page, which follows this site. Admin and the portal's signed-in app have their own design system and are not covered here.

## Overview

**Creative North Star: "The Line"**

The whole site is one transit diagram. A thick crimson line with white stations on it starts at the origin field on the home page, runs through the route diagram to the destination field, and continues down the left of marketing and guide pages as a spine with one station per section. On the crimson bands the same line carries through in white. A new surface joins this system by finding its place on the line, not by adding a decorative layer around it.

The ground is off-white and quiet, the type is one family at a modest display weight, and separation comes from hairlines and whitespace. Crimson is never rationed into small accents: it appears as the line, as primary controls, and as whole bands. Density is generous on marketing pages and tighter on quote and tool pages, where chamfered plates hold the working parts. Photographs appear rarely, so the diagram stays the main image.

The geometry comes from the Gateway K logo. Its corners are cut, so buttons, plates and photographs are cut the same way, and the ground legs of the line bend at 45 degrees.

**Key Characteristics:**
- One crimson line with stations as the recurring device, from the home route to small routes inside stories and forms.
- Off-white ground, ink text, crimson used whole.
- Chamfered top-left and bottom-right corners on controls, plates and photographs; everything else stays square.
- Manrope at weight 500 for large headings, with tight tracking in Latin only.
- Hairline rows in place of cards for lists; two-ink crimson bands for emphasis.

## Colors

A three-part palette of crimson, ink and warm off-white, with white as the raised surface. Exact values live in the frontmatter. The tonal ramps in `.impeccable/design.json` are preview swatches for the panel, not palette steps.

### Primary
- **KCPL Crimson** (#dc143c): the line, primary buttons, whole bands, current navigation, text-link hover, focus rings, text selection and the input caret. The value is an exact brand commitment.
- **Pressed Crimson** (#b80f31): hover on primary buttons, and error text, where it reaches a stronger contrast than the brand crimson.

### Neutral
- **Ink** (#101010): text, station rings, selected options and the dark result plate.
- **Off-White Canvas** (#f6f6f3): the page ground, including the sticky header.
- **Paper** (#ffffff): raised working surfaces such as fields, plates, popovers and the footer, plus station fill and all text on crimson.
- **Warm Grey** (#565650): supporting copy and field labels, with roughly 6.8:1 contrast on canvas.
- **Placeholder Grey** (#74746d): input placeholders only, at weight 500.
- **Hairline** (rgb(16 16 16 / 16%)): row dividers, quiet field rings and the unfilled spine.
- **Hairline on Ink** (rgb(255 255 255 / 30%)): dividers and the meter track on the dark result plate.

### Named Rules
**The Whole Crimson Rule.** Crimson appears at full strength as a line, a control or a band. It never becomes a tinted surface fill. The one sanctioned reduction is state on the diagram: an inactive line drops to 14% opacity so the chosen route reads, the undecided air arc sits at 55%, and that dimming belongs to the line alone.

**The Two Inks Rule.** On a crimson band there are two inks, crimson and white. Text, line, rings, focus outlines and the white button all follow it; muted grey and ink never appear there.

**The One Accent Rule.** A second accent is allowed only for charts and status. The public site currently ships none.

## Typography

**Display Font:** Manrope (with system-ui, sans-serif)
**Body Font:** Manrope (with Noto Sans Devanagari for Nepali and Hindi; PingFang SC, Microsoft YaHei or Noto Sans SC for Chinese)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, monospace), for real data only

**Character:** One grotesque family does all the work, set large at a modest weight with tight tracking, so headings read as plain statements rather than shouted ones. Weight rises as size falls, ending in bold controls.

### Hierarchy
- **Display** (500, up to 92px, 1.01): the home headline only.
- **Page Title** (500, up to 84px, 1.02): the single H1 of an inner page, measured at 14em. The quote page caps it at 72px.
- **Band Title** (500, up to 92px, 1.02): the closing band, measured at 13em.
- **Stop Title** (500, up to 62px, 1.05): each station's section heading, measured at 18em. Directly under a page head it steps down to a 26 to 40px range.
- **Feature Title** (500, up to 52px, 1.06): a movement staged on a crimson band.
- **Panel Title** (500, up to 34px, 1.1): the heading inside a plate. The network map heading uses the same shape up to 38px.
- **Block Title** (600, up to 26px, 1.2): subsections inside a stop. Story and service-row titles sit beside it at 600, up to 27px and 23px.
- **Item Title** (600, up to 21px): questions, stages and search results.
- **Lead** (400, up to 19px, 1.55): intros in Warm Grey, measured at 32 to 40em. Long-form prose uses the same range without the grey, at 40em.
- **Body** (400, 16px, 1.55): running text, measured at about 34em in columns.
- **Label** (500 or 600, 14px): field labels, station names, rail titles, navigation. Sentence case, no added tracking, never below 14px.
- **Control** (700, 16px, 1): buttons and text links. Small buttons drop to 14px.
- **Input** (600, 16px, 1.5): typed values. Sixteen pixels stops phones zooming into the field.
- **Data** (IBM Plex Mono, 600, 16px): the quote reference number. Calculated figures stay in Manrope with tabular numerals.

### Named Rules
**The Script Respect Rule.** Latin's tight tracking is never applied to other scripts. Devanagari display sets at line-height 1.25 with zero tracking, and body at 1.7, so vowel marks do not clip. Chinese display sets at 1.2 with -0.01em tracking and phrase-aware line breaks.

**The Real Data Rule.** Monospace marks a value that is actually data. It is never a costume for labels or headings.

## Layout

Lined pages have a left rail and a content column. The spine sits at the page margin plus its inset, and content starts at the margin plus the content inset, so all lined sections share one left edge. Bands run full-bleed but keep that same content edge, with the line continuing through them in white. Working and reference surfaces (the quote page, an individual tool, legal, search, gallery) drop the spine and run from the page margin.

A section is a stop: top padding, a station aligned to the first line of its heading, a title, an optional intro, then content. Grids are asymmetric at 7fr to 5fr for hero, feature and tool layouts, 5fr to 7fr for the quote page, and even two or three columns for lists. Rows are separated by hairlines at their top edge.

The home hero places the headline upper left and intro upper right, with the route diagram spanning full width between the origin and destination fields, and mode, note and quote button beneath. The header is sticky at 72px.

At 1100px the primary links move into the menu. At 900px the layout becomes single-column: the header drops to 64px, the spine moves to 4px inside the margin at 6px thick, the content inset becomes 36px, the diagram becomes a vertical stop list between the two fields, the header quote button gives way to a fixed bottom action bar, and long mini routes turn vertical. The bottom bar carries Call and Quote, adds WhatsApp only once a number exists, and drops Quote on the quote page itself. Hover effects apply only to devices with a fine pointer.

## Elevation & Depth

The system is flat. Depth comes from tone (paper on canvas, ink and crimson plates and bands) and from inset rings that behave as borders. Only things that really float, or physical documents, cast a soft ambient shadow, and all of it is ink at low alpha with blur.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 12px 32px rgb(16 16 16 / 16%)`): language and menu panels.
- **Map Label** (`box-shadow: 0 8px 22px rgb(16 16 16 / 16%)`): the selection card over the network map.
- **Certificate** (`box-shadow: 0 8px 22px rgb(16 16 16 / 12%)`): award certificates, as paper objects on the page.
- **Quiet Ring** (`box-shadow: inset 0 0 0 1px rgb(16 16 16 / 16%)`): form fields and tool option blocks at rest.
- **Route Ring** (`box-shadow: inset 0 0 0 2px #101010`): the two ends of the route, and the box-form field. Any ring turns 2px crimson on focus.

### Named Rules
**The Flat Sections Rule.** Sections, plates and bands never cast shadows. A clip-path removes outer shadows and outlines, so anything chamfered and focusable draws its focus ring inside.

## Shapes

Two silhouettes carry the system: the cut corner and the round station.

The chamfer removes the top-left and bottom-right corners at 45 degrees, as on the Gateway K. It is 10px on buttons and the phone quote action, and 18px on plates and photographs. It is drawn with clip-path, not border-radius. Fields, mode options, list rows, popovers, the map stage and icon buttons stay fully square, and no element uses a soft radius.

The station is the only round form: an 18px white disc with a 3px ink ring (16px on the phone stop list). A current step or selected map marker fills crimson. On a crimson band the ring turns white and the fill crimson. The closing band ends the line in a solid 28px white terminus.

The line itself is 8px as the spine (6px on phones), a scaled 9-unit stroke in the 800 by 240 diagram, and 4 to 6px in small routes, stages and form rails. Ground legs bend at 45 degrees. The air route is the one curve, an arc over the top at a thinner weight, and that contrast is deliberate. Small routes stretch to their column, so their raised bends read as cuts without holding an exact angle.

### Named Rules
**The Certificates As Issued Rule.** Award certificates are never chamfered, cropped or tinted. Client logos on the rail are greyscale at 85% opacity with a multiply blend. The Gateway K is never recoloured or redrawn.

## Components

### Buttons
Blunt, bold and cut like the K.
- **Shape:** 10px chamfer, no radius.
- **Primary:** crimson with white 700 text, 52px tall, often with a bold Phosphor arrow at 15 to 17px. The small variant is 44px tall.
- **Hover / Focus:** background moves to Pressed Crimson in 160ms. Focus draws a 2px white outline inset by 5px, because the clip would cut off an outer ring.
- **White:** on crimson bands only; white with crimson text, hovering to canvas, with a crimson focus ring.
- **Text Link:** inherits colour, 700 weight, 44px hit area, arrow nudging 4px right on hover while the text turns crimson.
- **Disabled:** 60% opacity with a progress cursor.

### Chips
- **Style:** freight-mode and map-filter options are bare 14px, 600 text tiles with 2px gaps, square and transparent at rest. Tool options add a quiet ring.
- **State:** selected fills ink with white text, not crimson; crimson stays reserved for the action. Hover shows the hairline colour as a fill. Keyboard focus shows a 2px crimson outline.

### Cards / Containers
There are no content cards. The two working containers are plates.
- **Corner Style:** 18px chamfer.
- **Background:** paper for quote and tool forms; ink with white text for the tool result, sticky under the header on desktop.
- **Shadow Strategy:** none.
- **Border:** none.
- **Internal Padding:** up to 36px on the quote plate and 28px on tool plates.

### Photographs
Illustrative Unsplash photographs, each listed in `docs/public-photo-sources.md`, with an empty alt because they add no information. At most one to a section: beside the text on service, sector and guide pages (`.sector`, 7fr of text to 5fr of photograph at 10:7), or across the column where the subject is wide (`.plate-wide`, 21:9, 3:2 on phones). Quote, contact, track, tools, FAQ, careers, awards and legal pages carry none because they are for doing or checking something; on the network page the route and the map are the image; movement stories stay without pictures because they are anonymous.

### Inputs / Fields
- **Style:** a paper tile with a 14px Warm Grey label stacked over a borderless 16px, 600 value. Route ends carry the 2px ink ring, ordinary form fields the quiet ring. Tool inputs are the working variant: 48px tall, a 1px hairline border and a label above the box, with unit suffixes on a canvas tile.
- **Focus:** the ring becomes 2px crimson in 160ms; tool inputs show a 2px crimson outline. The caret is crimson.
- **Error / Disabled:** errors are 600 weight text in Pressed Crimson, announced as an alert.

### Navigation
- **Header:** canvas, sticky, with no divider. The Gateway K lockup, six primary links at 14px and 500, then language, quote button and menu. The current link turns crimson at 700. Track, search and the portal live in the menu, which exists at every width, and in the footer.
- **Popovers:** native disclosures with a paper panel, Popover shadow, 44px rows and a 160ms scale-in. On phones the menu fills the width below the header with 50px hairline rows at 18px.
- **Footer:** paper, four columns collapsing to one, with a hairline-topped base row. The tagline appears here only.

### Route Diagram
The signature component and the home page's form. Choosing a freight mode reroutes the line: ground routes redraw over 1500ms, air brings up the arc and dims the rest, and typing a known place lights the matching branch. It draws on load and again on each mode change, and renders static under reduced motion. Labels are HTML so they stay legible as the drawing scales. Phones show the same logic as a stop list between the two fields.

### Spine and Stops
The spine fills with crimson as the page scrolls, using a view-driven timeline where supported. It stands solid crimson without support or under reduced motion. Each stop places one station beside its heading.

On long pages the spine also paces the reading. Its front holds at 72% of the screen height, and `route-reveal.tsx` calls a section in when its station reaches that line: heading, then intro, then items at 60ms apart (35ms on phones), over 480ms (320ms on phones), once per visit. Images and drawn routes wipe in from the left over 700ms (450ms on phones). Sections already on screen at load are never hidden; the first section under a page title arrives through CSS instead. Reduced motion keeps a 200ms fade and drops all movement, and without JavaScript everything is simply visible. Privacy, terms, quote, track, tools, contact, careers, gallery and search stay still, because people are reading closely or typing there.

### Mini Route
A movement's own small route: evenly spaced stations with the line lifted over any rerouted stops. Beyond four stops it turns vertical on phones. At band scale it runs in white at 6px with 16px labels.

### Bands
Full-bleed crimson in two inks with the white line running through. The feature band stages one movement mid-page. The closing band ends most lined pages with one job, the quote, and terminates the line.

### Hairline Rows
Service, question, fact, link and search lists: a top hairline, generous padding, title in 600 and detail in Warm Grey, usually in two columns. Hover turns the title crimson and nudges the arrow.

### Client Rail
A slow 70-second marquee of greyscale logos with edge fades and a 44px square pause button. It pauses on hover and becomes a static wrapped list under reduced motion.

### Customer Sign-In
Follows the site's ground, Manrope, a heading up to 42px at 500, and the 52px chamfered crimson submit, with square inputs at 16px. The staff sign-in keeps the app's own canvas and is not covered.

## Do's and Don'ts

### Do:
- **Do** put new sections on the line as a stop, with a station beside the heading and content on the shared left edge.
- **Do** chamfer only the top-left and bottom-right corners, 10px on controls and 18px on plates and photographs.
- **Do** separate list items with a top hairline and whitespace.
- **Do** use ink for the selected state of an option and crimson for the action.
- **Do** keep crimson bands to two inks, including their focus rings.
- **Do** give every motion a reduced-motion fallback, and let the signature draw play once per load or per mode change.
- **Do** let long pages arrive in reading order, and open long answers on a tap. Never hold back a headline, a form, or anything a person is typing into.
- **Do** use Phosphor icons, bold for arrows, and Manrope tabular numerals for calculated figures.
- **Do** keep controls at 44px or taller, form text at 16px, and check every layout in Nepali, Hindi and Chinese.

### Don't:
- **Don't** use a tinted crimson surface, or any second accent outside charts and status.
- **Don't** build grids of bordered or shadowed cards; plates are for forms and results only.
- **Don't** use soft rounded corners, or bend a ground route at anything other than a 45-degree cut. The air arc is the only curve.
- **Don't** stage a stock photograph under an overlaid headline; the route is the main image.
- **Don't** put a chamfer on certificates or redraw, recolour or crop the Gateway K.
- **Don't** apply tight Latin tracking to Devanagari or Chinese.
- **Don't** use monospace for anything but real data.
- **Don't** add small uppercase labels above headings; a section opens with its station and title.
- **Don't** use AI-generated images, video, other companies' branding in photographs, or faces other than Ramesh Mishra's portrait.
- **Don't** make Track a header link, or place the tagline anywhere but the footer.
