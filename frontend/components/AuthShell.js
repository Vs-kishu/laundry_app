import Logo from "./Logo";
import Icon from "./Icons";

// Two-panel layout for login / signup screens: brand panel (desktop) + form.
export default function AuthShell({ title, subtitle, children, footer, aside }) {
  return (
    <div className="container-x grid min-h-[calc(100vh-10rem)] items-center gap-10 py-10 lg:grid-cols-2 lg:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
        {footer && <p className="mt-5 text-center text-sm text-muted">{footer}</p>}
      </div>

      <aside className="relative hidden overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0B1B3A] via-[#1E4FD8] to-[#12C2B5] p-10 text-white lg:block">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="rounded-2xl bg-white/95 px-3 py-2 w-fit">
          <Logo size={30} textClass="text-lg" />
        </div>
        <h2 className="mt-10 text-3xl font-extrabold leading-tight">{aside?.title || "Fresh clothes, tracked to your door."}</h2>
        <ul className="mt-8 space-y-4">
          {(aside?.points || [
            ["bolt", "Express pickup in about 45 minutes"],
            ["map", "Watch your partner live on the map"],
            ["shield", "OTP-secured pickup and delivery"],
          ]).map(([icon, text]) => (
            <li key={text} className="flex items-center gap-3 text-white/90">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15">
                <Icon name={icon} className="h-[18px] w-[18px]" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
