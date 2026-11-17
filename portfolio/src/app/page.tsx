import { Hero } from "@/components/hero/Hero";
import { About } from "@/components/sections/About";
import { AiCreation } from "@/components/sections/AiCreation";
import { Contact } from "@/components/sections/Contact";
import { Expertise } from "@/components/sections/Expertise";
import { Philosophy } from "@/components/sections/Philosophy";
import { Process } from "@/components/sections/Process";
import { Work } from "@/components/sections/Work";

export default function Home() {
  return (
    <>
      <Hero />
      <Philosophy />
      <Work />
      <Expertise />
      <AiCreation />
      <About />
      <Process />
      <Contact />
    </>
  );
}
