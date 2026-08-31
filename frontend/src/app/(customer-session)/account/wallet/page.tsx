import type { Metadata } from "next";

import { AccountWallet } from "@/features/21-wallet/components/account-wallet";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() { return <AccountWallet />; }
