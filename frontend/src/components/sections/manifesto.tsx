import { Container } from "@/components/ui/container";

const principles = [
  {
    number: "01",
    title: "Small by design",
    copy: "Limited production means tighter quality control and fewer pieces left without a purpose.",
  },
  {
    number: "02",
    title: "Weight before noise",
    copy: "Dense natural fabrics, considered hardware, and silhouettes designed to hold their shape.",
  },
  {
    number: "03",
    title: "Built for repeat",
    copy: "Every release is designed to work with the last one—and survive the next hundred wears.",
  },
];

export function Manifesto() {
  return (
    <section className="manifesto section" id="manifesto" aria-labelledby="manifesto-heading">
      <Container>
        <div className="manifesto__intro">
          <p className="eyebrow">Iced_out / Our code</p>
          <h2 id="manifesto-heading">
            Made slower.
            <br />
            <em>Worn harder.</em>
          </h2>
          <p>
            We make streetwear for the long run: fewer releases, heavier materials,
            and details that reveal themselves over time.
          </p>
        </div>

        <div className="principle-list">
          {principles.map((principle) => (
            <article key={principle.number}>
              <span>{principle.number}</span>
              <h3>{principle.title}</h3>
              <p>{principle.copy}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
