import { Check, KeyRound, LockKeyhole, ShieldCheck, UserCog } from "lucide-react";

const staff = [
  { name: "Aarav D.", role: "ADMIN", scope: "All stores", mfa: "Enforced", active: "Now" },
  { name: "Mira K.", role: "MANAGER", scope: "India / Primary", mfa: "Enabled", active: "12 min" },
  { name: "Dev W.", role: "WAREHOUSE", scope: "BLR-01", mfa: "Enabled", active: "4 min" },
  { name: "Sana R.", role: "SUPPORT", scope: "India queues", mfa: "Enabled", active: "8 min" },
];

export function AccessWorkspace() {
  return <section className="admin-workspace"><div className="admin-heading admin-heading--actions"><div><p>Access / Deny by default</p><h1>People and permission.</h1><span>Roles are permission bundles; store, warehouse, row, and field scopes remain explicit.</span></div><button className="admin-primary" type="button">Invite staff member</button></div><div className="access-principles"><article><ShieldCheck size={20} /><strong>Separate audience</strong><span>Customer credentials never create a staff session.</span></article><article><KeyRound size={20} /><strong>Explicit grants</strong><span>Routes and actions declare exact permissions.</span></article><article><LockKeyhole size={20} /><strong>MFA enforced</strong><span>Production admins require an active second factor.</span></article></div><div className="admin-section-title"><div><h2>Staff directory</h2><p>Role, resource scope, MFA, and activity in one audit-ready view.</p></div></div><div className="staff-directory">{staff.map((person) => <article key={person.name}><span className="staff-avatar">{person.name.split(" ").map((part) => part[0]).join("")}</span><div><h2>{person.name}</h2><p>{person.role} · {person.scope}</p></div><span><ShieldCheck size={14} /> {person.mfa}</span><span><i className="status-dot" /> Active {person.active}</span><button aria-label={`Manage ${person.name}`} type="button"><UserCog size={16} /></button></article>)}</div><div className="admin-action-bar"><p><Check size={13} /> Permission changes clear protected caches and apply on the next session refresh.</p><button className="admin-secondary-action" type="button">Open immutable audit log</button></div></section>;
}
