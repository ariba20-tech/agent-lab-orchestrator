import type { SpanRecord } from "./types";

function hex(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
export const newTraceId = () => hex(16);
export const newSpanId = () => hex(8);

/**
 * Minimal OpenTelemetry-shaped tracer. Spans are collected in memory and
 * persisted by the caller. Wall-clock times come from Date.now(); durations
 * use performance.now() for sub-ms precision.
 */
export class Tracer {
  readonly traceId: string;
  readonly spans: SpanRecord[] = [];
  private readonly epoch = Date.now();
  private readonly perf0 = performance.now();
  constructor(traceId = newTraceId()) {
    this.traceId = traceId;
  }
  now() {
    return performance.now() - this.perf0;
  }
  start(name: string, parent: ActiveSpan | null, attributes: Record<string, unknown> = {}) {
    return new ActiveSpan(this, name, parent?.spanId ?? null, attributes);
  }
  record(s: SpanRecord) {
    this.spans.push(s);
  }
  iso(ms: number) {
    return new Date(this.epoch + ms).toISOString();
  }
}

export class ActiveSpan {
  readonly spanId = newSpanId();
  readonly startMs: number;
  endMs: number | null = null;
  attributes: Record<string, unknown>;
  events: SpanRecord["events"] = [];
  agentKey?: string;
  taskKey?: string;
  constructor(
    private tracer: Tracer,
    readonly name: string,
    readonly parentSpanId: string | null,
    attributes: Record<string, unknown>,
  ) {
    this.startMs = tracer.now();
    this.attributes = { ...attributes };
  }
  set(attrs: Record<string, unknown>) {
    Object.assign(this.attributes, attrs);
    return this;
  }
  event(name: string, attributes?: Record<string, unknown>) {
    this.events.push({ name, time: this.tracer.iso(this.tracer.now()), ...(attributes ? { attributes } : {}) });
  }
  end(status: "ok" | "error" = "ok", attrs: Record<string, unknown> = {}) {
    if (this.endMs !== null) return this.endMs - this.startMs;
    this.endMs = this.tracer.now();
    Object.assign(this.attributes, attrs);
    this.tracer.record({
      span_id: this.spanId,
      parent_span_id: this.parentSpanId,
      operation_name: this.name,
      start_ms: this.startMs,
      end_ms: this.endMs,
      start_time: this.tracer.iso(this.startMs),
      end_time: this.tracer.iso(this.endMs),
      duration_ms: this.endMs - this.startMs,
      status,
      attributes: this.attributes,
      events: this.events,
      ...(this.agentKey ? { agent_key: this.agentKey } : {}),
      ...(this.taskKey ? { task_key: this.taskKey } : {}),
    });
    return this.endMs - this.startMs;
  }
}
