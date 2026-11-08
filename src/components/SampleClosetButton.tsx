"use client";
import { useState } from "react";
import { useProfile } from "@/hooks/data";
import { loadSampleCloset } from "@/lib/db";
import { Button, Spinner } from "./ui";

/** One tap to try the app with a closet of real product photos. */
export function SampleClosetButton({ className = "", label = "Try a sample closet" }: { className?: string; label?: string }) {
  const profile = useProfile();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  return (
    <Button
      variant="secondary"
      className={className}
      disabled={state === "loading" || !profile}
      onClick={async () => {
        setState("loading");
        try {
          await loadSampleCloset(profile?.wardrobe ?? "both");
          setState("idle");
        } catch (e) {
          console.error(e);
          setState("error");
        }
      }}
    >
      {state === "loading" ? <Spinner /> : state === "error" ? "Couldn't load samples — retry" : label}
    </Button>
  );
}
