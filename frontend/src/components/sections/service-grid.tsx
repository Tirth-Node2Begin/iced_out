import { RotateCcw, ShieldCheck, Truck } from "lucide-react";

import { Container } from "@/components/ui/container";

const services = [
  {
    icon: Truck,
    title: "Complimentary shipping",
    copy: "On India orders above ₹7,500.",
  },
  {
    icon: RotateCcw,
    title: "Considered returns",
    copy: "Easy returns within 14 days.",
  },
  {
    icon: ShieldCheck,
    title: "Secure checkout",
    copy: "Encrypted payments, always.",
  },
];

export function ServiceGrid() {
  return (
    <section className="service-section" aria-label="Customer services">
      <Container className="service-grid">
        {services.map(({ icon: Icon, title, copy }) => (
          <article key={title}>
            <Icon aria-hidden="true" size={22} strokeWidth={1.4} />
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
            </div>
          </article>
        ))}
      </Container>
    </section>
  );
}
