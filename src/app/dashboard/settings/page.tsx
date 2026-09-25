import type { Metadata } from "next";

import ProfileSettings from "@/components/dashboard/ProfileSettings";
import { requireAuth } from "@/lib/auth/session";
import { authService } from "@/lib/services/auth.service";
import { resolveDisplayRole } from "@/lib/auth/role-display";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAuth();
  const profile = await authService.getProfile(user);
  const displayRole = await resolveDisplayRole(user);

  return (
    <ProfileSettings
      profile={{
        id: profile.id,
        name: profile.name,
        email: profile.email,
        image: profile.image,
        role: displayRole,
        status: profile.status,
      }}
    />
  );
}
