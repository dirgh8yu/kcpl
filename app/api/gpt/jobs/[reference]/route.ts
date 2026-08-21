import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../../firebase-admin.server";
import { gptActionJson, requireGptAction } from "../../../../gpt-action-auth.server";

type SubcollectionDoc = Record<string, unknown> & { id: string };

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function bool(value: unknown) {
  return value === true;
}

function numberOrNull(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function sortNewest<T extends Record<string, unknown>>(values: T[], field: string) {
  return values.sort((left, right) => text(right[field]).localeCompare(text(left[field])));
}

function documentEffectiveStatus(document: Record<string, unknown>) {
  const status = text(document.review_status, "received");
  const expiresOn = text(document.expires_on);
  const today = new Date().toISOString().slice(0, 10);
  if (status === "verified" && expiresOn && expiresOn < today) return "expired";
  return status;
}

async function subcollection(reference: string, name: string, limit = 250): Promise<SubcollectionDoc[]> {
  const snapshot = await firebaseAdminDb().collection("shipments").doc(reference).collection(name).limit(limit).get();
  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Record<string, unknown>),
    id: doc.id,
  }));
}

export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  const authError = requireGptAction(request);
  if (authError) return authError;
  if (!firebaseRuntimeConfigured()) return gptActionJson({ ok: false, error: "Firebase is unavailable." }, 503);

  const { reference: rawReference } = await context.params;
  const reference = rawReference.trim().toUpperCase().slice(0, 160);
  if (!reference) return gptActionJson({ ok: false, error: "A shipment reference is required." }, 400);

  try {
    const db = firebaseAdminDb();
    const shipmentSnapshot = await db.collection("shipments").doc(reference).get();
    if (!shipmentSnapshot.exists) return gptActionJson({ ok: false, error: "Shipment not found." }, 404);

    const shipment = shipmentSnapshot.data() as Record<string, unknown>;
    const quoteReference = text(shipment.quote_reference);
    const customerId = text(shipment.customer_id);

    const [quoteSnapshot, customerSnapshot, tasksRaw, customsRaw, requirementsRaw, documentsRaw, eventsRaw, activityRaw] = await Promise.all([
      quoteReference ? db.collection("quotes").doc(quoteReference).get() : Promise.resolve(null),
      customerId ? db.collection("customers").doc(customerId).get() : Promise.resolve(null),
      subcollection(reference, "job_tasks"),
      subcollection(reference, "customs_steps"),
      subcollection(reference, "document_requirements"),
      subcollection(reference, "documents"),
      subcollection(reference, "events", 100),
      subcollection(reference, "job_activity", 100),
    ]);

    const quote = quoteSnapshot?.exists ? quoteSnapshot.data() as Record<string, unknown> : null;
    const customer = customerSnapshot?.exists ? customerSnapshot.data() as Record<string, unknown> : null;

    const tasks = sortNewest(tasksRaw, "created_at").map((task) => ({
      id: text(task.id),
      title: text(task.title, "Task"),
      detail: nullable(task.detail),
      branch: nullable(task.branch),
      dueAt: nullable(task.due_at),
      assignedToName: nullable(task.assigned_to_name),
      assignedToEmail: nullable(task.assigned_to_email),
      assignedToPhone: nullable(task.assigned_to_phone),
      completed: bool(task.completed),
      completedAt: nullable(task.completed_at),
      completedBy: nullable(task.completed_by),
      createdAt: nullable(task.created_at),
    }));

    const customsSteps = sortNewest(customsRaw, "created_at").map((step) => ({
      id: text(step.id),
      title: text(step.title, "Customs step"),
      detail: nullable(step.detail),
      branch: nullable(step.branch),
      required: step.required !== false,
      completed: bool(step.completed),
      completedAt: nullable(step.completed_at),
      completedBy: nullable(step.completed_by),
      createdAt: nullable(step.created_at),
    }));

    const requirements = requirementsRaw.map((requirement) => ({
      documentType: text(requirement.document_type, text(requirement.id)),
      required: requirement.required !== false,
      reason: nullable(requirement.reason),
      source: nullable(requirement.source),
      updatedAt: nullable(requirement.updated_at),
    }));

    const documents = sortNewest(documentsRaw, "uploaded_at")
      .filter((document) => !["deleted", "superseded"].includes(text(document.review_status)))
      .map((document) => ({
        id: numberOrNull(document.id) ?? text(document.id),
        filename: text(document.filename, "Document"),
        documentType: nullable(document.document_type),
        contentType: nullable(document.content_type),
        sizeBytes: numberOrNull(document.size_bytes),
        reviewStatus: text(document.review_status, "received"),
        effectiveStatus: documentEffectiveStatus(document),
        customerSafe: bool(document.customer_safe),
        reviewNote: nullable(document.review_note),
        uploadedAt: nullable(document.uploaded_at),
        uploadedBy: nullable(document.uploaded_by),
        reviewedAt: nullable(document.reviewed_at),
        reviewedBy: nullable(document.reviewed_by),
        verifiedAt: nullable(document.verified_at),
        verifiedBy: nullable(document.verified_by),
        expiresOn: nullable(document.expires_on),
      }));

    const readyTypes = new Set(
      documents
        .filter((document) => document.effectiveStatus === "verified" && document.documentType)
        .map((document) => document.documentType as string),
    );
    const requiredTypes = requirements.filter((requirement) => requirement.required).map((requirement) => requirement.documentType);
    const missingOrUnverifiedDocumentTypes = requiredTypes.filter((documentType) => !readyTypes.has(documentType));

    const events = sortNewest(eventsRaw, "event_time").map((event) => ({
      id: numberOrNull(event.id) ?? text(event.id),
      title: text(event.title, "Shipment event"),
      location: nullable(event.location),
      details: nullable(event.details),
      eventTime: nullable(event.event_time),
      authorName: nullable(event.author_name),
    }));

    const activity = sortNewest(activityRaw, "created_at").map((item) => ({
      id: text(item.id),
      type: nullable(item.type),
      title: text(item.title, "Job activity"),
      detail: nullable(item.detail),
      actorName: nullable(item.actor_name),
      createdAt: nullable(item.created_at),
    }));

    const openTasks = tasks.filter((task) => !task.completed);
    const incompleteRequiredCustomsSteps = customsSteps.filter((step) => step.required && !step.completed);

    return gptActionJson({
      ok: true,
      job: {
        reference,
        quoteReference: quoteReference || null,
        customerId: customerId || null,
        status: text(shipment.status, "booking_confirmed"),
        priority: nullable(shipment.job_priority),
        primaryBranch: nullable(shipment.primary_branch),
        handlingBranches: stringList(shipment.handling_branches),
        assignedTo: {
          name: nullable(shipment.job_assigned_to_name),
          email: nullable(shipment.job_assigned_to_email),
          phone: nullable(shipment.job_assigned_to_phone),
        },
        internalReference: nullable(shipment.internal_job_reference),
        internalNotes: nullable(shipment.internal_job_notes),
        eta: nullable(shipment.eta),
        currentLocation: nullable(shipment.current_location),
        carrier: nullable(shipment.carrier),
        carrierReference: nullable(shipment.carrier_reference),
        customerNote: nullable(shipment.customer_note),
        createdAt: nullable(shipment.created_at),
        updatedAt: nullable(shipment.updated_at),
        closedAt: nullable(shipment.job_closed_at),
        closedBy: nullable(shipment.job_closed_by_name),
        closeNote: nullable(shipment.job_close_note),
        closeOverridden: bool(shipment.job_close_overridden),
      },
      route: quote ? {
        origin: nullable(quote.origin),
        destination: nullable(quote.destination),
        mode: nullable(quote.mode),
        cargoType: nullable(quote.cargo_type),
      } : null,
      customer: customer ? {
        id: customerId,
        displayName: nullable(customer.display_name),
        legalName: nullable(customer.legal_name),
        tradingName: nullable(customer.trading_name),
        primaryEmail: nullable(customer.primary_email),
        primaryPhone: nullable(customer.primary_phone),
        country: nullable(customer.country),
        primaryBranch: nullable(customer.primary_branch),
        accountStatus: nullable(customer.account_status),
        accountManager: nullable(customer.account_manager_name),
      } : null,
      readiness: {
        openTaskCount: openTasks.length,
        incompleteRequiredCustomsStepCount: incompleteRequiredCustomsSteps.length,
        requiredDocumentCount: requiredTypes.length,
        missingOrUnverifiedDocumentTypes,
        documentsReady: missingOrUnverifiedDocumentTypes.length === 0,
      },
      tasks,
      customsSteps,
      documentRequirements: requirements,
      documents,
      events,
      activity,
    });
  } catch (error) {
    console.error("KCPL Custom GPT Job File lookup failed", error);
    return gptActionJson({ ok: false, error: "The KCPL Job File is temporarily unavailable." }, 503);
  }
}
