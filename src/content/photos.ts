import type { ProductKey } from "./products";
import type { L } from "./types";

/**
 * Photographs from the company profile. The owner confirmed they are the company's own work and may
 * be published (docs/OPEN_QUESTIONS.md #2). Files are in public/images, prepared by
 * scripts/prepare-photos.mjs at the profile's own resolution (they are small: never enlarge them).
 * Alt text describes what is visible and names no client (permission to name clients is #24).
 */

export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: L;
}

function photo(name: string, width: number, height: number, en: string, ar: string): Photo {
  return { src: `/images/${name}.webp`, width, height, alt: { en, ar } };
}

export const photos = {
  heroKitchen: photo(
    "hero-kitchen",
    893,
    674,
    "Kitchen with warm wood-grain tall and wall units, cream base units and an island with bar stools",
    "مطبخ بوحدات عالية وعلوية بتدرجات خشبية دافئة ووحدات سفلية كريمية وجزيرة مع كراسي مرتفعة",
  ),
  walkInCloset: photo(
    "walk-in-closet",
    760,
    515,
    "Walk-in closet with glass-fronted wardrobes, lit shelving and a central island",
    "غرفة ملابس مفتوحة بخزائن بواجهات زجاجية ورفوف مضاءة وجزيرة وسطية",
  ),
  tvUnit: photo(
    "tv-unit",
    760,
    515,
    "Living room wall unit with a television, lit display shelves and wood-grain panels",
    "وحدة جدارية في غرفة المعيشة تضم تلفزيونًا ورفوف عرض مضاءة وألواحًا بتدرجات خشبية",
  ),
  vanity: photo(
    "vanity",
    701,
    475,
    "Bathroom with a wood-grain panel wall and open shelving",
    "حمّام بجدار من الألواح الخشبية ورفوف مفتوحة",
  ),
  wallCladding: photo(
    "wall-cladding",
    582,
    394,
    "Bedroom with vertical wood slat wall cladding behind the bed",
    "غرفة نوم بتكسية جدارية من شرائح خشبية عمودية خلف السرير",
  ),
  livingRoom: photo(
    "living-room",
    760,
    515,
    "Living room with a panelled feature wall, round mirror and console",
    "غرفة معيشة بجدار مكسو بالألواح ومرآة دائرية وكونسول",
  ),
  bedSet: photo(
    "bed-set",
    719,
    708,
    "Bedroom with a panelled headboard wall and bedside lighting",
    "غرفة نوم بجدار رأس سرير مكسو بالألواح وإضاءة جانبية",
  ),
  interiorDoors: photo(
    "interior-doors",
    760,
    750,
    "Wood-grain interior doors with matt black handles and concealed hinges",
    "أبواب داخلية بتدرجات خشبية بمقابض سوداء مطفية ومفصلات مخفية",
  ),
  kitchenLaundry: photo(
    "kitchen-laundry",
    760,
    750,
    "L-shaped kitchen with cream cabinets, a wood-grain tall unit and a stacked washer and dryer",
    "مطبخ على شكل حرف L بخزائن كريمية ووحدة عالية خشبية وغسالة ومجففة فوق بعضهما",
  ),

  // Projects
  alFarisLiving: photo(
    "al-faris-living",
    1132,
    378,
    "Furnished dining and living area with wood-grain joinery",
    "منطقة طعام ومعيشة مفروشة بأعمال نجارة بتدرجات خشبية",
  ),
  alFarisBedroom1: photo(
    "al-faris-bedroom-1",
    769,
    375,
    "Bedroom with a wood-grain headboard wall and built-in wardrobe",
    "غرفة نوم بجدار رأس سرير خشبي وخزانة مدمجة",
  ),
  alFarisBedroom2: photo(
    "al-faris-bedroom-2",
    769,
    375,
    "Bedroom with a platform bed, wood-grain wall panels and a built-in desk",
    "غرفة نوم بسرير منخفض وألواح جدارية بتدرجات خشبية ومكتب مدمج",
  ),
  alFarisBuilding: photo(
    "al-faris-building",
    503,
    378,
    "Residential tower seen from the street",
    "برج سكني من مستوى الشارع",
  ),
  marassiLounge: photo(
    "marassi-lounge",
    529,
    433,
    "Furnished lounge with a wall-mounted television and wood-grain wall panels",
    "صالة مفروشة بتلفزيون مثبت على الجدار وألواح جدارية بتدرجات خشبية",
  ),
  marassiBedroom1: photo(
    "marassi-bedroom-1",
    529,
    433,
    "Furnished bedroom with a wood-grain headboard and curtains",
    "غرفة نوم مفروشة برأس سرير خشبي وستائر",
  ),
  marassiBedroom2: photo(
    "marassi-bedroom-2",
    529,
    433,
    "Studio bedroom with a lit wood-grain headboard panel",
    "غرفة نوم في استوديو بلوح رأس سرير خشبي مضاء",
  ),
  marassiLounge2: photo(
    "marassi-lounge-2",
    529,
    433,
    "Furnished living area with a sofa and wood-grain feature wall",
    "منطقة معيشة مفروشة بأريكة وجدار مميز بتدرجات خشبية",
  ),
  capriSuites: photo(
    "capri-suites",
    503,
    378,
    "Residential building of five storeys in Janabiya",
    "مبنى سكني من خمسة طوابق في الجنبية",
  ),
  adliyaBuilding: photo(
    "adliya-building",
    503,
    378,
    "Residential building of seven storeys in Adliya",
    "مبنى سكني من سبعة طوابق في العدلية",
  ),
  nuwaidratBuilding: photo(
    "nuwaidrat-building",
    503,
    378,
    "Residential building in Nuwaidrat, Sanad",
    "مبنى سكني في النويدرات، سند",
  ),
  aaliVillasA: photo(
    "pearls-four-villas",
    503,
    378,
    "Villa from the four-villa project in Aali",
    "فيلا من مشروع الفلل الأربع في عالي",
  ),
  aaliVillasB: photo(
    "pearls-villas-aali",
    503,
    378,
    "Villas in Aali with a modern two-storey front",
    "فلل في عالي بواجهة حديثة من طابقين",
  ),
  villa414: photo(
    "villa-414-riffa",
    503,
    378,
    "414 Villa in Riffa, two storeys",
    "فيلا 414 في الرفاع، طابقان",
  ),
  northRiffa: photo("pearls-north-riffa", 503, 378, "Villa in North Riffa", "فيلا في الرفاع الشمالي"),
  alNaseem: photo(
    "al-naseem-phase-2",
    503,
    378,
    "Villa in Al Naseem Phase 2, Diyar Al Muharraq",
    "فيلا في النسيم المرحلة 2، ديار المحرق",
  ),
  derbyCafe: photo(
    "derby-cafe-booth",
    503,
    378,
    "Cafe booth with a red feature ceiling, display shelving and a service counter",
    "ركن مقهى بسقف أحمر مميز ورفوف عرض ومنصة خدمة",
  ),
  selvisCafe: photo(
    "selvis-cafe",
    503,
    378,
    "Cafe interior with wall shelving, a panelled ceiling and dining tables",
    "داخل مقهى برفوف جدارية وسقف مكسو بالألواح وطاولات طعام",
  ),
  trollyMarket: photo(
    "trolly-market",
    503,
    378,
    "Market interior with a feature entrance, shelving and a counter",
    "داخل متجر بمدخل مميز ورفوف ومنصة",
  ),
  gardenVilla1: photo(
    "garden-villa-1",
    503,
    336,
    "Garden villa with an arched porch and tiled roof",
    "فيلا بحديقة برواق مقوّس وسقف قرميدي",
  ),
  gardenVilla2: photo(
    "garden-villa-2",
    495,
    330,
    "Garden villa with a paved path and lawn",
    "فيلا بحديقة ومسار مرصوف ومساحة خضراء",
  ),
  gardenVilla3: photo(
    "garden-villa-3",
    503,
    336,
    "Garden villa with arched windows and a lawn",
    "فيلا بحديقة بنوافذ مقوّسة ومساحة خضراء",
  ),

  // Factory
  panelSaw: photo(
    "machine-panel-saw",
    760,
    450,
    "Sliding panel cutting machine",
    "ماكينة قص الألواح المنزلقة",
  ),
  edgeBanding: photo(
    "machine-edge-banding",
    760,
    450,
    "Lipping (edge banding) machine",
    "ماكينة تغليف الحواف",
  ),
  boringStation: photo(
    "machine-boring",
    760,
    450,
    "Triple axis pneumatic boring station",
    "محطة حفر هوائية ثلاثية المحاور",
  ),
  miterStation: photo("machine-miter", 760, 450, "Miter station", "محطة قص بزاوية"),
} satisfies Record<string, Photo>;

/** Product pages and cards that have a photo from the company profile; the others show a finish illustration. */
export const productPhotos: Partial<Record<ProductKey, Photo>> = {
  woodenKitchens: photos.heroKitchen,
  walkInClosets: photos.walkInCloset,
  tvUnits: photos.tvUnit,
  bathroomVanities: photos.vanity,
  wallCladding: photos.wallCladding,
  bedroomFurniture: photos.bedSet,
};

/** Photos per project, by project slug. */
export const projectPhotos: Record<string, Photo[]> = {
  "al-faris-suite-2-juffair": [
    photos.alFarisLiving,
    photos.alFarisBedroom1,
    photos.alFarisBedroom2,
    photos.alFarisBuilding,
  ],
  "marassi-bay-flats": [
    photos.marassiLounge,
    photos.marassiBedroom1,
    photos.marassiBedroom2,
    photos.marassiLounge2,
  ],
  "capri-suites-janabiya": [photos.capriSuites],
  "residential-building-adliya": [photos.adliyaBuilding],
  "residential-project-nuwaidrat": [photos.nuwaidratBuilding],
  "villas-aali": [photos.aaliVillasB, photos.aaliVillasA],
  "414-villa-riffa": [photos.villa414],
  "villas-north-riffa": [photos.northRiffa],
  "al-naseem-phase-2": [photos.alNaseem],
  "garden-villas": [photos.gardenVilla1, photos.gardenVilla2, photos.gardenVilla3],
  "cafe-booth-sitra": [photos.derbyCafe],
  "cafe-interiors-hamad-town": [photos.selvisCafe],
  "retail-interiors-diyar-al-muharraq": [photos.trollyMarket],
};

export const factoryPhotos = [photos.panelSaw, photos.edgeBanding, photos.boringStation, photos.miterStation];
