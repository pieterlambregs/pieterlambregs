/**
 * Site-wide content. Everything a visitor reads outside the case studies
 * lives here, so copy can change without touching a component.
 */

export const site = {
  name: "Pieter Lambregs",
  url: "https://artlab-media.be",
  role: "Multidisciplinary Designer",
  tagline: "Creative Thinker. Visual Maker.",
  intro:
    "I turn ideas into meaningful visual experiences. Working across design, branding, multimedia and digital innovation, I combine creative thinking with hands-on execution to create work that connects people, brands and technology.",
  description:
    "Pieter Lambregs is a multidisciplinary designer based in Belgium with 18 years of experience across branding, multimedia, digital design, motion and creative technology.",
  location: "Belgium",
  timezone: "Europe/Brussels",
  years: "18",
  currentEmployer: "EG",
  currentRole: "Designer",
  status: "Open to new ideas",
  email: "info@artlab-media.be",

  /**
   * Case-study sections that still need Pieter's own words render as clearly
   * marked placeholders. Set to false to hide every unfinished section
   * instead (the rest of the page closes up around them).
   */
  showPlaceholders: false,
} as const;

export const nav = [
  { label: "Work", href: "/#work" },
  { label: "About", href: "/#about" },
  { label: "Expertise", href: "/#expertise" },
  { label: "Contact", href: "/#contact" },
] as const;

export const socials = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/pieter-lambregs/" },
  { label: "Behance", href: "https://www.behance.net/pieterlambregs" },
  { label: "Instagram", href: "https://instagram.com/pieterlambregs.artlab" },
  { label: "YouTube", href: "https://www.youtube.com/channel/UCzN-hm9fPv8sWuL1PVWPYkQ" },
  { label: "ArtLab portfolio", href: "https://artlab-media.be/" },
] as const;

export const philosophy = {
  headline: ["Design is more", "than what you see."],
  body: "I believe great design lives at the intersection of clarity, creativity and purpose. It is about finding the right visual language, asking the right questions and translating ideas into experiences that make an impact.",
};

export const about = {
  headline: ["Curious by nature.", "Creative by design."],
  paragraphs: [
    "I’m Pieter Lambregs, a multidisciplinary visual designer with 18 years of experience bringing ideas to life through design and communication.",
    "Throughout my career, I’ve worked across a broad range of creative disciplines, from branding and graphic design to multimedia, digital experiences and visual storytelling.",
    "I enjoy exploring new technologies, discovering different ways of working and finding creative solutions to complex challenges.",
    "For me, design is a continuous process of learning, experimenting and creating.",
  ],
  /**
   * Sourced from Pieter's LinkedIn profile; EG, Sia Partners and the years of
   * experience confirmed by Pieter in November 2026.
   */
  experience: [
    { company: "EG", role: "Designer", period: "2026 – Now" },
    { company: "Autoglass Clinic", role: "Marketing Lead, BeLux", period: "2025 – 2026" },
    { company: "Sia Partners", role: "Senior Marketing & UX/UI Consultant", period: "2024 – 2025" },
    { company: "DYKA Belgium", role: "Digital Marketing Manager", period: "2023" },
    { company: "Belfius · Banx", role: "Digital Designer", period: "2022" },
    { company: "Impermo", role: "Graphic Brand Builder", period: "2020 – 2022" },
    { company: "ArtLab", role: "Freelance Art Director", period: "2015 – 2025" },
    { company: "Graco", role: "Communication Specialist, EMEA", period: "2010 – 2020" },
    { company: "Hellinx Printing", role: "Graphic Designer", period: "2008 – 2009" },
  ],
  facts: [
    { label: "Experience", value: "18 years" },
    { label: "Based in", value: "Bilzen, Belgium" },
    { label: "Education", value: "Graphic Design, Katholieke Hogeschool Limburg" },
    { label: "Languages", value: "Dutch, English, French, German" },
  ],
};

export type Discipline = {
  name: string;
  description: string;
  keywords: string[];
  preview: { type: "image" | "video"; src: string; alt: string };
};

export const expertise: Discipline[] = [
  {
    name: "Art direction",
    description:
      "Setting the visual course of a campaign or brand, then holding it steady across every channel, format and market.",
    keywords: ["Concept", "Campaign", "Direction"],
    preview: { type: "image", src: "/work/graco-emea/01.webp", alt: "Wall of Graco campaign posters" },
  },
  {
    name: "Graphic design",
    description:
      "Posters, catalogues, magazines and packaging. Typography and layout that read clearly at any size, on paper and on screen.",
    keywords: ["Print", "Editorial", "Typography"],
    preview: { type: "image", src: "/work/archive/01.webp", alt: "Schijnheilig poster" },
  },
  {
    name: "Branding",
    description:
      "Logos, colour, type and image style built into identity systems a team can keep using long after launch.",
    keywords: ["Identity", "Logo", "Guidelines"],
    preview: { type: "image", src: "/work/covas-immo/02.webp", alt: "Covas Immo livery on a scooter" },
  },
  {
    name: "Multimedia",
    description:
      "One idea carried across print, web, video and animation, so a brand feels like the same brand everywhere.",
    keywords: ["Cross-media", "Content", "Production"],
    preview: { type: "image", src: "/work/impermo/02.webp", alt: "Impermo website on desktop and mobile" },
  },
  {
    name: "Digital experiences",
    description:
      "Websites, landing pages and digital campaigns designed around what people came to do, and what the brand needs them to notice.",
    keywords: ["Web", "Campaigns", "Prototyping"],
    preview: { type: "image", src: "/work/belfius-banx/01.webp", alt: "Banx app screens" },
  },
  {
    name: "Motion design",
    description:
      "2D and 3D animation for campaigns, social and product explanation, from first storyboard to final edit.",
    keywords: ["After Effects", "Animation", "Video"],
    preview: { type: "video", src: "/work/covas-immo/livery.mp4", alt: "Covas Immo vehicle livery turnaround" },
  },
  {
    name: "UI / UX",
    description:
      "User flows, wireframes, prototypes and interface design for products people understand without a manual.",
    keywords: ["Figma", "Flows", "Design systems"],
    preview: { type: "image", src: "/work/belfius-banx/02.webp", alt: "Banx banking app home screen" },
  },
  {
    name: "AI content creation",
    description:
      "AI-generated imagery, mockups and scenes built around my own designs, directed by prompt and always labelled.",
    keywords: ["Adobe Firefly", "Prompting", "Mockups"],
    preview: {
      type: "image",
      src: "/work/ai-content/01.webp",
      alt: "AI-generated image of weathered stickers on a rusted pipe",
    },
  },
  {
    name: "Creative technology",
    description:
      "Creative code, prototyping and new tools, explored early and put to work where they make the result better.",
    keywords: ["Creative code", "Prototyping", "Experiments"],
    preview: { type: "image", src: "/work/rave-and-ride/03.webp", alt: "Rave and Ride poster in a frame" },
  },
];

export const ai = {
  headline: ["My design.", "AI builds the scene."],
  body: "I use generative AI the way I use a camera or a 3D renderer: to get an idea in front of people faster. The artwork, the direction and the final call stay with me.",
  points: [
    {
      name: "Own artwork in",
      body: "My designs go in as reference, so the result shows real work in a new setting.",
    },
    {
      name: "Briefed like a shoot",
      body: "A prompt is a brief. I write it the way I would brief a photographer: subject, light, material, mood.",
    },
    {
      name: "Always labelled",
      body: "AI-generated images on this site are marked as such.",
    },
  ],
  image: {
    src: "/work/ai-content/01.webp",
    width: 1024,
    height: 1024,
    alt: "Two weathered stickers, Space Kadet and Rave Ride, on a rusted metal pipe. AI-generated image.",
    credit: "AI-generated with Adobe Firefly from my own sticker designs",
  },
  href: "/work/ai-content",
};

export const process = [
  {
    step: "01",
    name: "Discover",
    body: "Understand the challenge, audience and objectives.",
  },
  {
    step: "02",
    name: "Explore",
    body: "Research, experiment and develop creative directions.",
  },
  {
    step: "03",
    name: "Create",
    body: "Translate ideas into strong visual concepts and experiences.",
  },
  {
    step: "04",
    name: "Refine",
    body: "Perfect the details, improve the experience and deliver.",
  },
] as const;

export const contact = {
  headline: ["Have an idea?", "Let’s make it", "happen."],
  body: "Have a project, a challenge or an interesting idea? I’d love to hear about it. Let’s explore what we can create together.",
};

/** Pages listed in the footer. */
export const pages = [
  { label: "Work", href: "/work" },
  { label: "About", href: "/about" },
  { label: "AI content creation", href: "/work/ai-content" },
  { label: "Contact", href: "/contact" },
] as const;

export const footer = {
  line: "Independent creative thinking. Multidisciplinary design.",
};
