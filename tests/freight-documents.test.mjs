import test from "node:test";
import assert from "node:assert/strict";
import {
  freightDocumentKindAllowedForMode,
  generatedDocumentDisclaimer,
  generatedReference,
  primaryCarriageDocumentKind,
  recommendedGeneratedDocumentKinds,
  validateFreightDocumentInput,
} from "../app/admin/freight-documents/freight-documents.ts";
import { renderFreightDocumentPdf } from "../app/admin/freight-documents/freight-document-pdf.ts";

const source = {
  reference: "KCPL-S-20260822-ABC123",
  branch: "Kathmandu",
  customer_id: "C-1",
  customer_name: "Acme Imports",
  origin: "Kolkata",
  destination: "Kathmandu",
  mode: "sea",
  booking_reference: "BOOK-77",
  carrier_name: "Example Line",
  transport_order_id: "ORD-1",
  pieces: 12,
  weight_kg: 2400,
  volume_cbm: 8.4,
  container_count: 1,
  equipment: "20GP",
  pickup_date: "2026-08-22",
  delivery_date: "2026-09-01",
  cargo_description: "Textiles",
  updated_at: "2026-08-22T00:00:00.000Z",
};

const input = {
  kind: "house_bill_of_lading",
  shipper: "Exporter Pvt Ltd, Kolkata",
  consignee: "Acme Imports, Kathmandu",
  notifyParty: "Acme Imports",
  cargoDescription: "Textiles",
  marksAndNumbers: "ACME-001",
  packageType: "12 cartons",
  freightTerms: "Prepaid",
  placeOfReceipt: "Kolkata",
  placeOfDelivery: "Kathmandu",
  masterReference: "MBL-123",
  houseReference: "KCPL-HBL-ABC123",
  incoterm: "CIF",
  specialInstructions: "Keep dry",
  customerSafe: false,
};

test("mode policy recommends and restricts primary carriage documents", () => {
  assert.equal(primaryCarriageDocumentKind("sea"), "house_bill_of_lading");
  assert.equal(primaryCarriageDocumentKind("air"), "house_air_waybill");
  assert.equal(primaryCarriageDocumentKind("road"), "road_consignment_note");
  assert.equal(freightDocumentKindAllowedForMode("house_air_waybill", "sea"), false);
  assert.equal(freightDocumentKindAllowedForMode("house_air_waybill", "multimodal"), true);
  assert.equal(recommendedGeneratedDocumentKinds("sea").includes("cargo_manifest"), true);
});

test("generation validation requires parties and cargo description", () => {
  assert.deepEqual(validateFreightDocumentInput(input, source), []);
  const issues = validateFreightDocumentInput({ ...input, shipper: "", cargoDescription: "" }, source);
  assert.equal(issues.some((issue) => issue.includes("Shipper")), true);
  assert.equal(issues.some((issue) => issue.includes("Cargo")), true);
});

test("unsupported scripts are rejected instead of silently damaged in generated PDFs", () => {
  const issues = validateFreightDocumentInput({ ...input, shipper: "निर्यातकर्ता प्रा. लि." }, source);
  assert.equal(issues.some((issue) => issue.includes("cannot reproduce safely")), true);
});

test("decomposable Latin accents remain accepted by the PDF policy", () => {
  assert.deepEqual(validateFreightDocumentInput({ ...input, notifyParty: "Café Logistics" }, source), []);
});

test("generated references are deterministic by shipment and kind", () => {
  assert.equal(generatedReference("house_bill_of_lading", source.reference), generatedReference("house_bill_of_lading", source.reference));
  assert.match(generatedReference("house_bill_of_lading", source.reference), /^KCPL-HBL-/);
});

test("carriage disclaimers never claim carrier master issuance", () => {
  assert.match(generatedDocumentDisclaimer("house_bill_of_lading"), /not a shipping-line master bill/i);
  assert.match(generatedDocumentDisclaimer("house_air_waybill"), /not an airline master air waybill/i);
});

test("PDF renderer emits a parseable PDF envelope with KCPL content", () => {
  const pdf = renderFreightDocumentPdf(source, input, "2026-08-22T07:30:00.000Z", 2);
  assert.equal(pdf.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  assert.match(pdf.toString("latin1"), /KAPILESHWOR CARGO PVT\. LTD\./);
  assert.match(pdf.toString("latin1"), /DRAFT \/ CONTROLLED WORKING DOCUMENT - REVISION 2/);
  assert.match(pdf.toString("latin1"), /xref/);
  assert.match(pdf.toString("latin1"), /%%EOF/);
});
