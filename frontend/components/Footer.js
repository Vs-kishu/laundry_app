import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Doorstep laundry with live tracking. Book in under a minute, watch your pickup partner arrive on the
            map, and get fresh clothes back at your door.
          </p>
        </div>
        <nav aria-label="Company">
          <h2 className="text-sm font-semibold">Laundry Point</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link href="/#how" className="hover:text-ink">How it works</Link></li>
            <li><Link href="/#services" className="hover:text-ink">Services &amp; pricing</Link></li>
            <li><Link href="/#faq" className="hover:text-ink">FAQ</Link></li>
            <li><Link href="/book" className="hover:text-ink">Book a pickup</Link></li>
          </ul>
        </nav>
        <nav aria-label="Account">
          <h2 className="text-sm font-semibold">Join us</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link href="/signup" className="hover:text-ink">Create an account</Link></li>
            <li><Link href="/login" className="hover:text-ink">Log in</Link></li>
            <li><Link href="/partner/signup" className="hover:text-ink">Become a delivery partner</Link></li>
            <li><Link href="/partner/login" className="hover:text-ink">Driver login</Link></li>
            <li><Link href="/admin/login" className="hover:text-ink">Admin login</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="container-x py-5 text-xs text-muted">
          &copy; {new Date().getFullYear()} Laundry Point. Map data &copy; OpenStreetMap contributors.
        </p>
      </div>
    </footer>
  );
}
