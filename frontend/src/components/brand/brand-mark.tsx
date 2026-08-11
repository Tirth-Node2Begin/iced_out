/**
 * The house mark — four chips reading as a cut stone.
 *
 * Lives here rather than beside the one component that first drew it, because
 * it is the logo: the nav prints it, the account rail prints it, and two hand
 * copies of the same path are two things to keep in step. Strokes are
 * `currentColor`, so it takes the colour of whatever prints it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 2 3 9l9 13 9-13-9-7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
      <path d="M3 9h18M12 2v20" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.1" />
    </svg>
  );
}
