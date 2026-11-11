# Staff guide: the admin portal

For the owner and the team. Sign in at `https://<your site>/admin/sign-in`. What you see in the left menu
depends on your role; if a page says "no access", ask the owner to change your role (Staff → Roles and
permissions).

## Your first day

1. Sign in with the account the owner created for you. Staff accounts are made by the owner in **Staff**;
   there is no public sign-up. The owner gives you a temporary password: change it with the owner's help if
   you suspect anyone saw it (the owner can reset it in Staff).
2. Open **Notifications** (in the top bar) for leads and messages assigned to you.
3. The **Dashboard** shows new leads, follow-ups due, open quotations and sales figures.

## AI Business Automation Centre

The **Automation Centre** group in the menu (owner, general manager, sales manager). The button at the
top right switches the Centre between English and Arabic; the rest of the admin stays English for now.

- **Overview:** today's enquiries, leads not yet contacted, overdue follow-ups, HOT / WARM / COLD open
  leads, quotations awaiting an answer, approvals waiting and failed deliveries. Every number is counted
  from the database when the page opens. The four AI agents and the 14 areas of the Centre are listed:
  areas not built yet say which stage builds them.
- **Approvals:** everything waiting for a person's decision (AI drafts, designer registrations). **Review**
  opens the item's own screen; nothing is sent or published from this list.
- **AI Sales Agent** and **Company knowledge base:** the existing AI sales and AI agent screens.
- **Integrations:** each outside service (Claude, email, file storage, WhatsApp, n8n, the scheduled job,
  and the planned Meta, LinkedIn, Google Places, Canva and TikTok) with its real status. The keys
  themselves are never shown, and each test is recorded in the audit log.
  - _Awaiting credentials_: its keys aren't set in Vercel yet.
  - _Set, not tested_: keys are set; press **Test connection** (owner and general manager).
  - _Connected_: the last test with the keys in use now succeeded. Changing a key in Vercel shows it as
    untested again.
  - _Error_: the last test failed; the message says why (for example "rejected the API key").
  - _Planned_: built in a later stage.
- **Workflows:** the nine automations from the brief, each with what starts it, what happens, its status
  (On, Off, Always on, Partly built, Not set up) and what it still needs, when it last ran and its results in
  the last 7 days. The owner and general manager switch them on or off, change their options (days before a
  follow-up, whether the AI writes project-photo posts), press **Run now**, and **Run again** on a failed run.
  The run log lists every run that did something or failed. On the current hosting plan timer workflows run
  each morning; with an n8n timer, every few minutes (DEPLOYMENT.md, "Workflows"). Workflows only prepare drafts,
  follow-ups and reports: anything for customers or social media still waits for approval.
- **System log:** every automated email, WhatsApp alert and n8n event with its result per channel. A
  delivery that kept failing shows **Retry** (owner and general manager): channels that already worked are
  not repeated. Customer details are not shown here.

## Marketing (prospects and campaigns)

For the owner, general manager and sales manager.

- **Prospects**: businesses that may buy from GIK in Bahrain and the GCC (designers, architects, developers,
  construction and renovation companies, property managers, commercial contractors, people building new
  homes). Each has a **score** (0–100) and **priority** from its type, country, the contact details known and
  how it responded; the prospect page shows how the score adds up. Filter by location, type, status, priority,
  source and who it's assigned to; export to Excel.
- **Add a prospect** by hand, **Import a spreadsheet** (save Excel as CSV; columns Company, Type, Contact, Role,
  Email, Phone, Website, Country, Area, Notes), or **Find businesses** on Google (once Google Places is
  connected). Only use contact details the business publishes itself; don't import bought lists. The same
  business can't be added twice.
- Move a prospect through **New → Contacted → Interested** (or Not interested / Do not contact). When it has a
  real project, **Convert to a lead**: a customer and a lead (`GIK-P-…`) appear in Leads for the sales team.
- **Campaigns**: choose who receives it and describe what to say, write the email (or **Write it with AI**),
  **Prepare the emails** (one per business, each editable), then **Send for approval**. The owner or general
  manager approves (or rejects) it in Automation Centre → Approvals; emails go out 20 at a time, each with
  who sent it, why, and an unsubscribe link. Anyone who unsubscribes becomes Do not contact. Businesses aren't
  emailed by two campaigns within 30 days. Email sending (Resend) must be set up.
- **Lead generation report**: today or this week (from Saturday) compared with the previous one: prospects
  added, contacted, interested, converted, unsubscribed, and leads received by source.

## Social media (posts and content calendar)

For the owner, general manager, sales manager and content editor. Only the owner and general manager approve
and publish.

- **Content calendar**: every post by day (month or week, weeks from Saturday), filtered by status, platform
  or campaign. Click **+** on a day to write a post for it.
- **New post**: a title and brief, the type (photo, text, reel, story), the platforms and the captions
  (English, Arabic or both). After saving, **Write it with AI** fills in the captions, hashtags, image brief
  (and a reel script) and suggests project photos; edit everything before sending it. Only published website
  images can be used, and project photos only when their use is confirmed. Instagram needs a JPEG photo.
- **Plan with AI**: the AI proposes a week's or month's posts and adds them to the calendar as drafts with a
  day, time and idea. Open each one to write it.
- **Approval**: **Send for approval**; the owner or general manager approves (keep it approved, schedule it for
  its planned time, or publish now) or rejects it with what to change. Approved text and photo can't change:
  **Back to draft** to change them, then approve again.
- **Publishing**: Facebook and Instagram photo posts publish automatically once Meta is connected. Reels,
  LinkedIn and TikTok (and everything before Meta is connected) show **Post by hand**: post it on the platform,
  then **Mark as posted** with its link. Scheduled posts go out at the scheduled job's next run (once a day for
  now); use **Publish now** for an exact time.
- **Social campaigns** group posts with one aim. **Performance** shows posts published and the likes, comments
  and shares Meta reports (last 7, 30 or 90 days).

## Business analytics (reports and questions)

For the owner, general manager and sales manager (Automation Centre → Business analytics).

- **Reports**: daily, weekly (from Saturday) or monthly, with **← Earlier** to look back, each compared with
  the period before: enquiries, new customers, hot / warm / cold, follow-ups overdue, quotations created,
  approved and awaiting the customer, orders and their value, conversion (of the period's enquiries: won,
  lost, open), response time (from enquiry to the first call, email, WhatsApp or meeting logged by staff),
  lead sources, products asked about, social media, campaigns, open leads by stage, follow-ups due and
  quotations waiting. Everything is counted from the database when the page opens.
- **Ask a question** in plain words ("Which channel brought the most leads this month?"). The AI picks
  from the system's fixed reports, the server counts the figures, and the AI answers from them only; the
  answer page shows the figures used. Questions about things the system doesn't record get "I can't". It
  needs the AI assistant switched on (Settings → AI, "lead assistant"). Customer names and contact details
  are never sent to the AI.
- **Email these reports** (owner and general manager): switch on daily, weekly or monthly and list who gets
  them. The morning job sends yesterday's report, last week's on Saturday and last month's on the 1st, once
  each. Needs email sending (Resend).

## Enquiries (Leads)

Every quote request, consultation booking, contact message, designer project and WhatsApp message becomes a
**lead** with a reference such as `GIK-Q-2026-00042`.

- **Work a lead:** open it from **Leads**. Move it along the **pipeline stage**: New inquiry → Contacted →
  Qualified → Site visit → Measurement → Quotation → Negotiation → Won / Lost ("Lost" needs a reason).
  **Assign** it to a colleague, **log** calls, emails, WhatsApp messages and meetings in the history, and
  **schedule a follow-up**. Fill in the **Requirements** (product, dimensions, budget, location, timeline).
- **Lead score (0–100):** worked out automatically from the HOT / WARM / COLD rating, the pipeline stage and
  the requirements known; the lead page shows how each part adds up. Won and lost leads have no score.
- **Last contact** updates by itself when a call, email, WhatsApp message or meeting is logged; **next
  follow-up** is the earliest follow-up not yet done.
- **The leads list** searches name, phone, email, reference and area, filters by stage, rating, minimum
  score, source, product, customer type, assignee, follow-up (overdue, today, this week, none) and dates,
  sorts by newest, oldest, score, next follow-up, recent contact or longest without contact, and **exports to
  Excel** with the same filters (needs access to customers; every export is in the audit log).
- **Pipeline board** (button on the leads list): one column per stage with its count and its leads, highest
  score first. Overdue follow-ups show in red.
- **Files** the customer uploaded (photos, drawings) download from the lead page; each download is recorded.
- **Customers** keeps one record per person, with the consent they gave, their type and location. Editing a
  customer never changes what the customer typed on a lead. The list searches, filters by type, sorts and
  exports to Excel (including each customer's current email and WhatsApp consent).
- **Duplicates:** the same phone or email always joins one record. **Possible duplicates** (on the customers
  list) shows customers with the same name but different details. On the record to keep, **Merge into this
  record** moves the other's leads, quotations, orders, projects and chats over, copies its consent history
  and archives it; enquiries from its phone or email then arrive on the kept record. A merge can't be undone
  from the admin, so check first.
- **Consultations** lists showroom, site-visit and online bookings: confirm, complete or cancel them.

## Quotations, orders and projects

1. On a lead, press **Create quotation**. Add items (description, optional material, size, unit, quantity,
   price in BHD), a discount if any, the **valid until** date and the document language (English or Arabic).
   Totals update as you type. All prices are typed by you; the system does not guess prices.
2. **Save draft**, then **Preview PDF** to check the printout.
3. Send the PDF to the customer yourself (for example on WhatsApp), then press **Mark as sent**. This locks
   that revision and stores its PDF. A sent quotation can't be edited: use **Start a new revision** to change it.
4. When the customer answers, use **Customer's answer**: **Record approval** (by WhatsApp or phone, with who
   approved and how, for example the message they sent) or **Record as declined** (with a reason).
5. After approval, **Convert to order and project** creates the order and a project in the production stage.
6. In **Projects**, move the project through its stages (measurement, design, quotation, approval,
   production, installation, completion) with **Update stage**. Moving backwards needs a note. Each change is
   kept in the stage history. **Orders** shows deposits and order status.

VAT is off until the owner enters the registration number in Settings → Quotations.

## Designers

Designers register on the website. Under **Designers**, call them first, then open the registration and
press **Approve designer** (or reject with a reason). Approved designers send projects; each arrives as a lead
marked "designer portal". On that lead you can reply to the designer or leave an internal note they never
see. Suspending a designer signs them out at once.

## Website content

- **Manage categories** has three tabs:
  - **Products**: the lines in the "What we make" menu, the footer and the homepage tiles. To add a new
    line (for example laundry rooms, laminate doors or ceiling umbrellas), press **Add products
    category** and fill in the English and Arabic name, a short description, the web address
    (`laundry-rooms` makes the page `/products/laundry-rooms`) and an image. It appears on the website
    as soon as you save, with its own page. Open a category to add the products in it. A product's
    **Category** field moves it to another category.
  - **Projects**: categories that group the portfolio on the Projects page. Choose a project's category
    in **Portfolio**. Until a project category has a published project, the page groups projects by
    type as before.
  - **Factory**: categories of machinery, each holding machines. Once one has a published machine, the
    About page shows them instead of the machinery list from the company profile.
  - **Up** and **Down** set the order on the website. Untick "Show on the website" to hide something.
    A category can be deleted only once it is empty. The original eight product lines can be renamed,
    reordered, illustrated or hidden but not deleted, because their pages are part of the site. Hiding
    one also takes its page down. Their main page text stays as written.
  - Images come from **Website images** (type "Category, product or machine"), with their credit.
- **Materials** (EGGER laminate/melamine décors and painted MDF colours only): a décor appears on the
  website only after you tick that you checked it against EGGER's current range and switch on "Show on the
  website". Never publish a décor you have not checked.
- **Portfolio**, **Testimonials**, **Blog**, **Website images**: nothing appears until published. A
  testimonial needs the customer's written permission recorded; a portfolio client name needs permission;
  every image needs its photographer or owner credit. Blog posts need both English and Arabic before
  publishing. Write blog text as plain paragraphs; a line starting with `## ` is a heading and `- ` starts a list.
- **Homepage and banner**: the banner shows only when both languages are filled in.
- **Settings**: phone numbers, email, WhatsApp number (digits with country code, for example 97334597636),
  addresses, opening hours, quotation terms and validity, and the AI switch. Saving updates the website.

## AI sales (what the chat brings in)

**AI sales** (under CRM) shows, for the period you pick:

- **Conversations**, how many visitors **left their details**, **new leads** and how many were **won**.
- **Leads by rating** (click one to see those leads) and **by status**.
- **AI cost (estimate)** in BHD; Anthropic's invoice is the exact figure.
- **Export leads to Excel**: pick source, rating, status and dates, then **Download CSV**. The file has phone
  numbers and emails: keep it within the team. Every export is recorded.
- **Conversations**: every chat, newest first. Filter by rating, by whether the visitor left details, or search
  for words. Open one to read it, see the assistant's reading, photos and the lead.

On a chat lead's page you also get:

- **Requirements**: what the customer wants (product, dimensions, design, materials, location, budget,
  timeline, notes). Correct them after talking to the customer; once you save, the assistant stops changing
  them.
- **Rating (HOT / WARM / COLD)**: set it yourself, or choose “Let the AI assistant decide”.
- **AI chat**: the summary, photos and a link to the full conversation.

Status, assignment, internal notes and follow-ups work as for every lead. **Leads** can also be filtered by
rating.

## AI agent (the website's sales chat)

**AI agent** controls GIK Smart Assistant, the chat button on every page of the website.

- **Show the chat on the website** switches it on or off at once.
- **AI model**: Sonnet is the recommended balance; Haiku is cheapest; Opus costs about twice as much as Sonnet.
- **Daily message limit**: after this many messages in a day, visitors see the team's phone and email instead.
- **Extra instructions**: plain-English notes on tone or what to mention. They can't make the assistant give
  prices or invent facts.
- **Welcome message**: leave empty to keep the standard one.
- **Email the sales team at**: one address per line. Every chat lead is emailed there straight away with the
  customer's details, what they want, the rating and the chat summary.
- **WhatsApp alerts to**: sales team numbers for a short alert per lead, once the company's WhatsApp
  Business account is connected (until then nothing is sent).
- **Knowledge base**: the questions and answers, policies and company information the assistant may use. Add an
  entry when customers keep asking something; untick “The assistant may use this entry” to pause one. Write only
  what is true and decided. If an answer isn't there, the assistant says the sales team will confirm.
- **Leads from the chat** appear in **Leads** with the source “Website chat” and a reference starting
  `GIK-A-`. The lead's first note shows what the visitor entered in the chat's form, and the assistant's
  summary. HOT / WARM / COLD and the requirements (product, size, style, materials, area, budget, timeline)
  are filled in by the assistant; once you change them yourself, it leaves them alone. (The full chat
  dashboard comes in the next step.)
- Contact details, opening hours, products and finishes come from **Settings**, **Manage categories** and
  **Materials**; **Show everything the assistant knows** at the bottom shows exactly what it reads.
- **Documents**: **Upload a document** (PDF, JPG, PNG, WebP or a text file, up to 4 MB; save Word files as PDF).
  The text is read straight away (Claude reads PDFs and images). Check it on the next page, correct anything
  misread, remove anything the chat must not say, then **Publish**. For every visitor message the chat searches
  the published documents and answers from matching passages. **Pricing** documents are kept but never given
  to the chat.
- **Talk to a person**: when a visitor asks for a person or a callback in the chat's form, everyone who assigns
  leads gets a notification, a follow-up due within two hours is added, and the lead shows a red notice until
  someone logs a call, email, WhatsApp message or meeting. The Automation Centre overview counts them.
- **Messages to the customer** (on each lead): write an email, or let the AI draft one. It waits until the
  owner or general manager (or anyone given “Approve messages to customers” in Roles) approves it; they can edit
  it first. It is sent only to customers with an email address who agreed to email, with a greeting, the team
  signature and an unsubscribe link, and is logged in the lead's history. Email sending must be set up
  (Resend) first.
- **Follow-ups for customers who stopped replying** (owner and general manager): when switched on, the daily
  job drafts a follow-up email for open leads with no contact for the chosen number of days. The drafts wait
  on the lead and in Automation Centre → Approvals; nothing is sent automatically.

## AI drafts (only if the owner switched them on)

Assistants write drafts: a reply to a customer, a lead summary, a blog post. Open **AI drafts** (or the lead
page), read and edit the text, then **Approve** or **Reject**. Approving a reply only saves it as a note on
the lead: you send the message yourself. Approving a blog draft creates an unpublished post you must still
check and publish. Check every claim: drafts can be wrong.

## Staff and safety (owner)

- **Staff**: create accounts, give roles, disable a leaver (their sessions end at once), reset a password. The
  system always keeps one active owner.
- **Roles and permissions**: change what each role can do.
- **Audit log**: who did what and when (sign-ins, status changes, approvals, downloads, setting changes).
- Use a long, unique password (12+ characters). Never share an account.

## If something looks wrong

- An enquiry email did not arrive: the lead is still in **Leads**. Tell whoever looks after the site
  (docs/HANDOVER.md, "Runbook").
- A quotation PDF fails: **Mark as sent** still works; press **Store PDF** on the revision later.
- You cannot sign in: wait 15 minutes after repeated failures, or ask the owner to reset your password.
