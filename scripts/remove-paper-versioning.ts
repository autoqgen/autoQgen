import { Types } from "mongoose";

import { loadEnvFiles } from "./load-env";

loadEnvFiles();

/**
 * One-off cleanup for the removed paper-versioning system.
 *
 *   1. For every regeneration lineage (papers sharing a `rootPaperId`, plus the
 *      root itself), keep only the single "currently used" paper — the active
 *      one with the highest `generationRound` (newest `createdAt` on a tie) —
 *      and HARD-DELETE the superseded rounds together with their QuestionUsage
 *      rows.
 *   2. `$unset` the versioning fields (`version`, `versionHistory`,
 *      `rootPaperId`, `regeneratedFrom`, `generationRound`) from every
 *      surviving QuestionPaper.
 *
 * Never touches Question, taxonomy, or unrelated data. Organization scope is
 * preserved (a lineage never spans organizations). DRY RUN BY DEFAULT — pass
 * `--apply` to write. Idempotent; safe to re-run.
 *
 *   tsx scripts/remove-paper-versioning.ts            # report only
 *   tsx scripts/remove-paper-versioning.ts --apply    # perform the cleanup
 */

const APPLY = process.argv.includes("--apply");

interface RawPaper {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  isActive: boolean;
  title?: string;
  rootPaperId?: Types.ObjectId | null;
  generationRound?: number | null;
  version?: number | null;
  versionHistory?: unknown[] | null;
  createdAt: Date;
}

async function main(): Promise<void> {
  const { connectDB, disconnectDB } = await import("@/lib/db");
  const { QuestionPaper, QuestionUsage } = await import("@/models");

  await connectDB();
  console.log(`Remove paper versioning — ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  // Read the raw docs (the model no longer projects the legacy fields, so go
  // through the native collection).
  const raw = (await QuestionPaper.collection
    .find({}, { projection: { _id: 1, organizationId: 1, isActive: 1, title: 1, rootPaperId: 1, generationRound: 1, version: 1, versionHistory: 1, createdAt: 1 } })
    .toArray()) as unknown as RawPaper[];

  const byId = new Map(raw.map((p) => [p._id.toString(), p]));

  // Group into lineages: key = rootPaperId (or the paper's own id when it has none).
  const lineages = new Map<string, RawPaper[]>();
  for (const p of raw) {
    const key = (p.rootPaperId ?? p._id).toString();
    (lineages.get(key) ?? lineages.set(key, []).get(key)!).push(p);
  }

  const toDelete: Types.ObjectId[] = [];
  let multiRoundLineages = 0;

  for (const [rootKey, members] of lineages) {
    if (members.length < 2) continue; // lone paper — nothing to collapse
    multiRoundLineages += 1;

    const rank = (p: RawPaper) => [
      p.isActive ? 1 : 0,
      p.generationRound ?? 1,
      p.createdAt.getTime(),
    ];
    const survivor = [...members].sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)];
      for (let i = 0; i < ra.length; i += 1) if (ra[i] !== rb[i]) return rb[i]! - ra[i]!;
      return 0;
    })[0]!;

    const rootTitle = byId.get(rootKey)?.title ?? "(root)";
    console.log(
      `lineage ${rootKey} "${rootTitle}": ${members.length} papers → keep ${survivor._id} (round ${survivor.generationRound ?? 1}, ${survivor.isActive ? "active" : "inactive"}), delete ${members.length - 1}`,
    );
    for (const m of members) if (m._id.toString() !== survivor._id.toString()) toDelete.push(m._id);
  }

  const withVersionFields = raw.filter(
    (p) => (p.version ?? 1) > 1 || (p.versionHistory?.length ?? 0) > 0 || p.rootPaperId != null || (p.generationRound ?? 1) > 1,
  ).length;

  console.log(`\nTotal papers: ${raw.length}`);
  console.log(`Regeneration lineages with >1 round: ${multiRoundLineages}`);
  console.log(`Superseded papers to hard-delete: ${toDelete.length}`);
  console.log(`Papers still carrying versioning fields (to $unset): ${withVersionFields}`);

  if (toDelete.length > 0) {
    const usageForDeleted = await QuestionUsage.countDocuments({ questionPaperId: { $in: toDelete } });
    console.log(`QuestionUsage rows attached to superseded papers: ${usageForDeleted}`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — no changes written. Re-run with --apply.`);
    await disconnectDB();
    return;
  }

  if (toDelete.length > 0) {
    const u = await QuestionUsage.deleteMany({ questionPaperId: { $in: toDelete } });
    const d = await QuestionPaper.deleteMany({ _id: { $in: toDelete } });
    console.log(`\nDeleted ${d.deletedCount} superseded papers and ${u.deletedCount} of their usage rows.`);
  }

  const unset = await QuestionPaper.collection.updateMany(
    {},
    { $unset: { version: "", versionHistory: "", rootPaperId: "", regeneratedFrom: "", generationRound: "" } },
  );
  console.log(`Stripped versioning fields from ${unset.modifiedCount} papers.`);

  // Drop the now-unused lineage index if it still exists.
  try {
    await QuestionPaper.collection.dropIndex("organizationId_1_rootPaperId_1_generationRound_-1");
    console.log("Dropped the legacy rootPaperId/generationRound index.");
  } catch {
    /* index already gone */
  }

  console.log(`\nDone. Papers remaining: ${await QuestionPaper.countDocuments({})}`);
  await disconnectDB();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
