import type { PageKey } from "@/config/routes";
import type { L, LList } from "./types";

export type ProductKey = Extract<
  PageKey,
  | "woodenKitchens"
  | "aluminiumKitchens"
  | "wardrobes"
  | "walkInClosets"
  | "bedroomFurniture"
  | "tvUnits"
  | "wallCladding"
  | "bathroomVanities"
>;

/** Scope tags used to match products with projects (src/content/projects.ts). */
export type ScopeTag =
  | "kitchens"
  | "closets"
  | "bedSets"
  | "tvUnits"
  | "vanities"
  | "doors"
  | "cladding"
  | "fullJoinery"
  | "furnished"
  | "commercial";

export interface Product {
  key: ProductKey;
  name: L;
  /** Meta title (≤ 60 characters with the brand suffix). */
  metaTitle: L;
  metaDescription: L;
  intro: L;
  /** What the profile says the company makes in this line. */
  makes: LList;
  /** Longer notes for the page, written from the approved facts only. */
  details: { title: L; body: L }[];
  /** Which board families apply (materials rule: EGGER laminate/melamine and painted MDF; aluminium for aluminium kitchens). */
  materials: ("egger" | "mdf" | "aluminium")[];
  scope: ScopeTag[];
}

export const products: Product[] = [
  {
    key: "woodenKitchens",
    name: { en: "Customised wooden kitchens", ar: "مطابخ خشبية حسب الطلب" },
    metaTitle: { en: "Custom Kitchens in Bahrain", ar: "مطابخ حسب الطلب في البحرين" },
    metaDescription: {
      en: "Modern fitted kitchens made to measure in EGGER laminate and melamine boards or painted MDF, manufactured in Hamad Town and installed across Bahrain.",
      ar: "مطابخ عصرية مجهّزة على المقاس من ألواح اللامينيت والميلامين من إيجر (EGGER) أو ألواح MDF مدهونة، تُصنع في مدينة حمد وتُركَّب في أنحاء البحرين.",
    },
    intro: {
      en: "Modern fitted kitchens, made to measure in our Hamad Town factory. The wood look comes from EGGER laminate and melamine-faced boards in wood-grain décors; for a smooth, colour-matched finish we use painted MDF.",
      ar: "مطابخ عصرية مجهّزة تُصنع على المقاس في مصنعنا في مدينة حمد. يأتي مظهر الخشب من ألواح اللامينيت والميلامين من إيجر (EGGER) بتصاميم بلون الخشب، ونستخدم ألواح MDF المدهونة لتشطيب ناعم متناسق الألوان.",
    },
    makes: {
      en: [
        "Modern fitted kitchens for homes and apartments",
        "Kitchens for residential buildings and villa projects, produced in bulk",
        "Custom sizes, shapes and finishes",
      ],
      ar: [
        "مطابخ عصرية مجهّزة للمنازل والشقق",
        "مطابخ للمباني السكنية ومشاريع الفلل، تُنتج بكميات كبيرة",
        "مقاسات وأشكال وتشطيبات حسب الطلب",
      ],
    },
    details: [
      {
        title: { en: "The wood look, in EGGER boards", ar: "مظهر الخشب بألواح إيجر (EGGER)" },
        body: {
          en: "Our kitchens are built from EGGER laminate and melamine-faced boards, in wood-grain, solid-colour and stone-look décors, or from MDF painted in the colour you choose. No solid wood or veneer is used, so the wood look comes from the décor you pick.",
          ar: "تُصنع مطابخنا من ألواح اللامينيت والميلامين من إيجر (EGGER) بتصاميم بلون الخشب أو بألوان سادة أو بمظهر الحجر، أو من ألواح MDF مدهونة باللون الذي تختارونه. لا نستخدم الخشب الطبيعي أو القشرة الخشبية، فمظهر الخشب يأتي من التصميم الذي تختارونه.",
        },
      },
      {
        title: { en: "One kitchen or a whole building", ar: "مطبخ واحد أو مبنى كامل" },
        body: {
          en: "We make kitchens for single homes, and we specialise in bulk kitchen production and fixing for residential buildings and villa projects. Each one is made in our Hamad Town factory and installed by our own company.",
          ar: "نصنع المطابخ للمنازل الفردية، ونتخصص في إنتاج المطابخ وتركيبها بكميات كبيرة للمباني السكنية ومشاريع الفلل. ويُصنع كل مطبخ في مصنعنا بمدينة حمد وتتولى شركتنا تركيبه.",
        },
      },
    ],
    materials: ["egger", "mdf"],
    scope: ["kitchens"],
  },
  {
    key: "aluminiumKitchens",
    name: { en: "Aluminium kitchens", ar: "مطابخ الألمنيوم" },
    metaTitle: { en: "Aluminium Kitchens in Bahrain", ar: "مطابخ الألمنيوم في البحرين" },
    metaDescription: {
      en: "Aluminium kitchens made to order by Global Island Kitchens in Bahrain. Visit our Al-Hamalah showroom or contact us to discuss your kitchen.",
      ar: "مطابخ ألمنيوم تُصنع حسب الطلب لدى Global Island Kitchens في البحرين. زوروا صالة العرض في الهملة أو تواصلوا معنا لمناقشة مطبخكم.",
    },
    intro: {
      en: "Aluminium kitchens are one of our core product lines, made to order alongside our board kitchens. Talk to us about your space and we will advise on the options.",
      ar: "مطابخ الألمنيوم أحد خطوط إنتاجنا الرئيسية، وتُصنع حسب الطلب إلى جانب مطابخ الألواح. حدّثونا عن مساحتكم وسننصحكم بالخيارات المناسبة.",
    },
    makes: {
      en: ["Aluminium kitchens, made to order", "Designed, manufactured and installed by one company"],
      ar: ["مطابخ ألمنيوم تُصنع حسب الطلب", "تصميم وتصنيع وتركيب لدى شركة واحدة"],
    },
    // Profile systems, glass types and colours aren't confirmed yet (OPEN_QUESTIONS #19), so none are named.
    details: [
      {
        title: { en: "Aluminium or board?", ar: "ألمنيوم أم ألواح؟" },
        body: {
          en: "We make both kinds of kitchen. Aluminium kitchens are made in aluminium, with glass where the design calls for it. Board kitchens are made from EGGER laminate and melamine, or painted MDF. Both are made to order, so the choice comes down to the look you want and how you use the room. We can talk through both with you at our Al-Hamalah showroom.",
          ar: "نصنع النوعين من المطابخ. تُصنع مطابخ الألمنيوم من الألمنيوم مع الزجاج حيث يتطلب التصميم ذلك، وتُصنع مطابخ الألواح من اللامينيت والميلامين من إيجر (EGGER) أو MDF المدهون. وكلاهما يُصنع حسب الطلب، فالاختيار يعود إلى المظهر الذي ترغبون فيه وطريقة استخدامكم للمطبخ. ويسعدنا مناقشة الخيارين معكم في صالة العرض بالهملة.",
        },
      },
      {
        title: { en: "Made for your room", ar: "مصنوعة لتناسب مطبخكم" },
        body: {
          en: "Your kitchen is not picked from a fixed range. We measure the space, prepare a design and agree it with you, then send a quotation for that design. Sizes, shapes and finishes follow your room, and production starts only after your approval.",
          ar: "لا يُختار مطبخكم من مجموعة ثابتة. نقيس المساحة ونعدّ التصميم ونتفق عليه معكم، ثم نرسل عرض سعر لهذا التصميم. وتتبع المقاسات والأشكال والتشطيبات مساحتكم، ولا يبدأ الإنتاج إلا بعد موافقتكم.",
        },
      },
      {
        title: { en: "What to tell us", ar: "ما نحتاج إلى معرفته" },
        body: {
          en: "To start, send us the rough size of the room and a photo or drawing if you have one, and tell us what you have in mind. We will advise on the options, including colours and glass, for your kitchen.",
          ar: "للبدء، أرسلوا إلينا المقاس التقريبي للغرفة وصورة أو مخططًا إن توفر لديكم، وأخبرونا بما تفكرون فيه. وسننصحكم بالخيارات المناسبة لمطبخكم، بما فيها الألوان والزجاج.",
        },
      },
    ],
    materials: ["aluminium"],
    // The profile doesn't say which project kitchens were aluminium, so none are linked here.
    scope: [],
  },
  {
    key: "wardrobes",
    name: { en: "Wardrobes", ar: "خزائن الملابس" },
    metaTitle: { en: "Fitted Wardrobes in Bahrain", ar: "خزائن ملابس مدمجة في البحرين" },
    metaDescription: {
      en: "Hinged-door and sliding-door wardrobes and glass-door closets, made to measure in EGGER boards or painted MDF and installed across Bahrain.",
      ar: "خزائن ملابس بأبواب مفصلية وأبواب منزلقة وخزائن بأبواب زجاجية، تُصنع على المقاس من ألواح إيجر (EGGER) أو MDF مدهون وتُركَّب في أنحاء البحرين.",
    },
    intro: {
      en: "Wardrobes made to fit the room, with hinged or sliding doors, and closets with glass doors. We produce wardrobes for single homes and in bulk for residential projects.",
      ar: "خزائن ملابس تُصنع لتناسب الغرفة، بأبواب مفصلية أو منزلقة، وخزائن بأبواب زجاجية. ننتج الخزائن للمنازل الفردية وبكميات كبيرة للمشاريع السكنية.",
    },
    makes: {
      en: [
        "Hinged-door wardrobes",
        "Sliding-door wardrobes",
        "Glass-door closets",
        "Bulk production for residential projects",
      ],
      ar: [
        "خزائن بأبواب مفصلية",
        "خزائن بأبواب منزلقة",
        "خزائن بأبواب زجاجية",
        "إنتاج بكميات كبيرة للمشاريع السكنية",
      ],
    },
    details: [
      {
        title: { en: "Hinged, sliding or glass", ar: "مفصلية أو منزلقة أو زجاجية" },
        body: {
          en: "Hinged doors, sliding doors and glass-door closets each suit a different room. We measure the wall the wardrobe will fill and make it to that size, so it fits the space rather than a standard width.",
          ar: "تناسب الأبواب المفصلية والمنزلقة والخزائن بأبواب زجاجية غرفًا مختلفة. نقيس الجدار الذي ستشغله الخزانة ونصنعها على مقاسه، فتتناسب مع المساحة بدلًا من عرض قياسي.",
        },
      },
      {
        title: { en: "For homes and residential projects", ar: "للمنازل والمشاريع السكنية" },
        body: {
          en: "Bulk wardrobe production and fixing is one of our specialities. We make wardrobes for single rooms and for whole residential projects, in EGGER boards or painted MDF, in our Hamad Town factory.",
          ar: "يُعد إنتاج خزائن الملابس وتركيبها بكميات كبيرة من تخصصاتنا. نصنع الخزائن لغرفة واحدة ولمشاريع سكنية كاملة، من ألواح إيجر (EGGER) أو MDF مدهون، في مصنعنا بمدينة حمد.",
        },
      },
    ],
    materials: ["egger", "mdf"],
    scope: ["closets"],
  },
  {
    key: "walkInClosets",
    name: { en: "Walk-in closets", ar: "غرف الملابس" },
    metaTitle: { en: "Walk-in Closets in Bahrain", ar: "غرف الملابس في البحرين" },
    metaDescription: {
      en: "Walk-in closets made to measure by Global Island Kitchens, in EGGER laminate and melamine boards or painted MDF, manufactured in Hamad Town.",
      ar: "غرف ملابس تُصنع على المقاس لدى Global Island Kitchens من ألواح اللامينيت والميلامين من إيجر (EGGER) أو MDF مدهون، في مصنعنا بمدينة حمد.",
    },
    intro: {
      en: "Walk-in closets, made to measure for the room you have. Designed, manufactured in our Hamad Town factory and installed by Global Island Kitchens.",
      ar: "غرف ملابس تُصنع على مقاس الغرفة لديكم، تُصمَّم وتُصنع في مصنعنا في مدينة حمد وتُركّبها Global Island Kitchens.",
    },
    makes: {
      en: ["Walk-in closets made to measure", "Designed, manufactured and installed by one company"],
      ar: ["غرف ملابس على المقاس", "تصميم وتصنيع وتركيب لدى شركة واحدة"],
    },
    details: [
      {
        title: { en: "Planned around the room", ar: "مصممة حول الغرفة" },
        body: {
          en: "A walk-in closet starts with the room itself. We measure it, then prepare a design for you to agree before anything is made. Our closets can include glass-door sections alongside the board finishes.",
          ar: "تبدأ غرفة الملابس من الغرفة نفسها. نقيسها ثم نعدّ تصميمًا تتفقون عليه قبل بدء التصنيع. ويمكن أن تضم خزائننا أقسامًا بأبواب زجاجية إلى جانب تشطيبات الألواح.",
        },
      },
      {
        title: { en: "Finishes that match the home", ar: "تشطيبات تتناسق مع المنزل" },
        body: {
          en: "Choose from EGGER laminate and melamine décors or MDF painted in the colour you choose, so the closet can match the bedroom furniture, doors or panelling around it.",
          ar: "اختاروا من تصاميم اللامينيت والميلامين من إيجر (EGGER) أو ألواح MDF مدهونة باللون الذي تختارونه، لتتناسق غرفة الملابس مع أثاث غرفة النوم أو الأبواب أو الألواح المحيطة بها.",
        },
      },
    ],
    materials: ["egger", "mdf"],
    scope: ["closets"],
  },
  {
    key: "bedroomFurniture",
    name: { en: "Bedroom furniture", ar: "أثاث غرف النوم" },
    metaTitle: { en: "Custom Bedroom Furniture, Bahrain", ar: "أثاث غرف نوم حسب الطلب، البحرين" },
    metaDescription: {
      en: "Bed sets with headboard panels, bedside units and dressing tables, and Murphy beds, made to order in EGGER boards or painted MDF in Bahrain.",
      ar: "أطقم غرف نوم بألواح خلفية للسرير ووحدات جانبية وتسريحات، وأسرّة قابلة للطي (Murphy)، تُصنع حسب الطلب من ألواح إيجر (EGGER) أو MDF مدهون في البحرين.",
    },
    intro: {
      en: "Bed sets made to order: headboard panels, bedside units and dressing tables, finished to match the rest of the room. We also make Murphy beds.",
      ar: "أطقم غرف نوم تُصنع حسب الطلب: ألواح خلفية للسرير ووحدات جانبية وتسريحات، بتشطيبات تتناسق مع بقية الغرفة. ونصنع أيضًا الأسرّة القابلة للطي (Murphy).",
    },
    makes: {
      en: ["Bed sets with headboard panels", "Bedside units", "Dressing tables", "Murphy beds"],
      ar: ["أطقم أسرّة بألواح خلفية", "وحدات جانبية", "تسريحات", "أسرّة قابلة للطي (Murphy)"],
    },
    details: [
      {
        title: { en: "A room that works together", ar: "غرفة متناسقة" },
        body: {
          en: "Because headboard panels, bedside units and dressing tables are all made to order, they can share one finish. Wardrobes and wall cladding from our range can be finished to match.",
          ar: "لأن الألواح الخلفية والوحدات الجانبية والتسريحات تُصنع جميعها حسب الطلب، يمكن أن تشترك في تشطيب واحد. ويمكن تشطيب خزائن الملابس وتكسيات الجدران من منتجاتنا لتتناسق معها.",
        },
      },
      {
        title: { en: "Murphy beds for smaller rooms", ar: "أسرّة قابلة للطي للغرف الصغيرة" },
        body: {
          en: "A Murphy bed folds away against the wall when it is not in use, which leaves the floor free in a guest room or a studio. Tell us about the room and we will advise on what fits.",
          ar: "يُطوى السرير القابل للطي (Murphy) على الجدار عند عدم استخدامه، فتبقى الأرضية خالية في غرفة الضيوف أو الاستوديو. حدّثونا عن الغرفة وسننصحكم بما يناسبها.",
        },
      },
    ],
    materials: ["egger", "mdf"],
    scope: ["bedSets"],
  },
  {
    key: "tvUnits",
    name: { en: "TV units", ar: "وحدات التلفزيون" },
    metaTitle: { en: "TV Units & Feature Walls, Bahrain", ar: "وحدات التلفزيون والجدران المميزة، البحرين" },
    metaDescription: {
      en: "TV units and feature walls with integrated lighting, made to measure in EGGER boards or painted MDF by Global Island Kitchens in Bahrain.",
      ar: "وحدات تلفزيون وجدران مميزة بإضاءة مدمجة، تُصنع على المقاس من ألواح إيجر (EGGER) أو MDF مدهون لدى Global Island Kitchens في البحرين.",
    },
    intro: {
      en: "TV units designed as feature walls, with integrated lighting, made to measure for your living space.",
      ar: "وحدات تلفزيون مصممة كجدران مميزة بإضاءة مدمجة، تُصنع على مقاس مساحة المعيشة لديكم.",
    },
    makes: {
      en: ["Feature walls with integrated lighting", "TV units made to measure"],
      ar: ["جدران مميزة بإضاءة مدمجة", "وحدات تلفزيون على المقاس"],
    },
    details: [
      {
        title: { en: "More than a stand", ar: "أكثر من مجرد حامل" },
        body: {
          en: "We treat the TV unit as a feature wall for the room, with integrated lighting built into the design. It is made to the width and height of your wall.",
          ar: "نتعامل مع وحدة التلفزيون كجدار مميز في الغرفة، بإضاءة مدمجة ضمن التصميم. وتُصنع على عرض جداركم وارتفاعه.",
        },
      },
      {
        title: { en: "Finished to suit the room", ar: "تشطيب يناسب الغرفة" },
        body: {
          en: "Choose EGGER boards in wood-grain, solid-colour or stone-look décors, or painted MDF. Wall cladding in the same finish can carry the look across the rest of the living area.",
          ar: "اختاروا ألواح إيجر (EGGER) بتصاميم بلون الخشب أو بألوان سادة أو بمظهر الحجر، أو MDF مدهونًا. ويمكن لتكسيات الجدران بالتشطيب نفسه أن تمد المظهر إلى بقية مساحة المعيشة.",
        },
      },
    ],
    materials: ["egger", "mdf"],
    scope: ["tvUnits"],
  },
  {
    key: "wallCladding",
    name: { en: "Wall cladding", ar: "تكسيات الجدران" },
    metaTitle: { en: "Wall Cladding & Panelling, Bahrain", ar: "تكسيات وألواح الجدران، البحرين" },
    metaDescription: {
      en: "Slatted and panel wall cladding and panelled living spaces with LED accents, in EGGER boards or painted MDF, made in Bahrain.",
      ar: "تكسيات جدران شرائحية وألواح، ومساحات معيشة مكسوّة بلمسات إضاءة LED، من ألواح إيجر (EGGER) أو MDF مدهون، تُصنع في البحرين.",
    },
    intro: {
      en: "Slatted and panel cladding for walls, and fully panelled living areas with LED accents, made in our factory to fit your rooms.",
      ar: "تكسيات شرائحية وألواح للجدران، ومساحات معيشة مكسوّة بالكامل بلمسات إضاءة LED، تُصنع في مصنعنا لتناسب غرفكم.",
    },
    makes: {
      en: ["Slatted wall cladding", "Panel cladding", "Panelled living areas with LED accents"],
      ar: ["تكسيات جدران شرائحية", "تكسيات بالألواح", "مساحات معيشة مكسوّة بلمسات إضاءة LED"],
    },
    details: [
      {
        title: { en: "Slats or panels", ar: "شرائح أو ألواح" },
        body: {
          en: "Slatted cladding adds vertical lines and depth to a wall. Panel cladding gives a calmer, flatter surface. Either can sit behind a bed, around a TV or across a whole living area.",
          ar: "تضيف التكسيات الشرائحية خطوطًا عمودية وعمقًا إلى الجدار، بينما تمنح تكسيات الألواح سطحًا أهدأ وأكثر استواءً. ويمكن استخدام كل منهما خلف السرير أو حول التلفزيون أو في مساحة المعيشة بأكملها.",
        },
      },
      {
        title: { en: "Made to fit your walls", ar: "تُصنع لتناسب جدرانكم" },
        body: {
          en: "Cladding is cut and finished in our Hamad Town factory to the measurements of your rooms, in EGGER boards or painted MDF. LED accents can be built in for panelled living areas.",
          ar: "تُقص التكسيات وتُشطَّب في مصنعنا بمدينة حمد وفق مقاسات غرفكم، من ألواح إيجر (EGGER) أو MDF مدهون. ويمكن دمج لمسات إضاءة LED في مساحات المعيشة المكسوّة بالألواح.",
        },
      },
    ],
    materials: ["egger", "mdf"],
    scope: ["cladding"],
  },
  {
    key: "bathroomVanities",
    name: { en: "Bathroom vanities", ar: "وحدات المغاسل" },
    metaTitle: { en: "Bathroom Vanities in Bahrain", ar: "وحدات مغاسل الحمامات في البحرين" },
    metaDescription: {
      en: "Floating and tall-unit bathroom vanities made to measure by Global Island Kitchens, manufactured in Hamad Town and installed across Bahrain.",
      ar: "وحدات مغاسل معلّقة وطويلة تُصنع على المقاس لدى Global Island Kitchens في مصنعنا بمدينة حمد وتُركَّب في أنحاء البحرين.",
    },
    intro: {
      en: "Floating vanities and tall storage units for bathrooms, made to measure for homes and residential projects.",
      ar: "وحدات مغاسل معلّقة ووحدات تخزين طويلة للحمامات، تُصنع على المقاس للمنازل والمشاريع السكنية.",
    },
    makes: {
      en: ["Floating vanities", "Tall-unit vanities", "Made to measure for homes and residential projects"],
      ar: ["وحدات مغاسل معلّقة", "وحدات مغاسل طويلة", "على المقاس للمنازل والمشاريع السكنية"],
    },
    details: [
      {
        title: { en: "Floating or tall", ar: "معلّقة أو طويلة" },
        body: {
          en: "A floating vanity keeps the floor clear, and a tall unit adds storage where wall space allows. Both are made to the measurements of your bathroom.",
          ar: "تُبقي وحدة المغسلة المعلّقة الأرضية خالية، وتضيف الوحدة الطويلة مساحة تخزين حيث يسمح الجدار. وتُصنع كلتاهما وفق مقاسات حمامكم.",
        },
      },
      {
        title: { en: "For one bathroom or many", ar: "لحمام واحد أو عدة حمامات" },
        body: {
          en: "We make vanities for single homes and for residential buildings and villas, where every bathroom can follow one agreed design. They are made in our Hamad Town factory and installed by our company.",
          ar: "نصنع وحدات المغاسل للمنازل الفردية وللمباني السكنية والفلل، حيث يمكن أن تتبع جميع الحمامات تصميمًا واحدًا متفقًا عليه. وتُصنع في مصنعنا بمدينة حمد وتتولى شركتنا تركيبها.",
        },
      },
    ],
    materials: ["egger", "mdf"],
    scope: ["vanities"],
  },
];

export function getProduct(key: ProductKey) {
  const product = products.find((p) => p.key === key);
  if (!product) throw new Error(`Unknown product ${key}`);
  return product;
}

/** Other products from the profile without their own page. */
export const moreProducts: LList = {
  en: [
    "Laundry rooms with fitted cabinets and smart storage",
    "Laminate doors with concealed hinges and matching handles",
    "Murphy beds",
    "Custom cabinets and bespoke pieces",
  ],
  ar: [
    "غرف غسيل بخزائن مجهّزة وتخزين ذكي",
    "أبواب من اللامينيت بمفصلات مخفية ومقابض متطابقة",
    "أسرّة قابلة للطي (Murphy)",
    "خزائن وقطع حسب الطلب",
  ],
};
