import Icon from "./Icons";
import { STATUS_META, TIMELINE_STEPS } from "../lib/constants";
import { timeOnly } from "../lib/format";

// Vertical timeline: done steps ticked with their time, current step highlighted, rest muted.
export default function StatusTimeline({ order }) {
  const reached = new Map((order.timeline || []).map((t) => [t.status, t.at]));
  const currentIdx = TIMELINE_STEPS.indexOf(order.status);
  const cancelled = order.status === "cancelled";

  return (
    <ol className="relative space-y-0" aria-label="Order progress">
      {TIMELINE_STEPS.map((step, i) => {
        const done = reached.has(step) && (i < currentIdx || order.status === "delivered");
        const current = !cancelled && i === currentIdx && order.status !== "delivered";
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0" aria-current={current ? "step" : undefined}>
            {i < TIMELINE_STEPS.length - 1 && (
              <span className={`absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-0.5 ${done ? "bg-brand" : "bg-line"}`} aria-hidden="true" />
            )}
            <span
              className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs ${
                done
                  ? "border-brand bg-brand text-white"
                  : current
                  ? "border-brand bg-surface text-brand"
                  : "border-line bg-surface text-muted"
              }`}
            >
              {done ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : current ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" /> : i + 1}
            </span>
            <div className="pt-1">
              <p className={`text-sm font-semibold ${done || current ? "text-ink" : "text-muted"}`}>{STATUS_META[step].label}</p>
              {reached.has(step) && <p className="text-xs text-muted">{timeOnly(reached.get(step))}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
