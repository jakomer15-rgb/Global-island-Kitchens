# AGENTS.md — how work is organised

Global Island Kitchens W.L.L website and business platform (Kingdom of Bahrain). This file
coordinates the specialist agents in `.claude/agents/` and the skills in `.claude/skills/`. Read it
before starting any task.

## Ground rules (apply to every agent)

1. **Facts:** company information comes only from `docs/BUSINESS_FACTS.md`. Unknown means left out
   and listed in `docs/OPEN_QUESTIONS.md`. Follow the `gik-content-rules` skill.
2. **Materials:** EGGER laminate/melamine and painted MDF only (plus aluminium and glass for
   aluminium kitchens and glass fronts).
3. **Real functionality:** real database persistence, no fake buttons, no forms that don't save, no
   mock APIs presented as real.
4. **No fabrication:** no invented testimonials, prices, project photos, client names without
   permission, or placeholder text presented as real company information.
5. **Security:** server-side validation and permission checks everywhere; secrets only in environment
   variables.
6. **Verification:** never claim something works without running it. Report test numbers and failures.
7. **Approval:** major architectural changes, destructive database commands, production deploys and
   anything sent to customers need the owner's explicit approval.

## Agents

| Agent | Owns | Main skills |
|---|---|---|
| `project-architect` | Requirements, architecture, folder structure, decisions | — |
| `luxury-ui-designer` | Visual design, layouts, typography, motion, RTL | `ui-ux-design`, `frontend-design` |
| `frontend-developer` | Next.js pages and components, forms, i18n | `frontend-design`, `performance-optimization` |
| `backend-developer` | Services, actions, route handlers, auth, uploads, outbox | `backend-architecture`, `api-development` |
| `database-architect` | Prisma schema, migrations, constraints, seeds | `database-management` |
| `admin-dashboard` | `/admin` portal: dashboard, CRM, quotations, projects, CMS | `frontend-design`, `backend-architecture` |
| `seo-specialist` | Metadata, structured data, sitemap, local SEO, analytics consent | `seo-optimization` |
| `security-qa` | Security review, tests, accessibility (reports, doesn't ship features) | `security-auditing`, `automated-testing`, `gik-code-review` |
| `devops` | CI/CD, environments, hosting, monitoring, backups | `deployment`, `documentation` |
| `ai-automation` | AI assistants (drafts only), n8n, email, WhatsApp, consent | `api-development`, `security-auditing` |

Every agent also uses `gik-content-rules` for anything customer-facing, and `documentation` at the
end of its work.

## Workflow per phase

1. `project-architect` writes the phase plan and lists decisions needing approval.
2. Builders (`luxury-ui-designer`, `frontend-developer`, `backend-developer`, `database-architect`,
   `admin-dashboard`, `ai-automation`) implement in small, tested steps. Two agents never edit the
   same files at the same time.
3. `seo-specialist` checks public pages; `security-qa` reviews the phase's diff and runs the suites.
4. Confirmed findings are fixed and re-tested.
5. Docs are updated; the phase summary goes to the owner with what's done, what isn't, and what's
   needed next. The next phase starts only after the owner approves.

## Project map

- `docs/BUSINESS_FACTS.md` — approved company facts, with sources and conflicts
- `docs/OPEN_QUESTIONS.md` — missing business details
- `docs/ARCHITECTURE.md` — stack, structure, site map, auth, data flows, decisions
- `docs/DATA_MODEL.md` — database design
- `docs/ROADMAP.md` — phases and gates

## Commands

Defined in Phase 2 when the app is scaffolded (`npm run dev`, `lint`, `typecheck`, `test`,
`test:db`, `test:e2e`, `build`).
