import PortalShell from "../../../components/PortalShell";

export const metadata = {
  title: "Driver app",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return <PortalShell role="partner">{children}</PortalShell>;
}
