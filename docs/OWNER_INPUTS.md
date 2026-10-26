# What the owner needs to provide to launch

The software is built. These items are decisions, accounts and real content that only the company can supply.
Nothing below was invented: where a fact is missing, the site leaves it out. Numbers refer to
[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), which has the full list.

## Accounts (needed to go live)

| Need                                          | Why                                                                    | Notes                                      |
| --------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| Domain name                                   | The site address, email sending, search engines                        | Registered in the company's name           |
| Hosting (Vercel or another Node host)         | Runs the website and admin                                             | A paid plan for the 5-minute scheduled job |
| Managed PostgreSQL (Neon)                     | All business data                                                      | Enable point-in-time recovery              |
| Cloudflare R2                                 | Customer files, quotation PDFs, database backups (two private buckets) |                                            |
| Email sending (Resend)                        | Enquiry emails to the team and confirmations to customers              | Needs the domain's DNS records             |
| GitHub repository                             | Source code, tests, nightly backup                                     | Owned by the company                       |
| A browser service for PDFs (or a Chrome host) | Quotation PDFs (OPEN_QUESTIONS 52)                                     | Decide with whoever hosts                  |
| Who receives alerts                           | Uptime and error alerts                                                | A named person and email/phone             |

## Business decisions

- VAT: registered or not, number and rate (48). Quotation terms in English and Arabic (49), default validity (50).
- Whether designers get any special terms, and how designers are approved (58, 59).
- Which phone has WhatsApp, opening days, the Arabic company name (see Company questions).
- The materials library: the EGGER décor codes and painted MDF colours you actually offer (44). Each is checked against
  EGGER's current range before it is shown.
- Pricing rates, if you want automatic estimates later (51). Until then every price is typed by staff.

## Content and permissions

- Logo files; higher-resolution originals of the profile photographs and photos of the other projects (45; the profile photos are cleared and live); client names only with
  permission; real testimonials only with written permission (see Testimonials questions).
- A fluent Arabic reader to review all Arabic text (47, 53, 61, 68).
- Privacy policy and terms of use checked or rewritten by the owner or their adviser.

## Optional, off until you decide

- AI assistants and the public furniture assistant: approval to send text to Anthropic, an account and a spending limit (63-65).
- n8n, the WhatsApp Business account and message templates, and what automation may send (66, 67).
- Analytics, and a CAPTCHA if spam appears (54, 55).

## Two things to do soon after launch

- Run the restore rehearsal and keep its result (docs/HANDOVER.md).
- Measure mobile speed on the real host and decide whether a faster setup is worth it (57).
