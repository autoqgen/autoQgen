import type { ReactNode } from "react";

import { OrganizationSubNav } from "@/components/organization/OrganizationSubNav";

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <OrganizationSubNav />
      {children}
    </div>
  );
}
