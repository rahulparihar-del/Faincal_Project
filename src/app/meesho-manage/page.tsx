"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MeeshoManageRoot() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/meesho-manage/dashboard");
  }, [router]);

  return null;
}
