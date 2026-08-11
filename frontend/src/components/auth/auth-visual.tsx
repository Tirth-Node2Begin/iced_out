import { Fingerprint, LockKeyhole, Radio } from "lucide-react";
import Image from "next/image";

export function AuthVisual({ staff = false }: { staff?: boolean }) {
  return (
    <aside className="auth-visual" aria-label={staff ? "Operations access context" : "Iced_out customer access"}>
      <Image src="/images/campaign-after-hours@1200.avif" alt="Iced_out campaign in a concrete passage after dark" fill priority sizes="(max-width: 900px) 0px, 52vw" />
      <div className="media-grain" aria-hidden="true" />
      <header><span><Radio size={13} /> {staff ? "Private operations network" : "Customer signal / 001"}</span><b>IND / 12.9716° N</b></header>
      <div className="auth-visual__content">
        <p className="eyebrow">{staff ? "Permission-shaped access" : "One account. Every edition."}</p>
        <h2>{staff ? <>Move the work.<br />Protect the context.</> : <>Keep your place<br />after dark.</>}</h2>
        <div><span><LockKeyhole size={15} /> Encrypted session</span><span><Fingerprint size={15} /> Identity scoped</span></div>
      </div>
    </aside>
  );
}
