import type { ReactNode } from "react";

interface WorkspaceHeadingProps {
  label: string;
  title: string;
  subtitle: string;
  icon?: ReactNode;
}

export default function WorkspaceHeading({
  label,
  title,
  subtitle,
  icon,
}: WorkspaceHeadingProps) {
  return (
    <div className="mb-8 max-w-2xl animate-rise lg:mb-10">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        {icon}
        {label}
      </p>
      <h1 className="mt-2 text-[2rem] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[2.6rem]">
        {title}
      </h1>
      <p className="mt-3 max-w-xl text-[0.95rem] leading-7 text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}
