"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { ChatStatus, UIMessage } from "ai";

import { type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { DualComposerPrompt } from "@/components/chat/dual-composer-prompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";

import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import type { ToolUIPart } from "ai";

import type { DocumentInfo } from "@/types/doc-chat";
import type { TreeNode } from "@pageindex/sdk";

const DOC_SELECT_NONE = "__none__";

// ------ Document Selector ------

function DocumentSelector({ documents, selectedDocId, onSelect, onUpload, docStatus, disabled }: { documents: DocumentInfo[]; selectedDocId: string | null; onSelect: (docId: string | null) => void; onUpload: (file: File) => void; docStatus: string | null; disabled?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select disabled={disabled} value={selectedDocId ?? DOC_SELECT_NONE} onValueChange={(v) => (v === DOC_SELECT_NONE ? onSelect(null) : onSelect(v))}>
        <SelectTrigger className="w-full max-w-sm">
          <SelectValue placeholder="Select a document…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DOC_SELECT_NONE}>Select a document…</SelectItem>
          {documents.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name} {d.status !== "completed" ? `(${d.status})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={disabled}>
        Upload PDF
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />

      {docStatus && docStatus !== "completed" && (
        <Badge variant="outline" className="h-6 animate-pulse border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200">
          {docStatus}…
        </Badge>
      )}
      {docStatus === "completed" && (
        <Badge variant="outline" className="h-6 border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
          Ready
        </Badge>
      )}
    </div>
  );
}

// ------ Reasoning Step Type ------

type ReasoningStepData = {
  step: string;
  status: string;
  label: string;
  detail?: string;
  scores?: string[];
  llmInput?: {
    model?: string;
    userQuestion?: string;
    pages?: number[];
    contextChars?: number;
    systemPromptPreview?: string;
  };
};

// ------ Reasoning Steps Display ------

function ReasoningSteps({ steps }: { steps: ReasoningStepData[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 space-y-1.5 mb-2">
      <div className="text-xs font-medium text-violet-800">TypeSafe Reasoning</div>
      {steps.map((s, i) => (
        <div key={`${s.step}-${i}`} className="flex items-baseline gap-2 text-xs">
          <span className={`inline-block size-1.5 rounded-full shrink-0 ${s.status === "running" ? "bg-blue-500 animate-pulse" : s.status === "done" ? "bg-emerald-500" : "bg-red-500"}`} />
          <div className="min-w-0">
            <span className="text-foreground/80">{s.label}</span>
            {s.detail && <span className="text-muted-foreground ml-1">— {s.detail}</span>}
            {s.scores && s.scores.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {s.scores.map((score, j) => (
                  <span key={j} className="inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 font-mono">
                    {score}
                  </span>
                ))}
              </div>
            )}
            {s.llmInput && (
              <details className="mt-1.5 rounded border border-violet-200 bg-violet-50 p-1.5">
                <summary className="cursor-pointer text-[11px] font-medium text-violet-800">Final LLM input</summary>
                <div className="mt-1 space-y-1 text-[11px]">
                  {s.llmInput.model && (
                    <div>
                      <span className="font-medium">Model:</span> {s.llmInput.model}
                    </div>
                  )}
                  {s.llmInput.pages && s.llmInput.pages.length > 0 && (
                    <div>
                      <span className="font-medium">Pages:</span> {s.llmInput.pages.join(", ")}
                    </div>
                  )}
                  {typeof s.llmInput.contextChars === "number" && (
                    <div>
                      <span className="font-medium">Context chars:</span> {s.llmInput.contextChars}
                    </div>
                  )}
                  {s.llmInput.userQuestion && (
                    <div>
                      <span className="font-medium">Question:</span> {s.llmInput.userQuestion}
                    </div>
                  )}
                  {s.llmInput.systemPromptPreview && <pre className="mt-1 max-h-40 overflow-auto rounded bg-white/70 p-1.5 text-[10px] leading-relaxed text-foreground/80 whitespace-pre-wrap">{s.llmInput.systemPromptPreview}</pre>}
                </div>
              </details>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ------ Chat Panel ------

function DocChatPanel({ label, badge, badgeColor, messages, status, reasoningSteps }: { label: string; badge: string; badgeColor: string; messages: UIMessage[]; status: string; reasoningSteps?: ReasoningStepData[] }) {
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
                    const toolPart = part as ToolUIPart;
                    return (
                      <Tool key={`${message.id}-${i}`} defaultOpen={toolPart.state === "output-available"}>
                        <ToolHeader type={toolPart.type} state={toolPart.state || "output-available"} className="cursor-pointer" />
                        <ToolContent>
                          <ToolInput input={toolPart.input || {}} />
                          {toolPart.state === "output-available" && <ToolOutput output={toolPart.output} errorText={toolPart.errorText} />}
                        </ToolContent>
                      </Tool>
                    );
                  }

                  return null;
                })}

                {/* Show reasoning steps after the last user message */}
                {msgIdx === lastUserIdx && reasoningSteps && reasoningSteps.length > 0 && (
                  <ReasoningSteps steps={reasoningSteps} />
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

// ------ Main Page ------

export default function DocChatPage() {
  const [input, setInput] = useState("");
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[] | null>(null);
  const treeJson = useMemo(() => (tree ? JSON.stringify(tree) : ""), [tree]);

  // Load document list on mount
  useEffect(() => {
    fetch("/api/doc-chat/documents")
      .then((r) => r.json())
      .then((docs: DocumentInfo[]) => setDocuments(docs))
      .catch(() => {});
  }, []);

  // Poll document status when processing
  useEffect(() => {
    if (!selectedDocId) return;
    let cancelled = false;

    const poll = async () => {
      const res = await fetch(`/api/doc-chat/documents?docId=${selectedDocId}`);
      const doc: DocumentInfo = await res.json();
      if (cancelled) return;
      setDocStatus(doc.status);

      if (doc.status === "completed") {
        // Fetch tree
        const treeRes = await fetch(`/api/doc-chat/documents/${selectedDocId}/tree`);
        const treeData = await treeRes.json();
        if (!cancelled && treeData.result) {
          setTree(treeData.result);
          try {
            localStorage.setItem(
              "typesafe:docTree:v1",
              JSON.stringify({
                docId: selectedDocId,
                savedAt: Date.now(),
                tree: treeData.result,
              }),
            );
          } catch {
            // ignore localStorage write failures
          }
        }
      } else if (doc.status !== "failed") {
        // Keep polling
        setTimeout(poll, 5000);
      }
    };
    poll();

    return () => {
      cancelled = true;
    };
  }, [selectedDocId]);

  const handleUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/doc-chat/documents", { method: "POST", body: formData });
    const { docId } = await res.json();
    setSelectedDocId(docId);
    setDocStatus("processing");
    setTree(null);
    // Add to list
    setDocuments((prev) => [{ id: docId, name: file.name, status: "processing" }, ...prev]);
  }, []);

  const pageIndexTransport = useMemo(
    () => new DefaultChatTransport({ api: "/api/doc-chat/pageindex" }),
    [],
  );

  const typesafeTransport = useMemo(
    () => new DefaultChatTransport({ api: "/api/doc-chat/typesafe-reasoning" }),
    [],
  );

  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStepData[]>([]);

  const pageIndexChat = useChat({ transport: pageIndexTransport });
  const typesafeChat = useChat({
    transport: typesafeTransport,
    onData: (part: unknown) => {
      const p = part as { type?: string; data?: ReasoningStepData };
      if (p?.type === "data-reasoning" && p.data) {
        setReasoningSteps((prev) => [...prev, p.data!]);
      }
    },
  });

  const isBusy = pageIndexChat.status !== "ready" || typesafeChat.status !== "ready";
  const isDocLoading = !!selectedDocId && docStatus !== "completed" && docStatus !== "failed";
  const isDocReady = docStatus === "completed" && tree !== null;
  const locked = isBusy || isDocLoading;

  const combinedStatus: ChatStatus = useMemo(() => {
    const a = pageIndexChat.status;
    const b = typesafeChat.status;
    if (a === "streaming" || b === "streaming") return "streaming";
    if (a === "submitted" || b === "submitted") return "submitted";
    return "ready";
  }, [pageIndexChat.status, typesafeChat.status]);

  const handleSubmit = async ({ text }: PromptInputMessage) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy || !isDocReady || !selectedDocId) return;
    setInput("");
    setReasoningSteps([]);

    await Promise.all([
      pageIndexChat.sendMessage({ text: trimmed }, { body: { docId: selectedDocId } }),
      typesafeChat.sendMessage({ text: trimmed }, { body: { docId: selectedDocId, treeJson } }),
    ]);
  };

  const handleStop = () => {
    pageIndexChat.stop();
    typesafeChat.stop();
  };

  const handleClear = async () => {
    pageIndexChat.stop();
    typesafeChat.stop();
    await fetch("/api/doc-chat/typesafe-reasoning", { method: "DELETE" });
    pageIndexChat.setMessages([]);
    typesafeChat.setMessages([]);
    setReasoningSteps([]);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Header — shrink-0, never scrolls */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <h1 className="text-lg font-semibold text-foreground">Document Q&A</h1>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void handleClear()}>
            Clear chat
          </Button>
        </div>
      </div>

      {/* Document selector — shrink-0 */}
      <div className="shrink-0 px-6 pb-4">
        <DocumentSelector
          documents={documents}
          selectedDocId={selectedDocId}
          onSelect={(id) => {
            setSelectedDocId(id);
            setDocStatus(null);
            setTree(null);
          }}
          onUpload={handleUpload}
          docStatus={docStatus}
          disabled={locked}
        />
      </div>

      {/* Panels — flex-1 min-h-0 so children scroll independently */}
      <div className="grid grid-cols-[1fr_1px_1fr] flex-1 min-h-0">
        <DocChatPanel label="PageIndex Chat" badge="Built-in RAG retrieval" badgeColor="bg-blue-100 text-blue-700" messages={pageIndexChat.messages} status={pageIndexChat.status} />
        <div className="bg-border/60" aria-hidden />
        <DocChatPanel label="TypeSafe AI Reasoning" badge="Tree reasoning retrieval" badgeColor="bg-violet-100 text-violet-700" messages={typesafeChat.messages} status={typesafeChat.status} reasoningSteps={reasoningSteps} />
      </div>

      {/* Composer — shrink-0, in flow (not position:fixed) */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-2 shadow-[0_2px_24px_-12px_rgba(0,0,0,0.12)]">
            <DualComposerPrompt
              input={input}
              onInputChange={setInput}
              onSubmit={handleSubmit}
              status={combinedStatus}
              onStop={handleStop}
              disableInput={isBusy || !isDocReady}
              disableSubmit={(combinedStatus === "ready" && !input.trim()) || !isDocReady}
              placeholder={isDocReady ? "Ask a question about the document…" : "Select or upload a document first…"}
              hint={<span className="text-[11px] text-muted-foreground sm:text-xs">Same question → both panels → compare retrieval quality & speed</span>}
              submitAriaLabelReady="Send to both"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
