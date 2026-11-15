import type { Metadata } from "next";
import { Contact } from "@/components/sections/Contact";
import { WorkIndex } from "@/components/sections/WorkIndex";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Selected work by Pieter Lambregs across multimedia design, brand identity, digital design, creative campaigns, motion and UI/UX.",
  alternates: { canonical: "/work" },
};

export default function WorkPage() {
  return (
    <>
      <section className="gutter pb-[clamp(5rem,10vw,10rem)] pt-[clamp(6rem,14vh,10rem)]">
        <h1 className="display text-[clamp(3.25rem,15vw,20rem)]">
          <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
            <span className="intro-rise">All work.</span>
          </span>
        </h1>
        <WorkIndex />
      </section>
      <Contact />
    </>
  );
}
