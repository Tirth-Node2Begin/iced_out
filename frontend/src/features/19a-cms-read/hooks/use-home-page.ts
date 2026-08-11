import { getHomePage } from "@/features/19a-cms-read/api/cms-repository";

export const cmsKeys = {
  page: (slug: string) => ["cms", "page", slug] as const,
};

export function useHomePage() {
  return getHomePage();
}
