"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectToOldPanel() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?role=faculty");
  }, [router]);
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f5f8fc", fontFamily: "system-ui", color: "#5b6b85" }}>
      Panele yönlendiriliyor…
    </div>
  );
}
