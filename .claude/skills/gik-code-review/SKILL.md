---
name: gik-code-review
description: How to review a change in the Global Island Kitchens codebase — correctness, permissions, data integrity, content rules, tests and readability. Use before committing a phase or when asked to review a diff.
---

# Code review

Review the diff (`git diff main...HEAD` or the staged changes), not the whole codebase.

## Order of questions

1. **Correctness**: does it do what the phase requires? Edge cases: empty, very long, Arabic text,
   unusual dates or timezones (Asia/Bahrain), BHD three decimals.
2. **Security**: permission check, ownership filter, validation, no secrets (see `security-auditing`).
3. **Data integrity**: transaction around multi-step writes, constraints for must-hold rules, a
   migration for every schema change.
4. **Content rules**: no invented facts, materials wording, photo and testimonial rules
   (`gik-content-rules`).
5. **Tests**: the rule or fix is covered; tests actually ran and passed.
6. **Readability**: matches surrounding code, clear names, no dead code, comments explain why.
7. **Performance**: no N+1 queries, no heavy client bundles on public pages.

## Reporting

List findings most severe first, each with file:line, what goes wrong, and a suggested fix. Separate
"must fix" from "suggestion". If nothing is wrong, say so plainly.
