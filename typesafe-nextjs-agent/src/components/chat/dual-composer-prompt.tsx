"use client";

import type { ChatStatus } from "ai";
import type { ReactNode } from "react";

import {
  type PromptInputMessage,
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const inputGroupClass =
  "[&_[data-slot=input-group]]:rounded-xl [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-muted/40 [&_[data-slot=input-group]]:shadow-none";

export type DualComposerPromptProps = {
  className?: string;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (message: PromptInputMessage) => void | Promise<void>;
  status: ChatStatus;
  onStop: () => void;
  disableInput: boolean;
  disableSubmit: boolean;
  placeholder: string;
  hint: ReactNode;
  submitAriaLabelReady?: string;
  submitAriaLabelBusy?: string;
};

export function DualComposerPrompt({
  className,
  input,
  onInputChange,
  onSubmit,
  status,
  onStop,
  disableInput,
  disableSubmit,
  placeholder,
  hint,
  submitAriaLabelReady = "Send to both",
  submitAriaLabelBusy = "Stop",
}: DualComposerPromptProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <PromptInput className={cn(inputGroupClass, className)} onSubmit={onSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            disabled={disableInput}
            className="min-h-[52px] max-h-40 text-[15px] leading-relaxed placeholder:text-muted-foreground/70"
          />
        </PromptInputBody>
        <PromptInputFooter className="border-t border-border/50 bg-muted/25 px-2 py-2 sm:px-3">
          <PromptInputTools className="flex-1 min-w-0">{hint}</PromptInputTools>
          <PromptInputSubmit
            status={status}
            onStop={onStop}
            disabled={disableSubmit}
            aria-label={status === "ready" ? submitAriaLabelReady : submitAriaLabelBusy}
          />
        </PromptInputFooter>
      </PromptInput>
    </TooltipProvider>
  );
}
