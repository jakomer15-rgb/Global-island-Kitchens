// Seed: permissions, system roles, settings and the portfolio, from verified facts only
// (docs/BUSINESS_FACTS.md). Idempotent and safe to run on every deploy:
// - role permissions are set when a role is created; afterwards only newly introduced permissions
//   are granted (per the defaults), so changes the owner makes in the admin are kept. The owner
//   role always has every permission.
// - settings and portfolio projects are created if missing, never overwritten.
// Never seeds testimonials, prices, photos or customer data.
import { createPrismaClient } from "../src/server/db/client";
import { permissions, roleDefinitions } from "../src/server/auth/permissions";
import { settingDefaults } from "../src/lib/site-settings";
import { projects } from "../src/content/projects";

const db = createPrismaClient();

async function main() {
  // One transaction: if anything fails, new permissions aren't recorded without their grants.
  const newKeys = await db.$transaction(async (tx) => {
    const existingKeys = new Set((await tx.permission.findMany({ select: { key: true } })).map((p) => p.key));
    const added = new Set(Object.keys(permissions).filter((k) => !existingKeys.has(k)));
    for (const [key, description] of Object.entries(permissions)) {
      await tx.permission.upsert({ where: { key }, update: { description }, create: { key, description } });
    }
    for (const role of roleDefinitions) {
      const existing = await tx.role.findUnique({ where: { key: role.key } });
      const saved = await tx.role.upsert({
        where: { key: role.key },
        update: { name: role.name, description: role.description, system: true },
        create: { key: role.key, name: role.name, description: role.description, system: true },
      });
      const grant =
        role.key === "owner" || !existing ? role.permissions : role.permissions.filter((p) => added.has(p));
      if (grant.length) {
        await tx.rolePermission.createMany({
          data: grant.map((permissionKey) => ({ roleId: saved.id, permissionKey })),
          skipDuplicates: true,
        });
      }
    }
    return added;
  });

  // Phase 4 stored contact details under finer keys; they are replaced by the grouped settings.
  await db.siteSetting.deleteMany({
    where: {
      key: {
        in: [
          "contact.phones",
          "contact.email",
          "contact.instagram",
          "location.showroom",
          "location.headOffice",
        ],
      },
    },
  });
  for (const [key, value] of Object.entries(settingDefaults)) {
    await db.siteSetting.upsert({ where: { key }, update: {}, create: { key, value: value as object } });
  }

  let created = 0;
  for (const [i, p] of projects.entries()) {
    const exists = await db.portfolioProject.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (exists) continue;
    await db.portfolioProject.create({
      data: {
        slug: p.slug,
        segment: p.segment,
        nameEn: p.name.en,
        nameAr: p.name.ar,
        locationEn: p.location.en,
        locationAr: p.location.ar,
        sizeEn: p.size?.en ?? null,
        sizeAr: p.size?.ar ?? null,
        scopeEn: p.scopeText.en,
        scopeAr: p.scopeText.ar,
        scopeTags: p.scope,
        featured: Boolean(p.featured),
        sortOrder: i,
      },
    });
    created++;
  }

  console.log(
    `Seeded ${Object.keys(permissions).length} permissions (${newKeys.size} new), ${roleDefinitions.length} roles, ${Object.keys(settingDefaults).length} settings, ${created} new portfolio projects.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
