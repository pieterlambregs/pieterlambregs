import { MediaView } from "@/components/ui/MediaView";
import { RevealBlock } from "@/components/ui/Reveal";
import type { GalleryBlock } from "@/content/projects";

function Caption({ children }: { children?: string }) {
  if (!children) return null;
  return <figcaption className="label mt-3 text-muted">{children}</figcaption>;
}

/**
 * Lays out a run of gallery blocks. Each block picks its own composition
 * (full width, inset, pair, trio), so a case study can vary its rhythm
 * from the data file alone.
 */
export function Gallery({ blocks }: { blocks: GalleryBlock[] }) {
  return (
    <div className="space-y-[clamp(1.5rem,4vw,4rem)]">
      {blocks.map((block, i) => {
        switch (block.layout) {
          case "full":
            return (
              <RevealBlock key={i}>
                <figure>
                  <MediaView media={block.media} sizes="100vw" parallax={false} />
                  <Caption>{block.caption}</Caption>
                </figure>
              </RevealBlock>
            );
          case "inset":
            return (
              <RevealBlock key={i} className="grid-12">
                <figure className="col-span-12 md:col-span-8 md:col-start-3">
                  <MediaView media={block.media} sizes="(min-width: 768px) 66vw, 100vw" parallax={false} />
                  <Caption>{block.caption}</Caption>
                </figure>
              </RevealBlock>
            );
          case "pair":
            return (
              <RevealBlock key={i}>
                <figure>
                  <div className="grid-12 items-start gap-y-6">
                    <div className="col-span-12 md:col-span-6">
                      <MediaView media={block.media[0]} sizes="(min-width: 768px) 50vw, 100vw" parallax={false} />
                    </div>
                    <div className="col-span-12 md:col-span-5 md:col-start-8 md:mt-[18%]">
                      <MediaView media={block.media[1]} sizes="(min-width: 768px) 42vw, 100vw" parallax={false} />
                    </div>
                  </div>
                  <Caption>{block.caption}</Caption>
                </figure>
              </RevealBlock>
            );
          case "trio":
            return (
              <RevealBlock key={i}>
                <figure>
                  <div className="grid grid-cols-1 gap-[clamp(0.75rem,1.6vw,1.5rem)] md:grid-cols-3">
                    {block.media.map((m, j) => (
                      <MediaView key={j} media={m} sizes="(min-width: 768px) 33vw, 100vw" ratio="4 / 5" />
                    ))}
                  </div>
                  <Caption>{block.caption}</Caption>
                </figure>
              </RevealBlock>
            );
        }
      })}
    </div>
  );
}
