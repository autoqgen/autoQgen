import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = "mongodb+srv://mishkatcse1_db_user:aYnJ0DSwsZDCchVz@autoqgen.r8lxedi.mongodb.net/AutoQgen?retryWrites=true&w=majority";

async function run() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected successfully to Atlas.");

  const db = mongoose.connection.db;
  if (!db) throw new Error("Database handle unavailable");

  const usersCol = db.collection("users");
  const orgsCol = db.collection("organizations");
  const membersCol = db.collection("organizationmembers");
  const teamsCol = db.collection("teams");

  const passwordHash = await bcrypt.hash("123", 12);
  const now = new Date();

  // 1. Create / Upsert Users
  const userSpecs = [
    {
      email: "superadmin@autoqgen.com",
      name: "AutoQgen Super Admin",
      role: "super_admin",
      status: "active",
      emailVerified: now,
    },
    {
      email: "owner@autoqgen.com",
      name: "AutoQgen Org Owner",
      role: "organization_owner",
      status: "active",
      emailVerified: now,
    },
    {
      email: "teamadmin@autoqgen.com",
      name: "AutoQgen Team Admin",
      role: "team_admin",
      status: "active",
      emailVerified: now,
    },
    {
      email: "teacher@autoqgen.com",
      name: "AutoQgen Teacher",
      role: "teacher",
      status: "active",
      emailVerified: now,
    },
    {
      email: "reviewer@autoqgen.com",
      name: "AutoQgen Reviewer",
      role: "reviewer",
      status: "active",
      emailVerified: now,
    },
    {
      email: "hellomiskat@gmail.com",
      name: "Mishkatul Islam",
      role: "super_admin",
      status: "active",
      emailVerified: now,
    },
    {
      email: "member@autoqgen.com",
      name: "AutoQgen Member",
      role: "member",
      status: "active",
      emailVerified: now,
    },
  ];

  const userDocs = new Map<string, any>();

  for (const spec of userSpecs) {
    const res = await usersCol.findOneAndUpdate(
      { email: spec.email },
      {
        $set: {
          name: spec.name,
          role: spec.role,
          status: spec.status,
          emailVerified: spec.emailVerified,
          password: passwordHash,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    const doc = res?.value ?? (await usersCol.findOne({ email: spec.email }));
    userDocs.set(spec.email, doc);
    console.log(`✓ User ready: ${spec.email} (Role: ${spec.role})`);
  }

  const ownerUser = userDocs.get("owner@autoqgen.com");
  const superAdminUser = userDocs.get("superadmin@autoqgen.com");

  // 2. Create / Upsert Organization
  const orgSlug = "autoqgen-academy";
  const orgRes = await orgsCol.findOneAndUpdate(
    { slug: orgSlug },
    {
      $set: {
        name: "AutoQgen Academy",
        slug: orgSlug,
        owner: ownerUser._id,
        createdBy: superAdminUser._id,
        isActive: true,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  const orgDoc = orgRes?.value ?? (await orgsCol.findOne({ slug: orgSlug }));
  console.log(`✓ Organization ready: AutoQgen Academy (${orgDoc._id})`);

  // Link users to organization
  await usersCol.updateMany(
    { email: { $in: ["owner@autoqgen.com", "teamadmin@autoqgen.com", "teacher@autoqgen.com", "reviewer@autoqgen.com", "member@autoqgen.com"] } },
    { $set: { organization: orgDoc._id } }
  );

  // 3. Create / Upsert Team
  const teamRes = await teamsCol.findOneAndUpdate(
    { organizationId: orgDoc._id, name: "Academic Department" },
    {
      $set: {
        organizationId: orgDoc._id,
        name: "Academic Department",
        description: "Primary academic question setting and reviewing team.",
        createdBy: ownerUser._id,
        isActive: true,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  const teamDoc = teamRes?.value ?? (await teamsCol.findOne({ organizationId: orgDoc._id, name: "Academic Department" }));
  console.log(`✓ Team ready: Academic Department (${teamDoc._id})`);

  // 4. Create / Upsert Organization Members
  const memberSpecs = [
    { email: "owner@autoqgen.com", role: "organization_owner", teamId: null },
    { email: "teamadmin@autoqgen.com", role: "team_admin", teamId: teamDoc._id },
    { email: "teacher@autoqgen.com", role: "teacher", teamId: teamDoc._id },
    { email: "reviewer@autoqgen.com", role: "reviewer", teamId: teamDoc._id },
    { email: "hellomiskat@gmail.com", role: "organization_owner", teamId: null },
    { email: "member@autoqgen.com", role: "member", teamId: null },
  ];

  for (const m of memberSpecs) {
    const u = userDocs.get(m.email);
    await membersCol.findOneAndUpdate(
      { userId: u._id, organizationId: orgDoc._id },
      {
        $set: {
          userId: u._id,
          organizationId: orgDoc._id,
          role: m.role,
          teamId: m.teamId,
          status: "active",
          joinedAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );
    console.log(`✓ OrganizationMember ready: ${m.email} -> ${m.role}`);
  }

  console.log("\nAll accounts successfully created directly in Atlas!");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Error seeding users to Atlas:", err);
  process.exit(1);
});
