import { AppError } from "@/api/error-normalizer";
import { adminClient } from "@/api/clients";

/**
 * Step-up authentication — proving the password again for the few console
 * actions that move money or change who can act.
 *
 * ── WHY A SCREEN NEEDS THIS ─────────────────────────────────────────────────
 *
 * A console session is a fifteen-minute idle window in which every permission
 * the account holds is available. That is right for dispatching orders and wrong
 * for approving refunds, marking payouts paid, and rewriting store settings: an
 * unattended laptop for two minutes is enough for all three, and the audit trail
 * would faithfully record that the account did it.
 *
 * The API refuses those with **428 Precondition Required** until the password
 * has been re-entered within the last ten minutes.
 *
 * ── 428 IS NOT 401, AND THAT MATTERS HERE ───────────────────────────────────
 *
 * A 401 sends the shell's interceptor to the sign-out path. Using it for this
 * would throw away a perfectly good session because one action wanted a fresh
 * password. 428 says "this session is fine, ask for the password" — so screens
 * must handle it themselves rather than letting it fall through to the generic
 * error toast, which would tell an operator "something went wrong" about a
 * refund that is simply waiting for a confirmation they were never shown.
 *
 * The intended shape at a call site:
 *
 *     try {
 *       await approveRefund(id);
 *     } catch (error) {
 *       if (needsStepUp(error)) {
 *         const password = await promptForPassword();
 *         await confirmPassword(password);
 *         await approveRefund(id);            // now allowed
 *         return;
 *       }
 *       throw error;
 *     }
 */

/** How long an elevation lasts, per the API. Mirrored for the UI's own timer. */
export const STEP_UP_WINDOW_SECONDS = 600;

/**
 * Whether this failure means "ask for the password", rather than anything else.
 *
 * Keyed on the CODE and not the status, because the status is the transport's
 * word and the code is the API's. Both are checked so a proxy that rewrites one
 * cannot make this silently stop matching.
 */
export function needsStepUp(error: unknown): boolean {
  return error instanceof AppError && (error.code === "ICE-AUTH-428" || error.status === 428);
}

/**
 * Proves the password and elevates the current session.
 *
 * Throws an `AppError` with a `password` field error when it is wrong — the
 * caller should show that against the input rather than as a toast, because the
 * operator is looking at the field they just typed into.
 *
 * The password is never stored, never put in a URL, and never held after this
 * resolves; the elevation lives on the session row on the server, which is what
 * makes signing out end it.
 */
export async function confirmPassword(password: string): Promise<void> {
  await adminClient.post("/admin/auth/step-up", { password });
}
