import { loadEnvFiles } from "./load-env";

loadEnvFiles();

/**
 * Backfills OrganizationMember rows from the pre-existing User.organization
 * pointer, for accounts that were assigned an organization before this
 * feature existed (e.g. via scripts/seed-demo.ts).
 *
 * Purely additive: never touches User.role or User.organization, and every
 * write is an upsert keyed on the unique (userId, organizationId) index, so
 * this script is safe to run repeatedly (including in production, unlike the
 * dev-only seed scripts) as new users pick up an organization pointer before
 * a real membership record exists for them.
 */

async function main(): Promise<void> {
  const { connectDB, disconnectDB } = await import("@/lib/db");
  const { User, Organization, OrganizationMember } = await import("@/models");
  const { ORG_ROLES } = await import("@/types/organization");

  await connectDB();
  console.log("Connected. Backfilling organization memberships…");

  const orgRoles: readonly string[] = ORG_ROLES;

  const usersWithOrg = await User.find({ organization: { $ne: null } })
    .select("_id role organization createdAt")
    .lean()
    .exec();

  let created = 0;
  let updated = 0;

  for (const user of usersWithOrg) {
    const role = orgRoles.includes(user.role) ? user.role : "teacher";

    const result = await OrganizationMember.updateOne(
      { userId: user._id, organizationId: user.organization },
      {
        $set: { role, status: "active" },
        $setOnInsert: { joinedAt: user.createdAt, invitedBy: null, teamId: null },
      },
      { upsert: true },
    ).exec();

    if (result.upsertedCount > 0) created += 1;
    else if (result.modifiedCount > 0) updated += 1;
  }

  // Every organization's recorded owner must hold the organization_owner
  // membership role, regardless of what role the loop above assigned them.
  const organizationsWithOwner = await Organization.find({ owner: { $ne: null } })
    .select("_id owner")
    .lean()
    .exec();

  let ownersFixed = 0;
  for (const org of organizationsWithOwner) {
    const result = await OrganizationMember.updateOne(
      { userId: org.owner, organizationId: org._id },
      { $set: { role: "organization_owner", status: "active" }, $setOnInsert: { joinedAt: new Date(), invitedBy: null, teamId: null } },
      { upsert: true },
    ).exec();
    if (result.modifiedCount > 0 || result.upsertedCount > 0) ownersFixed += 1;
  }

  console.log("");
  console.log("Migration complete.");
  console.log(`  Users with an organization pointer: ${usersWithOrg.length}`);
  console.log(`  Memberships created: ${created}, updated: ${updated}`);
  console.log(`  Organization owners reconciled: ${ownersFixed}`);
  console.log("");

  await disconnectDB();
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
