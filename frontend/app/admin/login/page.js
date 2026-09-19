import { Suspense } from "react";
import StaffLogin from "../../../components/StaffLogin";

export const metadata = { title: "Admin login", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StaffLogin role="admin" />
    </Suspense>
  );
}
