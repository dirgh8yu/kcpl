import {
  generatedDocumentDisclaimer,
  generatedFreightDocumentLabels,
  type FreightDocumentInput,
  type FreightDocumentSource,
} from "./freight-documents";

type Line = { text: string; bold?: boolean; size?: number; gapBefore?: number };

function ascii(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
}

function escapePdf(value: string) {
  return ascii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrap(value: string, width = 82) {
  const text = ascii(value).replace(/\s+/g, " ").trim();
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) current = candidate;
    else {
      if (current) lines.push(current);
      current = word.length <= width ? word : word.slice(0, width);
    }
  }
  if (current) lines.push(current);
  return lines;
}

function field(lines: Line[], label: string, value: string | null | undefined) {
  lines.push({ text: label.toUpperCase(), bold: true, size: 8, gapBefore: 4 });
  for (const row of wrap(value?.trim() || "Not stated")) lines.push({ text: row, size: 9 });
}

function section(lines: Line[], title: string) {
  lines.push({ text: title.toUpperCase(), bold: true, size: 10, gapBefore: 10 });
}

function buildLines(source: FreightDocumentSource, input: FreightDocumentInput, generatedAt: string, revision: number): Line[] {
  const lines: Line[] = [];
  lines.push({ text: "KAPILESHWOR CARGO PVT. LTD. (KCPL)", bold: true, size: 15 });
  lines.push({ text: generatedFreightDocumentLabels[input.kind], bold: true, size: 13, gapBefore: 3 });
  lines.push({ text: `DRAFT / CONTROLLED WORKING DOCUMENT - REVISION ${revision}`, bold: true, size: 9, gapBefore: 3 });
  lines.push({ text: `Shipment: ${source.reference}    Generated: ${generatedAt}`, size: 8 });
  lines.push({ text: generatedDocumentDisclaimer(input.kind), size: 8, gapBefore: 4 });

  section(lines, "References");
  field(lines, "KCPL shipment reference", source.reference);
  field(lines, "House / internal reference", input.houseReference);
  field(lines, "Carrier / master reference", input.masterReference || source.booking_reference);
  field(lines, "Booking reference", source.booking_reference);
  field(lines, "Carrier / counterpart", source.carrier_name);

  section(lines, "Parties");
  field(lines, "Shipper", input.shipper);
  field(lines, "Consignee", input.consignee);
  field(lines, "Notify party", input.notifyParty);

  section(lines, "Movement");
  field(lines, "Origin / place of receipt", input.placeOfReceipt || source.origin);
  field(lines, "Destination / place of delivery", input.placeOfDelivery || source.destination);
  field(lines, "Mode", source.mode.toUpperCase());
  field(lines, "Pickup date", source.pickup_date);
  field(lines, "Expected delivery date", source.delivery_date);
  field(lines, "Freight terms", input.freightTerms);
  field(lines, "Incoterm", input.incoterm);

  section(lines, "Cargo particulars");
  field(lines, "Description of goods", input.cargoDescription || source.cargo_description);
  field(lines, "Marks and numbers", input.marksAndNumbers);
  field(lines, "Package type", input.packageType);
  field(lines, "Pieces", String(source.pieces || 0));
  field(lines, "Gross weight", `${source.weight_kg || 0} kg`);
  field(lines, "Volume", `${source.volume_cbm || 0} CBM`);
  field(lines, "Containers", String(source.container_count || 0));
  field(lines, "Equipment", source.equipment);

  section(lines, "Instructions and control");
  field(lines, "Special instructions", input.specialInstructions);
  lines.push({ text: "This PDF was generated from KCPL's Digital Job File. Verify names, quantities, weights, references, route and regulatory requirements before issue or external use.", size: 8, gapBefore: 8 });
  lines.push({ text: "Generated documents remain subject to KCPL Document Vault review and supersession controls.", size: 8 });
  return lines;
}

function pageContent(lines: Line[], pageNumber: number, pageCount: number) {
  const commands: string[] = ["0.45 w", "45 814 m 550 814 l S"];
  let y = 795;
  for (const line of lines) {
    y -= line.gapBefore ?? 0;
    const font = line.bold ? "F2" : "F1";
    commands.push(`BT /${font} ${line.size ?? 9} Tf 50 ${y.toFixed(1)} Td (${escapePdf(line.text)}) Tj ET`);
    y -= (line.size ?? 9) + 4;
  }
  commands.push("45 30 m 550 30 l S");
  commands.push(`BT /F1 7 Tf 50 18 Td (${escapePdf(`KCPL controlled freight document - page ${pageNumber} of ${pageCount}`)}) Tj ET`);
  return commands.join("\n");
}

function paginate(lines: Line[]) {
  const pages: Line[][] = [];
  let current: Line[] = [];
  let used = 0;
  for (const line of lines) {
    const height = (line.size ?? 9) + 4 + (line.gapBefore ?? 0);
    if (current.length && used + height > 735) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(line);
    used += height;
  }
  if (current.length) pages.push(current);
  return pages.length ? pages : [[]];
}

export function renderFreightDocumentPdf(source: FreightDocumentSource, input: FreightDocumentInput, generatedAt: string, revision: number) {
  const pages = paginate(buildLines(source, input, generatedAt, revision));
  const objects: string[] = [];
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = "";
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  const pageIds: number[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const content = pageContent(pages[index], index + 1, pages.length);
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n%KCPL\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets[i + 1] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
