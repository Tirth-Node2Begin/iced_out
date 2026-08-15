import type { Metadata } from "next";

import { FeedbackWorkspace } from "@/features/11-reviews/components/feedback-workspace";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackPage() { return <FeedbackWorkspace />; }
