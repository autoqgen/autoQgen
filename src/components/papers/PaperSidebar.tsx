"use client";

import { useState } from "react";
import { Palette, Settings } from "lucide-react";

import { Card, EmptyState } from "@/components/ui";
import GenerateTab, { type GenerationView } from "@/components/papers/GenerateTab";
import DesignTab, { type DesignController, type DesignView } from "@/components/papers/DesignTab";

/**
 * Paper View sidebar with a segmented General / Design toggle.
 *
 *  - General: question filtering / selection / regeneration (creates a new paper).
 *  - Design:  paper appearance / formatting / output (live preview + save on the
 *             current paper).
 *
 * Both panels stay mounted; switching tabs only toggles visibility, so form
 * state is preserved on both sides and no API calls fire on a tab switch.
 */

type Tab = "general" | "design";

export interface PaperSidebarProps {
  generation: GenerationView | null;
  design: DesignView;
  designController: DesignController;
}

export default function PaperSidebar({ generation, design, designController }: PaperSidebarProps) {
  const [tab, setTab] = useState<Tab>(generation ? "general" : "design");

  return (
    <Card>
      {/* Segmented toggle with a sliding active indicator */}
      <div className="relative grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-card shadow-sm transition-transform duration-300 ease-out"
          style={{ transform: tab === "design" ? "translateX(100%)" : "translateX(0)" }}
        />
        <button
          type="button"
          onClick={() => setTab("general")}
          className={`relative z-10 flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${
            tab === "general" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Settings className="h-4 w-4" /> General
        </button>
        <button
          type="button"
          onClick={() => setTab("design")}
          className={`relative z-10 flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${
            tab === "design" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Palette className="h-4 w-4" /> Design
        </button>
      </div>

      <div className="mt-5">
        <div hidden={tab !== "general"}>
          {generation ? (
            <GenerateTab view={generation} />
          ) : (
            <EmptyState
              title="No generation settings"
              body="This paper was built manually, so there is nothing to regenerate. Switch to Design to change its appearance."
            />
          )}
        </div>
        <div hidden={tab !== "design"}>
          <DesignTab view={design} controller={designController} />
        </div>
      </div>
    </Card>
  );
}
