// Creates the first owner account (or another staff account) from the command line.
//   npm run admin:create -- --email you@example.com --name "Your Name" [--role owner]
// The password is read from the GIK_ADMIN_PASSWORD environment variable, or prompted for (hidden),
// so it never appears in shell history.
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { createStaffUser } from "../src/server/auth/accounts";
import { createPrismaClient } from "../src/server/db/client";

if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
    if (s.startsWith(question)) write.call(rl, s);
  };
  return new Promise((resolve) =>
    rl.question(question, (answer) => (rl.close(), process.stdout.write("\n"), resolve(answer))),
  );
}

async function main() {
  const email = arg("email");
  const name = arg("name");
  const role = arg("role") ?? "owner";
  if (!email || !name) {
    console.error('Usage: npm run admin:create -- --email you@example.com --name "Your Name" [--role owner]');
    process.exit(1);
  }
  const password = process.env.GIK_ADMIN_PASSWORD ?? (await promptHidden("Password (12+ characters): "));
  const db = createPrismaClient();
  try {
    const id = await db.$transaction((tx) =>
      createStaffUser(tx, { email, name, password, roleKeys: [role], actorId: null, via: "cli" }),
    );
    console.log(`Created ${role} account ${email.toLowerCase()} (${id}). Sign in at /admin/sign-in.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
