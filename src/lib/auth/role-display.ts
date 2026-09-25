import type { AuthContext } from "@/lib/auth/session";
import { getMembership, resolveCurrentOrganizationId } from "@/lib/auth/org-session";

/**
 * Resolves the role shown in account/profile UI. Authorization continues to
 * use the dedicated global and organization permission helpers.
 */
export async function resolveDisplayRole(user: AuthContext): Promise<string> {
  if (user.role === "super_admin") return "Super Admin";

  const organizationId = await resolveCurrentOrganizationId(user);
  if (!organizationId) return user.role;

  const membership = await getMembership(user.objectId, organizationId);
  return membership?.role ?? user.role;
}
