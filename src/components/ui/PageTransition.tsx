"use client";

import React, { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      if (containerRef.current) {
        gsap.fromTo(
          containerRef.current,
          { x: 30, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.35,
            ease: "power2.out",
            // Clear inline transform/opacity once done so the wrapper doesn't
            // create a containing block for fixed-position children (drawers, FABs).
            clearProps: "transform,opacity",
          }
        );
      }
    },
    [pathname]
  );

  return <div ref={containerRef}>{children}</div>;
}
