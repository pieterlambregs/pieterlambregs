import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Footer } from "@/components/Footer";
import { Loader } from "@/components/Loader";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/providers/Providers";
import { Cursor } from "@/components/ui/Cursor";
import { site, socials } from "@/content/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.role}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  keywords: [
    "Pieter Lambregs",
    "multidisciplinary designer",
    "multimedia designer",
    "brand identity",
    "motion design",
    "UI/UX design",
    "art direction",
    "Belgium",
  ],
  openGraph: {
    type: "website",
    locale: "en_BE",
    siteName: site.name,
    title: `${site.name} — ${site.role}`,
    description: site.description,
    url: site.url,
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  colorScheme: "dark light",
};

// Runs before first paint: restores the chosen theme and skips the loader on
// return visits, so neither flashes.
const boot = `try{var d=document.documentElement;if(sessionStorage.getItem("pl-seen"))d.setAttribute("data-seen","");sessionStorage.setItem("pl-seen","1");if(localStorage.getItem("pl-theme")==="light")d.setAttribute("data-theme","light")}catch(e){}`;

const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  jobTitle: site.role,
  description: site.description,
  url: site.url,
  email: `mailto:${site.email}`,
  address: { "@type": "PostalAddress", addressCountry: "BE" },
  worksFor: { "@type": "Organization", name: site.currentEmployer },
  sameAs: socials.map((s) => s.href),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }} />
      </head>
      <body>
        <a
          href="#main"
          className="label fixed left-4 top-4 z-[110] -translate-y-20 bg-fg px-4 py-3 text-bg focus:translate-y-0"
        >
          Skip to content
        </a>
        <Loader />
        <Providers>
          <Nav />
          <main id="main">{children}</main>
          <Footer />
          <Cursor />
        </Providers>
      </body>
    </html>
  );
}
