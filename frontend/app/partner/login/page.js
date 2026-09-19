import { Suspense } from "react";
import StaffLogin from "../../../components/StaffLogin";

export const metadata = { title: "Driver login", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StaffLogin role="partner" />
    </Suspense>
  );
}
