import type { Metadata } from "next";
import { About } from "@/components/sections/About";
import { AiCreation } from "@/components/sections/AiCreation";
import { Contact } from "@/components/sections/Contact";
import { Expertise } from "@/components/sections/Expertise";
import { Process } from "@/components/sections/Process";

export const metadata: Metadata = {
  title: "About",
  description:
    "Pieter Lambregs is a multidisciplinary visual designer from Belgium with more than 15 years of experience across branding, multimedia, digital design and visual storytelling.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <About as="h1" />
      <Expertise />
      <AiCreation />
      <Process />
      <Contact />
    </>
  );
}
