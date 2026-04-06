"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { DefaultChatTransport, ToolUIPart } from "ai";
import { useChat } from "@ai-sdk/react";
import type { ChatStatus, UIMessage } from "ai";

import { type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { DualComposerPrompt, type DualComposerPromptProps } from "@/components/chat/dual-composer-prompt";
import { ModelSelectorLogo, ModelSelectorName } from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckIcon } from "lucide-react";

import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";

import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";

import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";

import { GuardrailChainOfThought } from "@/components/guardrail-chain-of-thought";
import { ToolSearchSummary } from "@/components/tool-search-summary";
import { combineOnDataHandlers, createGuardrailOnDataHandler, createToolSearchOnDataHandler, logChatTransportError } from "@/lib/ai-sdk-chat";
import type { GuardrailUiPayload } from "@/types/guardrail-ui";
import type { ToolSearchUiPayload } from "@/types/tool-search-ui";

/** Mastra `provider/model` ids — see ai-elements skill: `references/model-selector.md`, `scripts/model-selector.tsx` */
const MODELS = [
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    chef: "OpenAI",
    chefSlug: "openai" as const,
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    chef: "OpenAI",
    chefSlug: "openai" as const,
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    chef: "OpenAI",
    chefSlug: "openai" as const,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    chef: "OpenAI",
    chefSlug: "openai" as const,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    chef: "OpenAI",
    chefSlug: "openai" as const,
  },
  {
    id: "anthropic/claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet",
    chef: "Anthropic",
    chefSlug: "anthropic" as const,
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    chef: "Anthropic",
    chefSlug: "anthropic" as const,
  },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    chef: "Google",
    chefSlug: "google" as const,
  },
] as const;

const MODEL_CHEFS = [...new Set(MODELS.map((m) => m.chef))];

function cmdkSearchKeywords(m: (typeof MODELS)[number]): string[] {
  return [m.name, m.chef, ...m.id.split("/")];
}

/** Mirrors `scripts/model-selector.tsx` — memoized row + `keywords` so cmdk can match Mastra `provider/model` ids (not only `value`). */
const SuperChatModelItem = memo(function SuperChatModelItem({ model, selectedModel, onSelect }: { model: (typeof MODELS)[number]; selectedModel: string; onSelect: (id: string) => void }) {
  const handleSelect = useCallback(() => onSelect(model.id), [onSelect, model.id]);
  return (
    <CommandItem keywords={cmdkSearchKeywords(model)} value={model.id} onSelect={handleSelect} className="rounded-xl py-2.5">
      <ModelSelectorLogo className="size-4" provider={model.chefSlug} />
      <ModelSelectorName>{model.name}</ModelSelectorName>
      {selectedModel === model.id ? <CheckIcon className="ml-auto size-4 shrink-0 text-primary" /> : <div className="ml-auto size-4 shrink-0" aria-hidden />}
    </CommandItem>
  );
});

function SuperChatModelSelector({ selectedModel, onSelect, disabled }: { selectedModel: string; onSelect: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = MODELS.find((m) => m.id === selectedModel);

  const handleModelSelect = useCallback(
    (id: string) => {
      onSelect(id);
      setOpen(false);
    },
    [onSelect],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button className="h-9 min-w-[200px] justify-between gap-2 px-3 font-normal" variant="outline" disabled={disabled} type="button">
          {selected?.chefSlug ? <ModelSelectorLogo className="size-4 shrink-0" provider={selected.chefSlug} /> : null}
          {selected?.name ? <ModelSelectorName className="text-sm">{selected.name}</ModelSelectorName> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[min(100vw-2rem,22rem)] p-0 shadow-xl ring-1 ring-border/60">
        <Command className="rounded-xl border-0 bg-popover shadow-none [&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:border-border/60">
          <CommandInput placeholder="Search models…" />
          <CommandList className="max-h-[min(50vh,280px)] scroll-py-2">
            <CommandEmpty className="py-8 text-muted-foreground">No models found.</CommandEmpty>
            {MODEL_CHEFS.map((chef) => (
              <CommandGroup className="px-1 pb-2 pt-1 first:pt-2" heading={chef} key={chef}>
                {MODELS.filter((m) => m.chef === chef).map((m) => (
                  <SuperChatModelItem key={m.id} model={m} onSelect={handleModelSelect} selectedModel={selectedModel} />
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type ChatPanelProps = {
  api: string;
  label: string;
  badge: string;
  badgeColor: string;
  guardrailTitle: string;
  guardrailEvents: GuardrailUiPayload[];
  toolSearchResult: ToolSearchUiPayload | null;
  chat: {
    messages: UIMessage[];
    setMessages: (messages: UIMessage[]) => void;
    status: string;
    error?: Error | undefined;
  };
};

function ChatPanel({ api, label, badge, badgeColor, guardrailTitle, guardrailEvents, toolSearchResult, chat }: ChatPanelProps) {
  const { messages, setMessages, status, error: streamError } = chat;
  const pipelineActive = (status === "submitted" || status === "streaming") && guardrailEvents.length === 0;

  useEffect(() => {
    fetch(api)
      .then((r) => r.json())
      .then((data) => setMessages([...data]))
      .catch(() => {});
  }, [api, setMessages]);

  // Find last user message index to attach processor results after it
  const lastUserIdx = messages.findLastIndex((m) => m.role === "user");

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        <span className="font-medium text-sm text-foreground">{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
        {status === "streaming" && <span className="ml-auto text-xs text-muted-foreground animate-pulse">responding…</span>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Conversation className="h-full min-h-0 flex-1">
          <ConversationContent>
            {messages.map((message: UIMessage, msgIdx: number) => (
              <div key={message.id} className="flex flex-col gap-2">
                {message.parts?.map((part: UIMessage["parts"][number], i: number) => {
                  if (part.type === "text") {
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <MessageResponse>{part.text}</MessageResponse>
                        </MessageContent>
                      </Message>
                    );
                  }

                  if (part.type?.startsWith("tool-")) {
                    return (
                      <Tool key={`${message.id}-${i}`}>
                        <ToolHeader type={(part as ToolUIPart).type} state={(part as ToolUIPart).state || "output-available"} className="cursor-pointer" />
                        <ToolContent>
                          <ToolInput input={(part as ToolUIPart).input || {}} />
                          <ToolOutput output={(part as ToolUIPart).output} errorText={(part as ToolUIPart).errorText} />
                        </ToolContent>
                      </Tool>
                    );
                  }

                  return null;
                })}

                {/* Show latest processor results after the last user message */}
                {msgIdx === lastUserIdx && (guardrailEvents.length > 0 || toolSearchResult || pipelineActive) && (
                  <div className="flex flex-col gap-2">
                    <GuardrailChainOfThought title={guardrailTitle} events={guardrailEvents} pipelineActive={pipelineActive} streamError={streamError} />
                    <ToolSearchSummary result={toolSearchResult} />
                  </div>
                )}
              </div>
            ))}
            <ConversationScrollButton />
          </ConversationContent>
        </Conversation>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);
  const [mastraGuardrailEvents, setMastraGuardrailEvents] = useState<GuardrailUiPayload[]>([]);
  const [typesafeGuardrailEvents, setTypesafeGuardrailEvents] = useState<GuardrailUiPayload[]>([]);
  const [mastraToolSearch, setMastraToolSearch] = useState<ToolSearchUiPayload | null>(null);
  const [typesafeToolSearch, setTypesafeToolSearch] = useState<ToolSearchUiPayload | null>(null);

  const mastraTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat/gpt",
        body: { model: selectedModel },
      }),
    [selectedModel],
  );
  const typesafeTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat/typesafe",
        body: { model: selectedModel },
      }),
    [selectedModel],
  );

  const mastraChat = useChat({
    transport: mastraTransport,
    onData: combineOnDataHandlers(createGuardrailOnDataHandler("mastra", setMastraGuardrailEvents), createToolSearchOnDataHandler("mastra", setMastraToolSearch)),
    onError: logChatTransportError("gpt"),
  });

  const typesafeChat = useChat({
    transport: typesafeTransport,
    onData: combineOnDataHandlers(createGuardrailOnDataHandler("typesafe", setTypesafeGuardrailEvents), createToolSearchOnDataHandler("typesafe", setTypesafeToolSearch)),
    onError: logChatTransportError("typesafe"),
  });

  const isBusy = mastraChat.status !== "ready" || typesafeChat.status !== "ready";

  const combinedStatus: ChatStatus = useMemo(() => {
    const a = mastraChat.status;
    const b = typesafeChat.status;
    if (a === "streaming" || b === "streaming") return "streaming";
    if (a === "submitted" || b === "submitted") return "submitted";
    return "ready";
  }, [mastraChat.status, typesafeChat.status]);

  const handleComposerSubmit = async ({ text }: PromptInputMessage) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    setMastraGuardrailEvents([]);
    setTypesafeGuardrailEvents([]);
    setMastraToolSearch(null);
    setTypesafeToolSearch(null);
    await Promise.all([mastraChat.sendMessage({ text: trimmed }), typesafeChat.sendMessage({ text: trimmed })]);
  };

  const handleStop = () => {
    mastraChat.stop();
    typesafeChat.stop();
  };

  const handleClearChat = async () => {
    mastraChat.stop();
    typesafeChat.stop();
    await Promise.all([fetch("/api/chat/gpt", { method: "DELETE" }), fetch("/api/chat/typesafe", { method: "DELETE" })]);
    mastraChat.setMessages([]);
    typesafeChat.setMessages([]);
    setMastraGuardrailEvents([]);
    setTypesafeGuardrailEvents([]);
    setMastraToolSearch(null);
    setTypesafeToolSearch(null);
  };

  const superChatComposer: DualComposerPromptProps = {
    input,
    onInputChange: setInput,
    onSubmit: handleComposerSubmit,
    status: combinedStatus,
    onStop: handleStop,
    disableInput: isBusy,
    disableSubmit: combinedStatus === "ready" && !input.trim(),
    placeholder: "Message both agents…",
    hint: (
      <span className="text-[11px] text-muted-foreground sm:text-xs">
        <kbd className="pointer-events-none rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">Enter</kbd> send ·{" "}
        <kbd className="pointer-events-none rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">Shift</kbd>+
        <kbd className="pointer-events-none rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">Enter</kbd> new line
      </span>
    ),
    submitAriaLabelReady: "Send to both agents",
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Header — shrink-0, never scrolls */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <h1 className="text-lg font-semibold text-foreground">Super routes comparison — guardrails + tool search</h1>
        <div className="flex items-center gap-2">
          <SuperChatModelSelector selectedModel={selectedModel} onSelect={setSelectedModel} disabled={isBusy} />
          <Button type="button" variant="outline" size="sm" onClick={() => void handleClearChat()}>
            Clear chat
          </Button>
        </div>
      </div>

      {/* Panels — flex-1 min-h-0 so children scroll independently */}
      <div className="grid grid-cols-[1fr_1px_1fr] flex-1 min-h-0">
        <ChatPanel
          api="/api/chat/gpt"
          label="GPT Super Route"
          badge="MastraGuardrail + GptToolSearch"
          badgeColor="bg-blue-100 text-blue-700"
          guardrailTitle="GPT guardrail timeline"
          guardrailEvents={mastraGuardrailEvents}
          toolSearchResult={mastraToolSearch}
          chat={mastraChat}
        />
        <div className="bg-border/60" aria-hidden />
        <ChatPanel
          api="/api/chat/typesafe"
          label="TypeSafe Super Route"
          badge="TypeSafeGuardrail + TypeSafeToolSearch"
          badgeColor="bg-violet-100 text-violet-700"
          guardrailTitle="TypeSafe guardrail timeline"
          guardrailEvents={typesafeGuardrailEvents}
          toolSearchResult={typesafeToolSearch}
          chat={typesafeChat}
        />
      </div>

      {/* Composer — shrink-0, in flow (not position:fixed) */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-2 shadow-[0_2px_24px_-12px_rgba(0,0,0,0.12)]">
            <DualComposerPrompt {...superChatComposer} />
          </div>
        </div>
      </div>
    </div>
  );
}
