import Link from "next/link";
import { LogoMark } from "../components/Logo";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <LogoMark size={72} className="mx-auto" />
        <h1 className="mt-6 text-4xl font-extrabold">Lost in the wash</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">We couldn&apos;t find that page. Let&apos;s get you back to somewhere clean.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="btn btn-primary">Go home</Link>
          <Link href="/book" className="btn btn-secondary">Book a pickup</Link>
        </div>
      </div>
    </div>
  );
}
