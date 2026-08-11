import type { ElementType, ReactNode } from "react";

type ContainerProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
};

export function Container({
  as: Component = "div",
  children,
  className = "",
}: ContainerProps) {
  return <Component className={`site-container ${className}`}>{children}</Component>;
}
