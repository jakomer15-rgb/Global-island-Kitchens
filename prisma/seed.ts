// Seed: permissions, system roles and settings from verified facts only (docs/BUSINESS_FACTS.md).
// Idempotent: safe to run repeatedly. Never seeds testimonials, prices, photos or customer data.
import { company } from "../src/config/company";
import { createPrismaClient } from "../src/server/db/client";
import { permissions, roleDefinitions } from "../src/server/auth/permissions";

const db = createPrismaClient();

async function main() {
  for (const [key, description] of Object.entries(permissions)) {
    await db.permission.upsert({ where: { key }, update: { description }, create: { key, description } });
  }

  for (const role of roleDefinitions) {
    const saved = await db.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, system: true },
      create: { key: role.key, name: role.name, description: role.description, system: true },
    });
    await db.rolePermission.deleteMany({ where: { roleId: saved.id } });
    await db.rolePermission.createMany({
      data: role.permissions.map((permissionKey) => ({ roleId: saved.id, permissionKey })),
    });
  }

  const settings: Record<string, unknown> = {
    "contact.phones": company.phones,
    "contact.email": company.email,
    "contact.instagram": company.instagram,
    "location.showroom": company.showroom,
    "location.headOffice": company.headOffice,
  };
  for (const [key, value] of Object.entries(settings)) {
    // Create only: later edits made in the admin are never overwritten by a re-seed.
    await db.siteSetting.upsert({ where: { key }, update: {}, create: { key, value: value as object } });
  }

  console.log(
    `Seeded ${Object.keys(permissions).length} permissions, ${roleDefinitions.length} roles, ${Object.keys(settings).length} settings.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
