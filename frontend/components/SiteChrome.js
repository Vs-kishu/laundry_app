"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";

// The customer-facing header/footer are hidden inside the admin and driver portals,
// which render their own shells (see PortalShell).
const isPortal = (p) => p.startsWith("/admin") || p === "/partner" || p === "/partner/login";

export default function SiteChrome({ children }) {
  const pathname = usePathname();
  if (isPortal(pathname)) return <main id="main" className="flex-1">{children}</main>;
  return (
    <>
      <Navbar />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
