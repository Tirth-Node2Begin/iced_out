import { Fingerprint, LockKeyhole, Radio } from "lucide-react";
import Image from "next/image";

/**
 * The right-hand half of the customer auth split. Purely decorative: it is
 * hidden below 1024px, carries no focusable node, and every rule it needs
 * lives in `nh-auth.css` under `.iox-media`.
 *
 * `trust` adds the session-integrity chips, which register shows because that
 * is the page where a first-time visitor is handing over credentials.
 */
export function AuthSplitVisual({ trust = false }: { trust?: boolean }) {
  return (
    <aside className="iox-auth__media" aria-hidden="true">
      <div className="iox-media">
        <Image
          src="/images/campaign-after-hours@1200.avif"
          alt=""
          fill
          priority
          sizes="(max-width: 1023px) 0px, 55vw"
        />
        <div className="iox-media__scrim" />
        <div className="iox-media__frame" />
        <div className="iox-media__mark">ICED<br />OUT</div>

        <div className="iox-media__caption">
          <p>Drop 001 — After dark</p>
          <h2>UNIFORMS FOR <em>the hours</em> THAT MATTER.</h2>
          <p>Heavyweight, limited by design, and cut for the city after everyone else has gone home.</p>
          {trust && (
            <div className="iox-media__trust">
              <span><LockKeyhole size={13} /> Encrypted session</span>
              <span><Fingerprint size={13} /> Identity scoped</span>
              <span><Radio size={13} /> IND / 12.9716° N</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
