/**
 * Every project on the site, in display order.
 *
 * To add a project: drop its media in /public/work/<slug>/, copy one of the
 * entries below and edit it. The home gallery, the /work index, the case
 * study page, related projects, previous/next and the sitemap all read from
 * this file.
 *
 * Text fields left `undefined` under `story` are unfinished. They render as
 * a marked placeholder while `site.showPlaceholders` is true and disappear
 * when it is false. Nothing here should be invented: write what happened.
 */

export const categories = [
  {
    id: "multimedia",
    index: "01",
    name: "Multimedia design",
    description: "Visual concepts, digital campaigns, video, animation and multimedia experiences.",
  },
  {
    id: "brand",
    index: "02",
    name: "Brand & identity",
    description: "Visual identities, brand systems, logos and brand communication.",
  },
  {
    id: "digital",
    index: "03",
    name: "Digital design",
    description: "Websites, digital campaigns, interactive experiences and digital content.",
  },
  {
    id: "campaigns",
    index: "04",
    name: "Creative campaigns",
    description: "Advertising concepts, marketing visuals, campaign development and storytelling.",
  },
  {
    id: "motion",
    index: "05",
    name: "Motion & video",
    description: "Motion graphics, animations, video content and visual storytelling.",
  },
  {
    id: "uiux",
    index: "06",
    name: "UI / UX",
    description: "Digital interfaces, user experiences, prototypes and interactive products.",
  },
] as const;

export type CategoryId = (typeof categories)[number]["id"];

export type Media =
  | { type: "image"; src: string; width: number; height: number; alt: string }
  | { type: "video"; src: string; width: number; height: number; alt: string }
  /** A YouTube video: local poster image, player loads only after a click. */
  | { type: "youtube"; id: string; poster: string; width: number; height: number; alt: string }
  /** A designed stand-in for media that has not been supplied yet. */
  | { type: "pending"; width: number; height: number; alt: string; note: string };

export type GalleryBlock =
  | { layout: "full"; media: Media; caption?: string }
  | { layout: "pair"; media: [Media, Media]; caption?: string }
  | { layout: "inset"; media: Media; caption?: string }
  | { layout: "trio"; media: [Media, Media, Media]; caption?: string };

export type Project = {
  slug: string;
  title: string;
  client: string;
  category: CategoryId;
  year: string;
  discipline: string;
  /** One or two sentences, shown on cards and in metadata. */
  summary: string;
  cover: Media;
  /** How the card sits in the home gallery. */
  cardShape: "wide" | "landscape" | "portrait";
  overview: string;
  role: string;
  deliverables: string[];
  tools: string[];
  credits: { label: string; value: string }[];
  story: {
    background?: string;
    strategy?: string;
    concept?: string;
  };
  exploration: GalleryBlock[];
  execution: GalleryBlock[];
  source?: { label: string; href: string };
};

const img = (src: string, width: number, height: number, alt: string): Media => ({
  type: "image",
  src,
  width,
  height,
  alt,
});

export const projects: Project[] = [
  {
    slug: "impermo",
    title: "Impermo",
    client: "Impermo",
    category: "multimedia",
    year: "2020 – 2022",
    discipline: "Print, web, video & animation",
    summary:
      "Two years as graphic brand builder for one of Belgium’s largest tile specialists: catalogues, magazines, web assets, animation and video for the Benelux market.",
    cover: img("/work/impermo/01.webp", 1400, 1401, "Impermo garden catalogue 2021 on a stone surface with yellow flowers"),
    cardShape: "wide",
    overview:
      "Impermo has more than 100 years of experience in tiles, natural stone and parquet, with 120 employees across 10 branches and some of the widest tile ranges in the Benelux. As graphic brand builder I created the print, digital and web assets that carried the Impermo identity to builders and renovators.",
    role: "Graphic Brand Builder",
    deliverables: [
      "Catalogues & magazines",
      "POS & product displays",
      "Packaging & window stickers",
      "2D & 3D animation",
      "Instruction videos",
      "Newsletters & web banners",
      "Product imagery",
      "Presentations",
    ],
    tools: ["InDesign", "Photoshop", "Illustrator", "After Effects", "Lightroom"],
    credits: [
      { label: "Client", value: "Impermo" },
      { label: "Role", value: "Graphic Brand Builder" },
      { label: "Market", value: "Benelux" },
      { label: "Period", value: "2020 – 2022" },
    ],
    story: {
      background:
        "My job was to create and develop print materials and web assets for the Benelux market with the Impermo branding guidelines in mind: from product displays, logos, magazines, catalogues, banners, packaging and window stickers to 2D and 3D animations, instruction videos, newsletters, web banners, product images and presentations.",
      strategy: undefined,
      concept: undefined,
    },
    exploration: [
      {
        layout: "pair",
        media: [
          img("/work/impermo/05.webp", 1400, 1738, "Catalogue spread introducing the Impermo online platform, in Dutch and French"),
          img("/work/impermo/06.webp", 1400, 1738, "Catalogue page with a map of Impermo branches across Belgium"),
        ],
        caption: "Bilingual editorial pages from the 2021 garden catalogue.",
      },
      {
        layout: "pair",
        media: [
          img("/work/impermo/07.webp", 1400, 1738, "Catalogue page with a bilingual statement from the Impermo management"),
          img("/work/impermo/08.webp", 1400, 1738, "Chapter opener for ceramic terrace tiles, in Dutch and French"),
        ],
        caption: "Quiet typography gives the product photography room.",
      },
    ],
    execution: [
      {
        layout: "full",
        media: img("/work/impermo/03.webp", 1400, 1738, "Cover of the Impermo garden catalogue 2021"),
        caption: "Tuincatalogus 2021 · Catalogue Jardin 2021.",
      },
      {
        layout: "full",
        media: img("/work/impermo/02.webp", 2000, 1333, "Website shown on a desktop display and two phones"),
        caption: "Web assets on desktop and mobile.",
      },
      {
        layout: "inset",
        media: img("/work/impermo/04.webp", 2000, 1475, "Printed Impermo magazine"),
        caption: "Printed magazine.",
      },
    ],
    source: { label: "Garden catalogue on Behance", href: "https://www.behance.net/gallery/177406799/Garden-catalog" },
  },
  {
    slug: "covas-immo",
    title: "Covas Immo",
    client: "Covas Immo",
    category: "brand",
    year: "2022",
    discipline: "Brand identity",
    summary:
      "A brand identity for a real-estate agency in Leuven, carried from the monogram to window signage, vehicle livery, posters and property listings.",
    cover: img("/work/covas-immo/01.webp", 1400, 931, "Covas Immo window signage on a street in Leuven"),
    cardShape: "landscape",
    overview:
      "Brand identity for a real-estate client based in Leuven. A CV monogram, a soft mint and a near-black form a system that works on a shop window, a scooter, a billboard and a printed listing alike.",
    role: "Art direction & brand design",
    deliverables: [
      "Logo & monogram",
      "Colour & typography",
      "Window signage",
      "Vehicle livery",
      "Posters & billboards",
      "Property listing templates",
    ],
    tools: ["Illustrator", "InDesign", "Photoshop", "Lightroom", "After Effects", "Figma"],
    credits: [
      { label: "Client", value: "Covas Immo" },
      { label: "Studio", value: "ArtLab" },
      { label: "Sector", value: "Real estate" },
      { label: "Location", value: "Leuven" },
    ],
    story: {
      background: undefined,
      strategy: undefined,
      concept: undefined,
    },
    exploration: [
      {
        layout: "pair",
        media: [
          img("/work/covas-immo/05.webp", 1400, 1354, "Stylised map of Leuven’s city gates in the Covas Immo colours"),
          img("/work/covas-immo/06.webp", 750, 1019, "Covas Immo poster: your partner in luxury real estate in and around Leuven"),
        ],
        caption: "The city itself becomes a brand asset: Leuven’s gates drawn in the identity’s mint.",
      },
      {
        layout: "full",
        media: { type: "video", src: "/work/covas-immo/livery.mp4", width: 1400, height: 788, alt: "Turnaround of a car with the Covas Immo monogram livery" },
        caption: "Vehicle livery, all sides.",
      },
    ],
    execution: [
      {
        layout: "full",
        media: img("/work/covas-immo/04.webp", 1400, 1033, "Covas Immo billboard in an underground passage"),
        caption: "Out-of-home.",
      },
      {
        layout: "pair",
        media: [
          img("/work/covas-immo/07.webp", 1170, 1662, "Property posters for The Vine and Van Waeyenbergh developments"),
          img("/work/covas-immo/08.webp", 1170, 1602, "Property listing poster with four homes"),
        ],
        caption: "Listing templates for developments and individual properties.",
      },
      {
        layout: "inset",
        media: img("/work/covas-immo/02.webp", 1400, 994, "Black scooter with the Covas Immo monogram"),
        caption: "The monogram at street level.",
      },
      {
        layout: "full",
        media: img("/work/covas-immo/03.webp", 1800, 1200, "Black car with the Covas Immo monogram on its side"),
      },
    ],
    source: { label: "Project on Behance", href: "https://www.behance.net/gallery/156738589/Brand-ID-Covas-Immo-Real-Estate" },
  },
  {
    slug: "rave-and-ride",
    title: "Rave and Ride",
    client: "Self-initiated",
    category: "digital",
    year: "2024",
    discipline: "Visual identity & digital artwork",
    summary:
      "A visual identity and poster series built from classical sculpture, acid green, barcodes and club typography.",
    cover: img("/work/rave-and-ride/01.webp", 1400, 933, "Grid of Rave and Ride posters in acid green"),
    cardShape: "portrait",
    overview:
      "Rave and Ride is an identity exploration: a chrome RR mark, a hard acid green and a set of posters built from statues, astronauts and overprinted type.",
    role: "Concept, identity & artwork",
    deliverables: ["Logo mark", "Poster series", "Framed print set", "Digital artwork"],
    tools: ["Photoshop", "Illustrator", "InDesign", "Lightroom", "Figma"],
    credits: [
      { label: "Type", value: "Self-initiated" },
      { label: "Studio", value: "ArtLab" },
      { label: "Fields", value: "Graphic design, fashion, advertising" },
      { label: "Published", value: "2024" },
    ],
    story: {
      background: undefined,
      strategy: undefined,
      concept: undefined,
    },
    exploration: [
      {
        layout: "full",
        media: img("/work/rave-and-ride/06.webp", 1400, 788, "Chrome RR logo on a black, dusty background"),
        caption: "The RR mark.",
      },
      {
        layout: "pair",
        media: [
          img("/work/rave-and-ride/04.webp", 1400, 1050, "Four framed prints in dark frames"),
          img("/work/rave-and-ride/05.webp", 1400, 1050, "Four framed prints in white frames"),
        ],
        caption: "Print set, two frame options.",
      },
    ],
    execution: [
      {
        layout: "inset",
        media: img("/work/rave-and-ride/02.webp", 1400, 2100, "Tall grid of Rave and Ride posters"),
        caption: "Poster series.",
      },
      {
        layout: "full",
        media: img("/work/rave-and-ride/03.webp", 1400, 823, "Rave and Ride astronaut poster framed on a wall"),
        caption: "Poster in situ.",
      },
    ],
    source: { label: "Project on Behance", href: "https://www.behance.net/gallery/188666481/Rave-and-Ride" },
  },
  {
    slug: "graco-emea",
    title: "Graco EMEA",
    client: "Graco",
    category: "campaigns",
    year: "2010 – 2020",
    discipline: "Campaigns, print & communication",
    summary:
      "Nearly a decade of campaign work for Graco across Europe, the Middle East and Africa: product launches, advertising, roll-ups, brochures and point of sale.",
    cover: img("/work/graco-emea/01.webp", 1400, 933, "Five framed Graco campaign posters on a dark wall"),
    cardShape: "wide",
    overview:
      "As Communication Specialist for EMEA I designed, coordinated and published Graco’s internal and external communications in line with its corporate image: advertisements, brochures, leaflets, mailings and point-of-sale material, including translation and print preparation for each market.",
    role: "Communication Specialist, EMEA",
    deliverables: [
      "Advertising",
      "Product campaigns",
      "Brochures & leaflets",
      "Roll-up banners",
      "Mailings",
      "Point of sale",
      "Web imagery",
    ],
    tools: ["InDesign", "Photoshop", "Illustrator"],
    credits: [
      { label: "Client", value: "Graco" },
      { label: "Role", value: "Communication Specialist" },
      { label: "Region", value: "EMEA" },
      { label: "Period", value: "2010 – 2020" },
    ],
    story: {
      background:
        "The brief stayed constant while the products changed: publish every communication on time and on brand, lay out each piece for print, coordinate translations where a market needed them, supply photography for the company’s websites and keep an archive of all European projects.",
      strategy: undefined,
      concept: undefined,
    },
    exploration: [
      {
        layout: "full",
        media: img("/work/graco-emea/04.webp", 1400, 594, "Product range overview with rows of Graco sprayers"),
        caption: "Range overview: one system for a full product family.",
      },
    ],
    execution: [
      {
        layout: "pair",
        media: [
          img("/work/graco-emea/02.webp", 1400, 1969, "Key visual: a Graco sprayer held in two hands against a blue circuit background"),
          img("/work/graco-emea/05.webp", 1400, 3300, "Graco BlueLink campaign banner: connect today, ensure your future"),
        ],
        caption: "BlueLink campaign key visual and banner.",
      },
      {
        layout: "full",
        media: img("/work/graco-emea/03.webp", 2000, 1475, "Three Graco roll-up banners"),
        caption: "Roll-up banners.",
      },
    ],
    source: { label: "Product campaign on Behance", href: "https://www.behance.net/gallery/150654067/Product-campaign-by-ArtLab" },
  },
  {
    slug: "artlab-logo-animation",
    title: "ArtLab logo animation",
    client: "ArtLab",
    category: "motion",
    year: "2026",
    discipline: "Motion graphics",
    summary: "The ArtLab wordmark brought to life as a glowing neon sign above a dark, reflective floor.",
    cover: {
      type: "youtube",
      id: "duBXquTEQTI",
      poster: "/work/artlab-logo-animation/poster.webp",
      width: 1280,
      height: 720,
      alt: "ArtLab logo animation: neon wordmark glowing above a dark reflective floor",
    },
    cardShape: "landscape",
    overview:
      "A logo animation for ArtLab, my own studio. Motion runs through most of the work on this site: animations and instruction videos for Impermo, in-app stories for Banx and animated visuals for consulting clients.",
    role: "Motion design",
    deliverables: ["Logo animation"],
    tools: ["After Effects"],
    credits: [
      { label: "Client", value: "ArtLab" },
      { label: "Format", value: "Logo animation" },
    ],
    story: {
      background: undefined,
      strategy: undefined,
      concept: undefined,
    },
    exploration: [],
    execution: [],
    source: { label: "Watch on YouTube", href: "https://youtu.be/duBXquTEQTI" },
  },
  {
    slug: "belfius-banx",
    title: "Banx",
    client: "Belfius × Proximus",
    category: "uiux",
    year: "2022",
    discipline: "UI design, prototyping & digital content",
    summary:
      "Interface design, prototypes, landing pages and weekly in-app stories for Banx, the banking app by Belfius and Proximus.",
    cover: img("/work/belfius-banx/01.webp", 2000, 1333, "Five phones showing Banx app screens in different colour themes"),
    cardShape: "landscape",
    overview:
      "I was responsible for designing and managing the digital assets, UI designs, prototypes and wireframes for the Banx website and banking app, working with the Proximus marketing team so every design matched the brand while meeting usability and web standards.",
    role: "Digital Designer",
    deliverables: [
      "UI design",
      "Wireframes & prototypes",
      "3 promotional landing pages, web and app",
      "3 – 4 in-app stories a week, NL & FR",
      "Digital assets",
    ],
    tools: ["Figma", "Adobe XD", "Photoshop", "After Effects"],
    credits: [
      { label: "Client", value: "Belfius" },
      { label: "Partner", value: "Proximus" },
      { label: "Product", value: "Banx website & app" },
      { label: "Period", value: "2022" },
    ],
    story: {
      background:
        "Banx lives in two places at once, a website and a banking app, and speaks two languages. The work covered both: interface design and prototypes for the product, three promotional landing pages for web and app, and three to four in-app stories every week in Dutch and French.",
      strategy: undefined,
      concept: undefined,
    },
    exploration: [],
    execution: [
      {
        layout: "full",
        media: img("/work/belfius-banx/02.webp", 2000, 1333, "Banx app home screen on a phone, in French"),
        caption: "App home screen.",
      },
      {
        layout: "full",
        media: img("/work/belfius-banx/01.webp", 2000, 1333, "Five phones showing Banx app screens in different colour themes"),
        caption: "Colour themes across the app.",
      },
    ],
  },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);

export const getCategory = (id: CategoryId) => categories.find((c) => c.id === id)!;

export function getNeighbours(slug: string) {
  const i = projects.findIndex((p) => p.slug === slug);
  const n = projects.length;
  return { previous: projects[(i - 1 + n) % n], next: projects[(i + 1) % n] };
}

export function getRelated(slug: string, count = 2) {
  const { next } = getNeighbours(slug);
  const rest = projects.filter((p) => p.slug !== slug && p.slug !== next.slug);
  const i = projects.findIndex((p) => p.slug === slug);
  // Rotate so related projects differ per page instead of always the first two.
  return [...rest.slice(i % rest.length), ...rest.slice(0, i % rest.length)].slice(0, count);
}
