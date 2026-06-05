"use client";

import React, { useRef, useEffect, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  isCurrency = false,
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  isCurrency?: boolean;
  decimals?: number;
}) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatNumber = (val: number) => {
    if (!isFinite(val)) return "0";
    return val.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  useGSAP(
    () => {
      if (!nodeRef.current || !mounted) return;

      const obj = { val: prevValueRef.current };
      gsap.to(obj, {
        val: value,
        duration: 1.2,
        ease: "power2.out",
        onUpdate: () => {
          if (nodeRef.current) {
            nodeRef.current.textContent = `${prefix}${formatNumber(obj.val)}${suffix}`;
          }
        },
        onComplete: () => {
          prevValueRef.current = value;
          if (nodeRef.current) {
            nodeRef.current.textContent = `${prefix}${formatNumber(value)}${suffix}`;
          }
        },
      });
    },
    [value, mounted]
  );

  return (
    <span ref={nodeRef} aria-live="polite" aria-atomic="true">
      {prefix}
      {mounted ? formatNumber(value) : "0"}
      {suffix}
    </span>
  );
}
