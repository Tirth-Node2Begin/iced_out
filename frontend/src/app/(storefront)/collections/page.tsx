import "@/styles/components/pages.css";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/ui/container";

const collections = [
  { name: "Drop 001", slug: "drop-001", copy: "Heavyweight uniforms for the city after dark.", edition: "320 units", state: "Live now" },
  { name: "After Hours", slug: "after-hours", copy: "Relaxed utility in charcoal, ink, and washed black.", edition: "Chapter 02", state: "Open archive" },
  { name: "Core Uniform", slug: "core-uniform", copy: "Permanent forms, rebuilt with uncompromising weight.", edition: "Permanent line", state: "Always considered" },
];

export default function CollectionsPage() {
  return (
    <>
      <section className="listing-hero">
        <Container>
          <p className="eyebrow">Archive / Current signal</p>
          <h1>Collections.</h1>
          <p>Each release is a finite chapter, designed to work as one uniform.</p>
        </Container>
      </section>
      <section className="collection-index">
        <Container>
          <Link className="collection-feature" href="/collections/drop-001"><div className="collection-feature__media"><Image src="/images/iced-out-hero.avif" alt="Drop 001 campaign with two models in black Iced_out layers" fill loading="lazy" sizes="(max-width: 900px) 100vw, 60vw" /></div><div><span>01 / Current chapter</span><p className="eyebrow">320 numbered units</p><h2>Drop 001</h2><p>Four foundational pieces built as a single after-dark uniform.</p><strong>Enter the drop <ArrowRight size={18} /></strong></div></Link>
          <div className="collection-index__grid collection-index__grid--secondary">
          {collections.map((collection, index) => (
            index > 0 && <Link href={`/collections/${collection.slug}`} key={collection.slug}>
              <span>0{index + 1} / {collection.edition}</span>
              <h2>{collection.name}</h2>
              <p>{collection.copy}</p>
              <small>{collection.state}</small>
              <ArrowRight aria-hidden="true" size={20} />
            </Link>
          ))}
          </div>
        </Container>
      </section>
    </>
  );
}
import Image from "next/image";
