"use client";

import { PackageX } from "lucide-react";
import Link from "next/link";

import { AccountSection } from "@/components/account/account-section";
import { useCustomerReturns } from "@/features/18-returns/customer-returns";
import { ReturnDetail } from "@/features/18-returns/components/return-detail";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * One of the shopper's returns, found by id.
 *
 * The lookup lives here rather than in the route because the record comes from
 * the API and the whole app is client-rendered — the route file cannot resolve it.
 * It used to be resolved on the server against a fixture array, which is why the
 * old route fell back to the FIRST fixture when the id missed: it showed one
 * shopper another shopper's return. Nothing is shown here for an id that is not
 * theirs.
 */
export function CustomerReturnDetail({ returnId }: { returnId: string }) {
  const { isAuthenticated } = useAuth();
  const { returns, ready, error } = useCustomerReturns(isAuthenticated);

  const item = returns.find((entry) => entry.id === returnId);

  if (item) return <ReturnDetail item={item} />;

  return (
    <AccountSection
      copy={
        error
          ? error
          : ready
            ? "Nothing on your account is filed under that reference."
            : "Looking for your return…"
      }
      eyebrow="Return / Reverse logistics"
      title={ready ? "Return not found" : "One moment"}
    >
      {ready && (
        <div className="account-notice account-notice--large">
          <PackageX size={22} />
          <p>
            <strong>{returnId || "No reference given"}</strong>
            <small>
              The link may be old, or the return may belong to another account.{" "}
              <Link className="io-link" href="/account/orders">
                Open your orders
              </Link>{" "}
              to start a new one.
            </small>
          </p>
        </div>
      )}
    </AccountSection>
  );
}
