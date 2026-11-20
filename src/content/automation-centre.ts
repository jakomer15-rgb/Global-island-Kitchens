/**
 * Text for the AI Business Automation Centre (admin), in English and Arabic. The rest of the admin is
 * English for now (owner's choice, 2026-11-11: translate the older screens in a later stage).
 * Figures and dates are shown with Latin digits in both languages, like the rest of the admin.
 */

export type CentreLang = "en" | "ar";
export const centreLangs: readonly CentreLang[] = ["en", "ar"];
export const CENTRE_LANG_COOKIE = "gik_admin_lang";

type Text = { en: string; ar: string };
const t = (en: string, ar: string): Text => ({ en, ar });

export const centreText = {
  name: t("AI Business Automation Centre", "مركز أتمتة الأعمال بالذكاء الاصطناعي"),
  navGroup: t("Automation Centre", "مركز الأتمتة"),
  nav: {
    overview: t("Overview", "نظرة عامة"),
    approvals: t("Approvals", "الموافقات"),
    integrations: t("Integrations", "الربط والتكامل"),
    logs: t("System log", "سجل النظام"),
    analytics: t("Business analytics", "تحليلات الأعمال"),
    workflows: t("Workflows", "مسارات الأتمتة"),
    autopilot: t("Autopilot", "الطيار الآلي"),
  },
  workflows: {
    description: t(
      "The automations of the business. Switch them on or off, change their options, run them now and see every run. Anything for customers or social media waits for a person's approval, unless Autopilot is on (Automation Centre → Autopilot).",
      "أتمتة الأعمال. شغّلوها أو أوقفوها، وغيّروا خياراتها، وشغّلوها الآن، وراجعوا كل تشغيل. كل ما يُرسل للعملاء أو يُنشر على وسائل التواصل ينتظر موافقة شخص، إلا إذا كان الطيار الآلي يعمل (مركز الأتمتة ← الطيار الآلي).",
    ),
    on: t("On", "يعمل"),
    off: t("Off", "متوقف"),
    always: t("Always on", "يعمل دائمًا"),
    notSetUp: t("Not set up", "غير مُعد"),
    partly: t("Partly built", "مبني جزئيًا"),
    trigger: t("When", "متى"),
    steps: t("What happens", "ماذا يحدث"),
    every: t("Checked every", "يُفحص كل"),
    minutes: t("min", "دقيقة"),
    lastRun: t("Last run", "آخر تشغيل"),
    lastChecked: t("Last checked", "آخر فحص"),
    never: t("never", "لا يوجد"),
    last7: t("Last 7 days", "آخر 7 أيام"),
    succeeded: t("succeeded", "نجح"),
    failed: t("failed", "فشل"),
    skipped: t("skipped", "تُخطّي"),
    delivered: t("delivered", "أُرسل"),
    waiting: t("waiting", "بالانتظار"),
    needs: t("Needs", "يحتاج"),
    notBuilt: t("Not built yet", "لم يُبنَ بعد"),
    switchOn: t("Switched on", "مُفعّل"),
    save: t("Save", "حفظ"),
    saved: t("Saved.", "تم الحفظ."),
    runNow: t("Run now", "شغّل الآن"),
    running: t("Running…", "جارٍ التشغيل…"),
    runAgain: t("Run again", "أعد التشغيل"),
    alsoOn: t("Also on the", "أيضًا في صفحة"),
    runs: t("Run log", "سجل التشغيل"),
    noRuns: t("No runs yet.", "لا يوجد تشغيل بعد."),
    workflow: t("Workflow", "المسار"),
    started: t("Started", "بدأ"),
    by: t("Started by", "بدأه"),
    result: t("Result", "النتيجة"),
    status: t("Status", "الحالة"),
    triggers: {
      schedule: t("timer", "مؤقت"),
      manual: t("by hand", "يدويًا"),
      n8n: t("n8n", "n8n"),
      retry: t("retry", "إعادة"),
    } as Record<string, Text>,
    statuses: {
      succeeded: t("Succeeded", "نجح"),
      failed: t("Failed", "فشل"),
      skipped: t("Skipped", "تُخطّي"),
    } as Record<string, Text>,
    timerTitle: t("How often workflows run", "كم مرة تعمل المسارات"),
    timer: t(
      "Timer workflows run when the scheduled job is called. Vercel calls it once a day (06:00 Bahrain). To run them every 10 minutes for free, add the SITE_URL and CRON_SECRET secrets in GitHub for the “Automation timer” (DEPLOYMENT.md, “Workflows”); an n8n timer or a paid Vercel plan also work. Each workflow still runs at most at its own interval.",
      "تعمل المسارات المؤقتة عند استدعاء المهمة المجدولة. يستدعيها Vercel مرة يوميًا (06:00 بتوقيت البحرين). لتشغيلها كل 10 دقائق مجانًا أضيفوا السرّين SITE_URL وCRON_SECRET في GitHub لـ«Automation timer» (DEPLOYMENT.md، «Workflows»)؛ ويصلح أيضًا مؤقت n8n أو خطة Vercel مدفوعة. يبقى كل مسار مقيدًا بفترته الخاصة.",
    ),
    n8nTitle: t("Starting workflows from n8n", "تشغيل المسارات من n8n"),
    n8n: t(
      'n8n receives every event (new lead, status change, quotation…) as a signed webhook, and can start a workflow with a signed POST to /api/automation/workflows (body {"workflow":"key"}, or "due" for all that are due). The signature uses N8N_WEBHOOK_SECRET; unsigned or old requests are refused.',
      'يستقبل n8n كل حدث (عميل جديد، تغيير حالة، عرض سعر…) كطلب موقّع، ويمكنه تشغيل مسار بطلب POST موقّع إلى ‎/api/automation/workflows (المحتوى ‎{"workflow":"key"}‎ أو "due" لكل المستحق). يستخدم التوقيع N8N_WEBHOOK_SECRET؛ تُرفض الطلبات غير الموقّعة أو القديمة.',
    ),
    names: {
      website_enquiry_reply: t(
        "Website enquiry → AI response → CRM record",
        "استفسار الموقع ← رد ذكي ← سجل العميل",
      ),
      whatsapp_enquiry: t(
        "WhatsApp enquiry → AI response → CRM record",
        "استفسار واتساب ← رد ذكي ← سجل العميل",
      ),
      new_lead_alert: t("New lead → sales team notification", "عميل جديد ← تنبيه فريق المبيعات"),
      qualified_follow_up: t("Qualified lead → follow-up", "عميل مؤهل ← متابعة"),
      no_response_follow_up: t(
        "No customer response → scheduled follow-up",
        "لا رد من العميل ← متابعة مجدولة",
      ),
      project_photo_social: t(
        "New project image → social media content draft",
        "صورة مشروع جديدة ← مسودة منشور",
      ),
      approved_post_publishing: t(
        "Approved post → social media publishing",
        "منشور معتمد ← النشر على وسائل التواصل",
      ),
      weekly_campaign_report: t("Weekly campaign → performance report", "الحملات الأسبوعية ← تقرير الأداء"),
      management_reports: t(
        "Daily sales activity → management report",
        "نشاط المبيعات اليومي ← تقرير الإدارة",
      ),
      autopilot_prospect_emails: t(
        "Autopilot → introduction emails to prospects",
        "الطيار الآلي ← رسائل تعريفية للعملاء المحتملين",
      ),
      autopilot_social: t("Autopilot → social media posts", "الطيار الآلي ← منشورات وسائل التواصل"),
      autopilot_summary: t("Autopilot → morning summary to the owner", "الطيار الآلي ← ملخص صباحي للمالك"),
    } as Record<string, Text>,
  },
  autopilot: {
    title: t("Autopilot", "الطيار الآلي"),
    description: t(
      "The AI does the work: it answers customers, writes emails to prospects and prepares social media posts. Choose whether it asks you before anything goes out, or sends by itself. Safety rules flag anything with a price, a promise, another material, a link or an unfinished part. Every morning you get an email listing everything it did.",
      "يقوم الذكاء الاصطناعي بالعمل: يرد على العملاء ويكتب رسائل العملاء المحتملين ويجهّز منشورات وسائل التواصل. اختاروا أن يسألكم قبل خروج أي شيء أو أن يرسل بنفسه. قواعد الأمان تنبّه على أي نص فيه سعر أو وعد أو مادة أخرى أو رابط أو جزء ناقص. وكل صباح يصلكم بريد بكل ما قام به.",
    ),
    modeTitle: t("How it works", "طريقة العمل"),
    modeApprove: t("Ask me first (recommended)", "اسألني أولًا (موصى به)"),
    modeApproveText: t(
      "The AI prepares every email, campaign and post; each one waits for your approval and is sent or published only after you approve it.",
      "يجهّز الذكاء الاصطناعي كل رسالة وحملة ومنشور؛ وينتظر كلٌّ منها موافقتكم ولا يُرسل أو يُنشر إلا بعدها.",
    ),
    modeAuto: t("Send by itself", "يرسل بنفسه"),
    modeAutoText: t(
      "What passes the safety checks is sent and published without asking; the rest waits for you.",
      "ما يجتاز فحوص الأمان يُرسل ويُنشر دون سؤال؛ والباقي ينتظركم.",
    ),
    modeApproveShort: t("asks you first", "يسألكم أولًا"),
    modeAutoShort: t("sends by itself", "يرسل بنفسه"),
    toYouTitle: t("Messages to you", "رسائل إليكم"),
    toYouText: t(
      "Sent to the report addresses in Business analytics, or the sales alert addresses (NOTIFY_EMAILS). WhatsApp messages come once WhatsApp Business is connected.",
      "تُرسل إلى عناوين التقارير في تحليلات الأعمال أو عناوين تنبيهات المبيعات (NOTIFY_EMAILS). ورسائل واتساب بعد ربط واتساب للأعمال.",
    ),
    approvalEmails: t(
      "Email me every approval request (emails, campaigns, social posts), with the full text",
      "أرسلوا لي بالبريد كل طلب موافقة (رسائل، حملات، منشورات) مع النص كاملًا",
    ),
    copyEmails: t(
      "Send me a hidden copy of every email sent to customers and businesses",
      "أرسلوا لي نسخة مخفية من كل رسالة تُرسل للعملاء والشركات",
    ),
    statusOn: t("Autopilot is ON", "الطيار الآلي يعمل"),
    statusOff: t("Autopilot is OFF", "الطيار الآلي متوقف"),
    turnOn: t("Turn Autopilot on", "شغّل الطيار الآلي"),
    turningOn: t("Turning on…", "جارٍ التشغيل…"),
    turnedOn: t(
      "Autopilot is on. The AI assistants, enquiry replies, follow-ups and post publishing were switched on with it.",
      "تم تشغيل الطيار الآلي، ومعه مساعدو الذكاء الاصطناعي والردود على الاستفسارات والمتابعات ونشر المنشورات.",
    ),
    stop: t("STOP everything now", "أوقف كل شيء الآن"),
    stopping: t("Stopping…", "جارٍ الإيقاف…"),
    stopHint: t(
      "Stops Autopilot at once. Emails and posts it approved but hasn't sent yet go back to Approvals for a person.",
      "يوقف الطيار الآلي فورًا. الرسائل والمنشورات التي اعتمدها ولم تُرسل بعد تعود إلى الموافقات لشخص.",
    ),
    stopped: t("Autopilot stopped.", "تم إيقاف الطيار الآلي."),
    needs: t("Still needed", "ما زال مطلوبًا"),
    ready: t("Ready", "جاهز"),
    save: t("Save", "حفظ"),
    saved: t("Saved.", "تم الحفظ."),
    on: t("On", "يعمل"),
    repliesTitle: t("Replies to customers", "الردود على العملاء"),
    repliesText: t(
      "First replies to new website enquiries and follow-ups to customers who stopped replying, by email, only to customers who agreed to email. Replies from customers arrive in the company inbox.",
      "أول رد على استفسارات الموقع الجديدة ومتابعة العملاء الذين توقفوا عن الرد، بالبريد، فقط لمن وافق على البريد. تصل ردود العملاء إلى بريد الشركة.",
    ),
    perDay: t("Emails per day (at most)", "الرسائل يوميًا (حد أقصى)"),
    followUpsPerLead: t("Automatic follow-ups per customer", "المتابعات التلقائية لكل عميل"),
    prospectsTitle: t("Introduction emails to prospects", "رسائل تعريفية للعملاء المحتملين"),
    prospectsText: t(
      "Sent each day to new prospects in Marketing who have an email address, highest score first, from the template below. Approve the template once; change it any time (it needs approval again).",
      "تُرسل يوميًا للعملاء المحتملين الجدد في التسويق ممن لديهم بريد، الأعلى تقييمًا أولًا، من القالب أدناه. اعتمدوا القالب مرة واحدة؛ ويمكن تغييره في أي وقت (ويحتاج اعتمادًا جديدًا).",
    ),
    prospectsWithEmail: t("New prospects with an email address", "العملاء المحتملون الجدد ممن لديهم بريد"),
    template: t("Email template", "قالب الرسالة"),
    templateHint: t(
      "You can use {company}, {contact}, {area} and {type}. The greeting, signature, why they received it and the unsubscribe link are added automatically.",
      "يمكن استخدام {company} و{contact} و{area} و{type}. تُضاف التحية والتوقيع وسبب الاستلام ورابط إلغاء الاشتراك تلقائيًا.",
    ),
    subject: t("Subject", "الموضوع"),
    body: t("Email", "نص الرسالة"),
    approveTemplate: t("Approve this template", "اعتمد هذا القالب"),
    templateApproved: t("Template approved.", "تم اعتماد القالب."),
    approvedBy: t("Approved by", "اعتمده"),
    notApproved: t("Not approved yet", "لم يُعتمد بعد"),
    aiWrite: t("Let the AI write it", "دع الذكاء الاصطناعي يكتبه"),
    aiWriting: t("Writing…", "جارٍ الكتابة…"),
    aiBrief: t("What should the email say? (for the AI)", "ماذا يجب أن تقول الرسالة؟ (للذكاء الاصطناعي)"),
    aiWritten: t(
      "Draft written below. Read it, then approve it.",
      "كُتبت المسودة أدناه. اقرؤوها ثم اعتمدوها.",
    ),
    paused: t("Paused by the safety checks", "أُوقفت بسبب فحوص الأمان"),
    socialTitle: t("Social media posts", "منشورات وسائل التواصل"),
    socialText: t(
      "Keeps the chosen number of posts scheduled for the coming week on Facebook and Instagram, with captions in English and Arabic and photos from your published portfolio.",
      "يحافظ على العدد المختار من المنشورات مجدولًا للأسبوع القادم على فيسبوك وإنستغرام، بنصوص بالعربية والإنجليزية وصور من معرض أعمالكم المنشور.",
    ),
    postsPerWeek: t("Posts per week", "المنشورات أسبوعيًا"),
    platforms: t("Platforms", "المنصات"),
    captions: t("Captions", "لغة النصوص"),
    langBoth: t("English and Arabic", "العربية والإنجليزية"),
    langEn: t("English", "الإنجليزية"),
    langAr: t("Arabic", "العربية"),
    summaryTitle: t("Morning summary", "الملخص الصباحي"),
    summaryText: t(
      "An email every morning with what the AI sent, published and held the day before. Goes to the report addresses in Business analytics, or the sales alert addresses.",
      "بريد كل صباح بما أرسله الذكاء الاصطناعي ونشره وأوقفه في اليوم السابق. يُرسل إلى عناوين التقارير في تحليلات الأعمال أو عناوين تنبيهات المبيعات.",
    ),
    last7: t("Last 7 days", "آخر 7 أيام"),
    sentByAi: t("Emails sent by the AI", "رسائل أرسلها الذكاء الاصطناعي"),
    prospectEmailsSent: t("Prospect emails sent", "رسائل العملاء المحتملين المرسلة"),
    postsScheduled: t("Posts scheduled by the AI", "منشورات جدولها الذكاء الاصطناعي"),
    heldForPerson: t("Held for a person", "أُوقفت لشخص"),
    heldTitle: t("Waiting for a person", "بانتظار شخص"),
    heldNone: t("Nothing is waiting.", "لا شيء بالانتظار."),
    open: t("Open", "فتح"),
    noPermission: t(
      "Only the owner and the general manager can change Autopilot.",
      "يمكن للمالك والمدير العام فقط تغيير الطيار الآلي.",
    ),
  },
  language: t("Language", "اللغة"),
  switchTo: t("العربية", "English"),
  overview: {
    description: t(
      "One place for the AI agents, the work waiting for your approval, and the outside services they use. Every figure is counted from the database now.",
      "مكان واحد لوكلاء الذكاء الاصطناعي، والأعمال التي تنتظر موافقتكم، والخدمات الخارجية التي يستخدمونها. كل رقم هنا محسوب من قاعدة البيانات الآن.",
    ),
    enquiriesToday: t("Enquiries today", "استفسارات اليوم"),
    last7: t("last 7 days", "آخر 7 أيام"),
    last30: t("last 30 days", "آخر 30 يومًا"),
    notContacted: t("New, not contacted", "جديدة لم يُتواصل معها"),
    handovers: t("Asked for a person", "طلبوا التحدث مع موظف"),
    handoversHint: t("chat visitors not yet contacted", "زوار المحادثة لم يُتواصل معهم بعد"),
    openByRating: t("Open leads by rating", "العملاء المحتملون المفتوحون حسب التصنيف"),
    unrated: t("not rated", "غير مصنّف"),
    followUpsOverdue: t("Follow-ups overdue", "متابعات متأخرة"),
    followUpsToday: t("still due today", "مستحقة اليوم"),
    chats7: t("Website chats (7 days)", "محادثات الموقع (7 أيام)"),
    quotationsAwaiting: t("Quotations awaiting an answer", "عروض أسعار بانتظار الرد"),
    quotationsCreated: t("created in 30 days", "أُنشئت خلال 30 يومًا"),
    quotationsApproved: t("Quotations approved (30 days)", "عروض أسعار معتمدة (30 يومًا)"),
    orders: t("orders in 30 days", "طلبات خلال 30 يومًا"),
    conversion: t("Lead conversion", "نسبة التحويل"),
    conversionHint: t("won of decided leads", "مكسوبة من العملاء المحسومين"),
    noConversion: t("No won or lost leads yet", "لا توجد صفقات مكسوبة أو خاسرة بعد"),
    pendingApprovals: t("Waiting for approval", "بانتظار الموافقة"),
    deliveryProblems: t("Failed deliveries", "عمليات إرسال فاشلة"),
    deliveryHint: t("emails, alerts and n8n events", "رسائل بريد وتنبيهات وأحداث n8n"),
    agents: t("AI agents", "وكلاء الذكاء الاصطناعي"),
    modules: t("Modules", "الأقسام"),
    modulesHint: t(
      "The 14 areas of the Centre. Available ones open the working screen; the rest show the stage that builds them.",
      "أقسام المركز الأربعة عشر. المتاح منها يفتح الشاشة العاملة، والباقي يوضح المرحلة التي ستُبنى فيها.",
    ),
    available: t("Available", "متاح"),
    stage: t("Stage", "المرحلة"),
    open: t("Open", "فتح"),
  },
  agents: {
    sales: {
      name: t("AI Sales Agent", "وكيل المبيعات الذكي"),
      about: t(
        "Answers website visitors 24/7 from approved information, collects their details with consent, rates leads HOT / WARM / COLD and alerts the sales team.",
        "يجيب زوار الموقع على مدار الساعة من المعلومات المعتمدة، ويجمع بياناتهم بموافقتهم، ويصنّف العملاء ساخن / دافئ / بارد، وينبّه فريق المبيعات.",
      ),
      live: t("Live on the website", "يعمل على الموقع"),
      off: t("Switched off in AI agent settings", "متوقف من إعدادات الوكيل"),
      noKey: t("Waiting for the Claude API key", "بانتظار مفتاح Claude"),
      settings: t("Settings and knowledge", "الإعدادات والمعرفة"),
      results: t("Results", "النتائج"),
    },
    marketing: {
      name: t("AI Marketing and Lead Generation Agent", "وكيل التسويق وتوليد العملاء"),
      about: t(
        "Prospect database for designers, architects, developers and contractors in Bahrain and the GCC, scoring and approved outreach.",
        "قاعدة بيانات للعملاء المرتقبين من المصممين والمعماريين والمطورين والمقاولين في البحرين والخليج، مع تقييمهم وتواصل معتمد.",
      ),
      live: t("Working: prospects, campaigns and reports", "يعمل: العملاء المرتقبون والحملات والتقارير"),
      prospects: t("Prospects", "العملاء المرتقبون"),
      campaigns: t("Campaigns", "الحملات"),
      report: t("Report", "التقرير"),
    },
    social: {
      name: t("AI Social Media Marketing Agent", "وكيل التسويق عبر وسائل التواصل"),
      about: t(
        "English and Arabic posts, captions and reel scripts, a content calendar, approval and publishing through official APIs.",
        "منشورات وتعليقات ونصوص فيديو بالعربية والإنجليزية، وتقويم محتوى، وموافقة ونشر عبر الواجهات الرسمية.",
      ),
      live: t("Working: calendar, approval and publishing", "يعمل: التقويم والموافقة والنشر"),
      calendar: t("Calendar", "التقويم"),
      plan: t("Plan with AI", "التخطيط بالذكاء الاصطناعي"),
      performance: t("Performance", "الأداء"),
    },
    analytics: {
      name: t("AI Business Analytics Agent", "وكيل تحليلات الأعمال"),
      about: t(
        "Daily, weekly and monthly reports and answers to management questions, from database figures only.",
        "تقارير يومية وأسبوعية وشهرية وإجابات عن أسئلة الإدارة، من أرقام قاعدة البيانات فقط.",
      ),
      live: t("Working: reports and questions", "يعمل: التقارير والأسئلة"),
      reports: t("Reports", "التقارير"),
      ask: t("Ask a question", "اطرح سؤالًا"),
    },
    planned: t("Planned for stage", "مخطط له في المرحلة"),
  },
  modules: {
    overview: t("Overview dashboard", "لوحة النظرة العامة"),
    salesAgent: t("AI Sales Agent", "وكيل المبيعات الذكي"),
    marketingAgent: t("AI Marketing Agent", "وكيل التسويق الذكي"),
    leads: t("Lead management", "إدارة العملاء المحتملين"),
    customers: t("Customer CRM", "سجل العملاء"),
    social: t("Social media manager", "إدارة وسائل التواصل"),
    calendar: t("Content calendar", "تقويم المحتوى"),
    campaigns: t("Campaign manager", "إدارة الحملات"),
    analytics: t("AI business analytics", "تحليلات الأعمال الذكية"),
    knowledge: t("Company knowledge base", "قاعدة معرفة الشركة"),
    workflows: t("Automation workflows", "مسارات الأتمتة"),
    integrations: t("Integrations and API settings", "الربط وإعدادات الواجهات"),
    users: t("User management", "إدارة المستخدمين"),
    logs: t("System logs", "سجلات النظام"),
  },
  approvals: {
    description: t(
      "Everything waiting for a person's decision. Nothing on this list is sent or published until someone approves it on its own screen.",
      "كل ما ينتظر قرارًا من شخص. لا يُرسل أو يُنشر أي شيء من هذه القائمة حتى يوافق عليه أحد في شاشته الخاصة.",
    ),
    empty: t("Nothing is waiting for approval.", "لا يوجد ما ينتظر الموافقة."),
    kind: t("Type", "النوع"),
    item: t("Item", "العنصر"),
    waiting: t("Waiting since", "بانتظار منذ"),
    review: t("Review", "مراجعة"),
    kinds: {
      customer_message: t("Message to a customer", "رسالة إلى عميل"),
      campaign: t("Marketing campaign", "حملة تسويقية"),
      ai_draft: t("AI draft", "مسودة ذكاء اصطناعي"),
      designer: t("Designer registration", "تسجيل مصمم"),
      social_post: t("Social media post", "منشور على وسائل التواصل"),
    },
    draftKinds: {
      lead_reply: t("Reply to a lead", "رد على عميل محتمل"),
      lead_summary: t("Lead summary", "ملخص عميل محتمل"),
      blog_post: t("Blog post", "مقال مدونة"),
    } as Record<string, Text>,
  },
  integrations: {
    description: t(
      "The outside services the system uses. A service shows Connected only after a real test call succeeded with the settings in use now. Keys are kept on the server (Vercel → Settings → Environment Variables) and never shown here.",
      "الخدمات الخارجية التي يستخدمها النظام. لا تظهر الخدمة متصلة إلا بعد نجاح اختبار حقيقي بالإعدادات الحالية. المفاتيح محفوظة على الخادم (Vercel ← الإعدادات ← متغيرات البيئة) ولا تظهر هنا أبدًا.",
    ),
    status: {
      planned: t("Planned", "مخطط"),
      awaiting_credentials: t("Awaiting credentials", "بانتظار بيانات الربط"),
      configured: t("Set, not tested", "مُعدّ ولم يُختبر"),
      connected: t("Connected", "متصل"),
      error: t("Error", "خطأ"),
    },
    test: t("Test connection", "اختبار الاتصال"),
    testing: t("Testing…", "جارٍ الاختبار…"),
    lastTest: t("Last test", "آخر اختبار"),
    settings: t("Server settings", "إعدادات الخادم"),
    set: t("set", "مُعدّ"),
    missing: t("missing", "غير موجود"),
    noTest: t(
      "No safe test call exists for this service; its deliveries are shown below.",
      "لا يوجد اختبار آمن لهذه الخدمة؛ عمليات الإرسال الخاصة بها موضحة أدناه.",
    ),
    lastN8n: t("Last event delivered to n8n", "آخر حدث وصل إلى n8n"),
    lastRun: t("Last delivery processed", "آخر إرسال تمت معالجته"),
    never: t("never", "لا يوجد"),
    plannedFor: t("Built in stage", "يُبنى في المرحلة"),
    future: t("Future integration", "تكامل مستقبلي"),
  },
  logs: {
    description: t(
      "Every automated email, WhatsApp alert and n8n event, with its result. Customer details are not shown here; open the lead for those.",
      "كل رسالة بريد وتنبيه واتساب وحدث n8n يتم تلقائيًا مع نتيجته. لا تظهر بيانات العملاء هنا؛ افتحوا سجل العميل لرؤيتها.",
    ),
    health: t("Delivery health", "حالة الإرسال"),
    pending: t("Waiting to send", "بانتظار الإرسال"),
    overdue: t("Waiting more than a day", "بانتظار أكثر من يوم"),
    overdueHint: t(
      "The scheduled job may not be running, or a service keeps refusing.",
      "قد لا تعمل المهمة المجدولة، أو أن إحدى الخدمات ترفض باستمرار.",
    ),
    failed: t("Failed (gave up)", "فشلت (توقفت المحاولات)"),
    deliveries: t("Deliveries", "عمليات الإرسال"),
    event: t("Event", "الحدث"),
    status: t("Status", "الحالة"),
    attempts: t("Attempts", "المحاولات"),
    channels: t("Channels", "القنوات"),
    created: t("Created", "أُنشئ"),
    error: t("Last error", "آخر خطأ"),
    retry: t("Retry", "إعادة المحاولة"),
    retried: t("Queued again for the next run.", "أُعيد إلى قائمة الانتظار للتشغيل التالي."),
    allTypes: t("All events", "كل الأحداث"),
    allStatuses: t("Any status", "أي حالة"),
    filter: t("Filter", "تصفية"),
    empty: t("No deliveries match.", "لا توجد عمليات إرسال مطابقة."),
    checks: t("Connection tests", "اختبارات الاتصال"),
    noChecks: t("No connection tests yet.", "لا توجد اختبارات اتصال بعد."),
    by: t("by", "بواسطة"),
    audit: t("Full audit log of staff actions", "سجل التدقيق الكامل لإجراءات الموظفين"),
    statuses: {
      pending: t("Pending", "قيد الانتظار"),
      processing: t("Sending", "جارٍ الإرسال"),
      done: t("Done", "تم"),
      failed: t("Failed", "فشل"),
    },
    channelResults: {
      sent: t("sent", "أُرسل"),
      not_configured: t("not set up", "غير مُعد"),
      skipped: t("skipped", "تم تخطيه"),
    } as Record<string, Text>,
    page: t("Page", "صفحة"),
    of: t("of", "من"),
    previous: t("Previous", "السابق"),
    next: t("Next", "التالي"),
  },
  integrationInfo: {
    anthropic: {
      name: t("Claude (Anthropic)", "Claude (Anthropic)"),
      purpose: t(
        "The AI behind every agent: the website chat, drafts and, later, marketing, social media and reports.",
        "الذكاء الاصطناعي وراء كل الوكلاء: محادثة الموقع والمسودات، ولاحقًا التسويق ووسائل التواصل والتقارير.",
      ),
    },
    resend: {
      name: t("Email (Resend)", "البريد الإلكتروني (Resend)"),
      purpose: t(
        "Sends lead alerts to the sales team and enquiry confirmations to customers.",
        "يرسل تنبيهات العملاء المحتملين لفريق المبيعات وتأكيدات الاستفسار للعملاء.",
      ),
    },
    storage: {
      name: t("File storage (Cloudflare R2)", "تخزين الملفات (Cloudflare R2)"),
      purpose: t(
        "Keeps uploaded drawings, photos, quotation PDFs and, later, social media images. Uploads stay off on the live site until it is connected.",
        "يحفظ المخططات والصور المرفوعة وملفات عروض الأسعار، ولاحقًا صور وسائل التواصل. يبقى الرفع متوقفًا على الموقع حتى يتم الربط.",
      ),
    },
    whatsapp: {
      name: t("WhatsApp Business Platform", "منصة واتساب للأعمال"),
      purpose: t(
        "Alerts the sales team about new leads and logs customers' WhatsApp messages on their lead. Customer conversations come in Stage 4.",
        "ينبّه فريق المبيعات بالعملاء الجدد ويسجل رسائل واتساب من العملاء في ملفاتهم. محادثات العملاء في المرحلة 4.",
      ),
    },
    n8n: {
      name: t("n8n workflows", "مسارات n8n"),
      purpose: t(
        "Receives signed events (new lead, status change, quotation sent…) for your own automations.",
        "يستقبل أحداثًا موقّعة (عميل جديد، تغيير حالة، إرسال عرض سعر…) لمسارات الأتمتة الخاصة بكم.",
      ),
    },
    cron: {
      name: t("Scheduled job", "المهمة المجدولة"),
      purpose: t(
        "Runs the workflows that are due, sends waiting emails and events and retries failures. Vercel runs it once a day; the free GitHub “Automation timer” (or n8n, or a paid plan) can call it every 10 minutes.",
        "تشغّل المسارات المستحقة وترسل الرسائل والأحداث المنتظرة وتعيد المحاولات الفاشلة. يشغّلها Vercel مرة يوميًا؛ ويمكن لمؤقت GitHub المجاني «Automation timer» (أو n8n أو خطة مدفوعة) استدعاؤها كل 10 دقائق.",
      ),
    },
    meta: {
      name: t("Meta: Facebook and Instagram", "Meta: فيسبوك وإنستغرام"),
      purpose: t(
        "Publishes approved posts to the Facebook Page and Instagram, and reads their likes, comments and shares. Instagram and Messenger conversations come later (Stage 4, part B).",
        "ينشر المنشورات المعتمدة على صفحة فيسبوك وإنستغرام ويقرأ الإعجابات والتعليقات والمشاركات. محادثات إنستغرام وماسنجر لاحقًا (المرحلة 4، الجزء الثاني).",
      ),
    },
    linkedin: {
      name: t("LinkedIn company page", "صفحة الشركة على لينكدإن"),
      purpose: t(
        "Publishing approved posts to the company page. Needs LinkedIn's approval for company-page access; until then LinkedIn posts are prepared here and posted by hand.",
        "نشر المنشورات المعتمدة على صفحة الشركة. يحتاج موافقة لينكدإن على الوصول لصفحات الشركات؛ وحتى ذلك تُجهّز منشورات لينكدإن هنا وتُنشر يدويًا.",
      ),
    },
    google_places: {
      name: t("Google Places", "Google Places"),
      purpose: t(
        "Finding businesses (contractors, developers, designers) from Google's listings for the prospect list (Marketing → Find businesses). Google charges per search.",
        "البحث عن الشركات (مقاولون ومطورون ومصممون) من قوائم Google لقائمة العملاء المرتقبين (التسويق ← البحث عن شركات). تحتسب Google رسومًا لكل بحث.",
      ),
    },
    canva: {
      name: t("Canva", "Canva"),
      purpose: t(
        "Opening designs for promotional images and bringing finished images back. Needs an app registered with Canva (filling templates automatically needs Canva Enterprise); meanwhile each post has an image brief to use in Canva.",
        "فتح التصاميم للصور الترويجية وإعادة الصور الجاهزة. يحتاج تطبيقًا مسجلًا لدى Canva (تعبئة القوالب تلقائيًا تحتاج Canva Enterprise)؛ وحتى ذلك لكل منشور وصف للصورة يُستخدم في Canva.",
      ),
    },
    tiktok: {
      name: t("TikTok", "تيك توك"),
      purpose: t(
        "Publishing approved videos (future integration). Until then TikTok posts are prepared here and posted by hand.",
        "نشر الفيديوهات المعتمدة (تكامل مستقبلي). وحتى ذلك تُجهّز منشورات تيك توك هنا وتُنشر يدويًا.",
      ),
    },
  },
} as const;

/** Picks one language from a { en, ar } pair. */
export function tr(text: Text, lang: CentreLang): string {
  return text[lang];
}

/** For lookups by a value from the database: the translation when one exists, else the value itself. */
export function trOr(table: Record<string, Text>, key: string, lang: CentreLang): string {
  const text = Object.hasOwn(table, key) ? table[key] : undefined;
  return text ? text[lang] : key;
}

const formats = {
  en: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bahrain" }),
  ar: new Intl.DateTimeFormat("ar-BH-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bahrain",
  }),
};

export const fmtCentreDateTime = (d: Date, lang: CentreLang) => formats[lang].format(d);
