"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

function getRouteLabel(pathname: string) {
  if (pathname === "/") return "Current transmission";
  return pathname
    .split("/")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.replaceAll("-", " "))
    .join(" / ");
}

export function RouteExperience({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrame = 0;
    const updateProgress = () => {
      animationFrame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
    };
    const requestUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateProgress);
    };
    updateProgress();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [pathname]);

  return (
    <>
      <div
        aria-hidden="true"
        className="route-progress"
        ref={progressRef}
      />
      <div aria-hidden="true" className="route-beacon">
        <i />
        <span>{getRouteLabel(pathname)}</span>
        <b>ICE / 026</b>
      </div>
      <div>{children}</div>
    </>
  );
}
