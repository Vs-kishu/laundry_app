import Link from "next/link";
import Icon from "../components/Icons";
import TrackingMock from "../components/TrackingMock";
import { API_URL, SITE } from "../lib/site";
import { money } from "../lib/format";

// Static page regenerated at most every 5 minutes (prices come from the API).
export const revalidate = 300;

export const metadata = {
  title: { absolute: `${SITE.name} - Laundry pickup & delivery with live tracking` },
  description: SITE.description,
  alternates: { canonical: "/" },
};

const FALLBACK_SERVICES = [
  { _id: "1", name: "Wash & Fold", description: "Everyday clothes washed, dried and neatly folded.", pricePerUnit: 49, unit: "kg", category: "wash_fold" },
  { _id: "2", name: "Wash & Iron", description: "Washed and pressed, ready to wear.", pricePerUnit: 69, unit: "kg", category: "wash_iron" },
  { _id: "3", name: "Dry Cleaning", description: "Suits, silks and delicates handled with care.", pricePerUnit: 150, unit: "item", category: "dry_clean" },
  { _id: "4", name: "Iron Only", description: "Already clean? We'll press it crisp.", pricePerUnit: 20, unit: "item", category: "iron_only" },
];

async function getServices() {
  try {
    const res = await fetch(`${API_URL}/services`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    return data.length ? data : FALLBACK_SERVICES;
  } catch {
    return FALLBACK_SERVICES;
  }
}

const CATEGORY_ICON = { wash_fold: "wash", wash_iron: "shirt", dry_clean: "sparkles", iron_only: "iron" };

const STEPS = [
  { icon: "pin", title: "Drop a pin", text: "Choose your items and pin your address on the map. Pick express (about 45 min) or a slot that suits you." },
  { icon: "bike", title: "Partner on the way", text: "A nearby Laundry Point partner accepts your order. Watch them ride to you on a live map with an ETA." },
  { icon: "key", title: "Share the OTP", text: "Hand over your clothes and read out your 4-digit pickup code. No code, no handover." },
  { icon: "wash", title: "Cleaned at our store", text: "Your clothes are washed, pressed and packed by our team - usually within 48 hours." },
  { icon: "home", title: "Delivered live-tracked", text: "A delivery partner brings them back. Track the ride, share the delivery OTP, done." },
];

const FEATURES = [
  { icon: "map", title: "Live GPS tracking", text: "See your partner move on the map for both legs - home to store and store to home." },
  { icon: "bolt", title: "Express pickup", text: "Need it now? Express orders are matched to the nearest available partner first." },
  { icon: "shield", title: "OTP-secured handover", text: "Every pickup and delivery is verified with a one-time code only you can share." },
  { icon: "clock", title: "Clear timings", text: "A live ETA and a step-by-step timeline, so you always know what happens next." },
  { icon: "wallet", title: "Simple pricing", text: "Pay per kg or per item. Delivery is free on orders above ₹299. Pay on delivery." },
  { icon: "leaf", title: "Gentle on fabrics", text: "Separate wash cycles, fabric-safe detergents and careful pressing for every order." },
];

const FAQS = [
  { q: "How fast can you pick up my laundry?", a: "Express orders are usually picked up within about 45 minutes, depending on partner availability near you. You can also schedule a pickup slot for later today or up to 14 days ahead." },
  { q: "Can I really track my pickup and delivery live?", a: "Yes. Once a partner accepts your order you can watch their live location and ETA on a map, both while they come to you and while they bring your clean clothes back." },
  { q: "What is the OTP for?", a: "Each order has a 4-digit pickup code and a 4-digit delivery code. You only share them in person, so your clothes can't be handed to or collected by the wrong person." },
  { q: "How long does laundry take?", a: "Wash & Fold and Wash & Iron are typically delivered within 48 hours of pickup. Dry cleaning can take a little longer depending on the garment." },
  { q: "How do I pay?", a: "Pay on delivery once you've received your clean clothes. Delivery is free on orders above ₹299; a small fee applies below that." },
  { q: "Which areas do you serve?", a: "We serve addresses within our store's delivery radius. Drop a pin while booking and we'll tell you straight away whether your location is covered." },
];

function JsonLd({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export default async function HomePage() {
  const services = await getServices();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: "en-IN",
      },
      {
        "@type": "DryCleaningOrLaundry",
        "@id": `${SITE.url}/#business`,
        name: SITE.name,
        url: SITE.url,
        image: `${SITE.url}/opengraph-image`,
        description: SITE.description,
        priceRange: "₹₹",
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Laundry services",
          itemListElement: services.map((s) => ({
            "@type": "Offer",
            priceCurrency: "INR",
            price: s.pricePerUnit,
            itemOffered: { "@type": "Service", name: s.name, description: s.description },
          })),
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 top-20 h-[24rem] w-[24rem] rounded-full bg-aqua/15 blur-3xl" aria-hidden="true" />

        <div className="container-x relative grid items-center gap-14 pb-20 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="animate-fade-up">
            <span className="chip border border-brand/20 bg-brand/10 text-link">
              <Icon name="bolt" className="h-3.5 w-3.5" /> Express pickup in ~45 minutes
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              Laundry picked up in minutes. <span className="gradient-text">Tracked live.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Pin your location, and a Laundry Point partner rides to your door. Watch them on the map, hand over with a
              secure OTP, and get fresh, folded clothes delivered back.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book" className="btn btn-primary px-8 py-3.5 text-base">
                Book a pickup <Icon name="chevron" className="h-4 w-4" />
              </Link>
              <Link href="/#how" className="btn btn-secondary px-8 py-3.5 text-base">
                How it works
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
              {["Live GPS tracking", "OTP-secured handover", "Free delivery above ₹299"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success">
                    <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-float mx-auto w-full max-w-md lg:max-w-none">
            <TrackingMock />
          </div>
        </div>
      </section>

      {/* ---------- Stats ---------- */}
      <section aria-label="Highlights" className="border-y border-line bg-surface">
        <dl className="container-x grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          {[
            ["~45 min", "Express pickup"],
            ["48 hrs", "Typical turnaround"],
            ["Live", "GPS partner tracking"],
            ["4-digit", "OTP on every handover"],
          ].map(([k, v]) => (
            <div key={v} className="text-center">
              <dt className="font-display text-3xl font-extrabold gradient-text">{k}</dt>
              <dd className="mt-1 text-sm text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="container-x scroll-mt-24 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-link">How it works</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">From your door to our store and back</h2>
          <p className="mt-3 text-muted">Five simple steps, every one of them visible in the app.</p>
        </div>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card relative p-6 transition hover:-translate-y-1 hover:shadow-lift">
              <span className="absolute right-5 top-4 font-display text-4xl font-extrabold text-line">{i + 1}</span>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-aqua text-white shadow-glow">
                <Icon name={s.icon} />
              </span>
              <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Services ---------- */}
      <section id="services" className="scroll-mt-24 bg-soft/60 py-20">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-link">Services &amp; pricing</p>
            <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Honest prices, no surprises</h2>
            <p className="mt-3 text-muted">Pay per kg or per item. Delivery is free on orders above {money(299)}.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <article key={s._id} className="card flex flex-col p-6 transition hover:-translate-y-1 hover:shadow-lift">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
                  <Icon name={CATEGORY_ICON[s.category] || "shirt"} />
                </span>
                <h3 className="mt-5 text-lg font-bold">{s.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.description}</p>
                <p className="mt-5 font-display text-2xl font-extrabold">
                  {money(s.pricePerUnit)}
                  <span className="text-sm font-medium text-muted"> / {s.unit}</span>
                </p>
              </article>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/book" className="btn btn-primary px-8">
              Start a booking
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Why us ---------- */}
      <section className="container-x py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-link">Why Laundry Point</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Built like the apps you already love</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4 rounded-3xl border border-line bg-surface p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-aqua/15 text-aqua">
                <Icon name={f.icon} />
              </span>
              <div>
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Partner CTA ---------- */}
      <section className="container-x">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0B1B3A] via-[#1E4FD8] to-[#12C2B5] p-8 text-white sm:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="relative max-w-xl">
            <h2 className="text-3xl font-extrabold sm:text-4xl">Ride with Laundry Point</h2>
            <p className="mt-3 text-white/85">
              Earn on your own schedule. Accept nearby pickups and deliveries, navigate with one tap, and get paid for every
              completed task.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/partner/signup" className="btn bg-white text-[#0B1B3A] hover:bg-white/90">
                Become a delivery partner
              </Link>
              <Link href="/login" className="btn border border-white/40 text-white hover:bg-white/10">
                Partner login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="container-x scroll-mt-24 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Frequently asked questions</h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group card rounded-2xl px-6 py-4 shadow-none open:shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <Icon name="plus" className="h-5 w-5 shrink-0 text-brand transition group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
