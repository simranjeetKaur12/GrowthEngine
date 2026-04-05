"use client";

import Image from "next/image";
import Link from "next/link";

import { useTheme } from "./theme-provider";

type BrandLogoProps = {
  size?: number;
  showWordmark?: boolean;
  href?: string;
  priority?: boolean;
  className?: string;
};

export function BrandLogo({
  size = 56,
  showWordmark = true,
  href,
  priority = false,
  className = ""
}: BrandLogoProps) {
  const { mounted, theme } = useTheme();
  const logoSrc = mounted && theme === "light" ? "/lightTheme.png" : "/darkTheme.png";

  const content = (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div
        className="overflow-hidden rounded-[16px] border border-white/10 bg-white/5 shadow-[0_12px_32px_rgba(15,23,42,0.35)]"
        style={{ width: size, height: size }}
      >
        <Image
          src={logoSrc}
          alt="GrowthEngine logo"
          width={size}
          height={size}
          priority={priority}
          className="h-full w-full object-contain"
        />
      </div>

      {showWordmark ? (
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-brand-300">GrowthEngine</p>
          <p className="text-sm text-secondary">Developer Simulation Platform</p>
        </div>
      ) : null}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex items-center">
      {content}
    </Link>
  );
}
