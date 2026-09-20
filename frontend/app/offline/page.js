import { LogoMark } from "../../components/Logo";

export const metadata = { title: "You're offline", robots: { index: false, follow: false } };

// Served by the service worker when a page can't be reached.
export default function OfflinePage() {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <LogoMark size={72} className="mx-auto" />
        <h1 className="mt-6 text-3xl font-extrabold">You&apos;re offline</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Check your internet connection. Live tracking and orders need a connection, and will resume as soon as you&apos;re back online.
        </p>
      </div>
    </div>
  );
}
