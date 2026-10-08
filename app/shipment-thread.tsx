"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { OpsButton, OpsNotice, OpsSurface } from "./admin/operations-ui";
import type { ShipmentMessageSide, ShipmentMessageView } from "./shipment-messages";

export type ShipmentThreadLabels = {
  title: string;
  placeholder: string;
  send: string;
  sending: string;
  failed: string;
  loadFailed: string;
};

/** Nepal time, in the viewer's product's own clock: the portal's 24-hour
 *  "29 Sept, 13:21", the staff workspace's "29 Sept, 1:21 pm". */
function when(value: string, viewer: ShipmentMessageSide) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(viewer === "customer" ? "en-GB" : "en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kathmandu" }).format(date);
}

/**
 * The shipment's conversation, for the web portal and the Job File. Each
 * passes its own endpoint; the rules behind both are
 * shipment-messages.server.ts's. The viewer's own messages sit on the right.
 */
export function ShipmentThread({ endpoint, viewer, labels, id = "messages" }: {
  endpoint: string;
  viewer: ShipmentMessageSide;
  labels: ShipmentThreadLabels;
  id?: string;
}) {
  const [messages, setMessages] = useState<ShipmentMessageView[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLOListElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; messages?: ShipmentMessageView[]; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || labels.loadFailed);
      setMessages(data.messages ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.loadFailed);
      setMessages((current) => current ?? []);
    }
  }, [endpoint, labels.loadFailed]);

  useEffect(() => {
    // Loaded from a timer, as the reply poll is: the thread is outside state.
    const first = window.setTimeout(() => void load(), 0);
    // A reply shows without reloading the page.
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    // The newest message into view inside the thread's own scroll box. Never
    // scrollIntoView: that also scrolls the page, so opening a shipment would
    // jump the reader down to the conversation before they had read the top.
    const box = list.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages?.length]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json() as { ok?: boolean; message?: ShipmentMessageView; error?: string };
      if (!response.ok || !data.ok || !data.message) throw new Error(data.error || labels.failed);
      setMessages((current) => [...(current ?? []), data.message!]);
      setDraft("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id={id}>
      {/* A conversation with nothing in it yet is its composer: the title and
          the box to write in say what it is for. */}
      <OpsSurface title={labels.title}>
        {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
        {messages?.length ? (
          <ol ref={list} className="shipment-thread" aria-live="polite">
            {(messages ?? []).map((message) => (
              <li key={message.id} data-own={message.from === viewer ? "true" : undefined}>
                <span className="shipment-thread-meta">{message.author} · {when(message.created_at, viewer)}</span>
                <p>{message.body}</p>
              </li>
            ))}
          </ol>
        ) : null}
        <form className="shipment-thread-form" onSubmit={send} aria-busy={busy}>
          <label className="portal-sr-only" htmlFor={`${id}-draft`}>{labels.placeholder}</label>
          <textarea
            id={`${id}-draft`}
            value={draft}
            maxLength={2000}
            rows={2}
            placeholder={labels.placeholder}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit();
            }}
          />
          <OpsButton type="submit" variant="primary" size="sm" disabled={busy || !draft.trim()}>
            <Send size={14} strokeWidth={1.75} aria-hidden="true"/>
            <span>{busy ? labels.sending : labels.send}</span>
          </OpsButton>
        </form>
      </OpsSurface>
    </div>
  );
}
