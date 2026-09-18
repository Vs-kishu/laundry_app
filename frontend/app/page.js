import Link from "next/link";

const steps = [
  {
    label: "Schedule",
    text: "Pick a pickup window that fits your day — as soon as tomorrow morning.",
  },
  {
    label: "Hand off",
    text: "Leave your bag at the door or hand it to your driver. No sorting needed.",
  },
  {
    label: "Wear again",
    text: "Clean, folded, and back at your door within 48 hours.",
  },
];

const services = [
  { name: "Wash & Fold", price: "₹49/kg", detail: "Everyday clothes, washed and folded." },
  { name: "Wash & Iron", price: "₹69/kg", detail: "Washed and pressed, ready to wear." },
  { name: "Dry Cleaning", price: "From ₹150/item", detail: "Suits, delicates, and formal wear." },
  { name: "Iron Only", price: "₹20/item", detail: "Already clean, just needs a press." },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 md:pt-24">
        <p className="font-display text-lg text-soap">Neighborhood laundry, picked up at your door</p>
        <h1 className="mt-4 max-w-2xl font-display text-5xl leading-[1.05] text-ink md:text-6xl">
          Your laundry, done while you get on with your day.
        </h1>
        <p className="mt-6 max-w-md text-ink/70">
          Basin picks up, washes, and returns your clothes within 48 hours.
          No queues, no folding, no lost socks.
        </p>
        <Link
          href="/book"
          className="mt-8 inline-block rounded-full bg-rust px-7 py-3 text-canvas hover:bg-rust/90 transition-colors"
        >
          Book a pickup
        </Link>
      </section>

      {/* How it works */}
      <section className="border-y border-ink/10 bg-bubble/50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-10 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.label}>
                <p className="font-display text-3xl text-soap">{i + 1}</p>
                <h3 className="mt-2 font-display text-xl text-ink">{step.label}</h3>
                <p className="mt-2 text-sm text-ink/70">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="font-display text-3xl text-ink">Services & pricing</h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 md:grid-cols-2">
          {services.map((service) => (
            <div key={service.name} className="bg-canvas p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-xl text-ink">{service.name}</h3>
                <span className="text-soap">{service.price}</span>
              </div>
              <p className="mt-2 text-sm text-ink/70">{service.detail}</p>
            </div>
          ))}
        </div>
        <Link
          href="/book"
          className="mt-8 inline-block rounded-full border border-ink/20 px-6 py-2.5 text-ink hover:bg-ink hover:text-canvas transition-colors"
        >
          Start a booking
        </Link>
      </section>
    </div>
  );
}
