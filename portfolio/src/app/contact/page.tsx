import type { Metadata } from "next";
import { Contact } from "@/components/sections/Contact";
import { FactList } from "@/components/ui/FactList";
import { LocalTime } from "@/components/ui/LocalTime";
import { about, site } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Pieter Lambregs about a project, a challenge or an idea.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const based = about.facts.find((f) => f.label === "Based in")?.value ?? site.location;
  return (
    <>
      <div className="pt-[clamp(2rem,6vh,4rem)]">
        <Contact as="h1" />
      </div>
      <section className="gutter pb-[clamp(4rem,8vw,7rem)]">
        <FactList
          className="grid grid-cols-1 gap-x-8 border-t border-line sm:grid-cols-3"
          facts={[
            { label: "Based in", value: based },
            { label: "Local time", value: <LocalTime /> },
            { label: "Availability", value: site.status },
          ]}
        />
      </section>
    </>
  );
}
