import Icon from "./Icons";
import { STATUS_META } from "../lib/constants";

export function StatusChip({ status }) {
  const meta = STATUS_META[status] || { short: status, tone: "bg-soft text-ink" };
  return <span className={`chip ${meta.tone}`}>{meta.short}</span>;
}

export function Alert({ children, tone = "danger" }) {
  const tones = {
    danger: "border-danger/30 bg-danger/10 text-danger",
    success: "border-success/30 bg-success/10 text-success",
    info: "border-brand/30 bg-brand/10 text-link",
    warn: "border-sun/50 bg-sun/20 text-ink",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>
      <Icon name={tone === "success" ? "check" : "alert"} className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ className = "h-5 w-5" }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} role="status" aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-brand">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function EmptyState({ icon = "package", title, children, action }) {
  return (
    <div className="card border-dashed p-10 text-center shadow-none">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
