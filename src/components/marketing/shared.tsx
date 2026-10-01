import type { ReactNode } from "react";

/** Consistent container width and horizontal padding for every section. */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
      {children}
    </span>
  );
}

export function MarketingHeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(226_232_240/0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgb(226_232_240/0.3)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)] dark:bg-[linear-gradient(to_right,rgb(148_163_184/0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgb(148_163_184/0.055)_1px,transparent_1px)]"
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">
        {title}
      </h2>
      {description ? <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{description}</p> : null}
    </div>
  );
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] text-slate-600 uppercase shadow-sm backdrop-blur-sm ${className}`}
    >
      {children}
    </span>
  );
}

export function MarketingCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.18)] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.1),_transparent_48%),linear-gradient(to_bottom,_rgb(255,255,255),_rgb(248,250,252))] py-20 sm:py-24 dark:bg-slate-950 dark:bg-none">
      <MarketingHeroBackdrop />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="mt-5 max-w-3xl font-display text-5xl tracking-[-0.06em] text-slate-900 sm:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{description}</p>
            {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
