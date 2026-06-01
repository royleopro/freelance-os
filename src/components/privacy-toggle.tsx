"use client";

import { Eye, EyeOff } from "lucide-react";
import { usePrivacyMode } from "@/lib/privacy-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function PrivacyToggle() {
  const { isHidden, toggle } = usePrivacyMode();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={toggle}
            className="flex items-center justify-center rounded-md p-1.5 text-brand-muted transition hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
            aria-label={isHidden ? "Afficher les montants" : "Masquer les montants"}
          >
            {isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      />
      <TooltipContent side="left">
        {isHidden ? "Afficher les montants" : "Masquer les montants"}
      </TooltipContent>
    </Tooltip>
  );
}
