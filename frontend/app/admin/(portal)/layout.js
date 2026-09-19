import PortalShell from "../../../components/PortalShell";

export const metadata = {
  title: "Admin console",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return <PortalShell role="admin">{children}</PortalShell>;
}
