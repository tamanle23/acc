import { createSignal, createMemo, createEffect, Show, For } from "solid-js";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Volume2,
  Check,
  Copy,
  Send,
  Trash2,
  Bot,
  User,
  MessageSquare,
  Square,
} from "lucide-solid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { safeRandomUUID } from "@ai-monorepo/ai-control-plane-sdk";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  timestamp: string;
  tokens?: number;
  tps?: number;
}

export interface LLMVisualizerProps {
  output: {
    generated_text?: string;
    reasoning_trace?: string;
    answer_markdown?: string;
    system_persona?: string;
    json_schema_mode?: boolean;
    temperature?: number;
    top_p?: number;
    max_new_tokens?: number;
    weight_tier?: string;
    tokens_generated?: number;
    ttft_ms?: number;
    tokens_per_sec?: number;
    token_probabilities?: Array<{ token: string; probability: number }>;
  };
  liveInputText?: string;
  liveParams?: Record<string, any>;
  activeWeightTier?: string;
  activeSpeedup?: number;
  isStreaming?: boolean;
  onPipeToTts?: (text: string) => void;
  onSendMessage?: (text: string) => void;
  onStopStreaming?: () => void;
  samplePrompts?: Array<{ label: string; text: string }>;
  modelDisplayName?: string;
}

export function LLMStreamLens(props: LLMVisualizerProps) {
  const [showReasoningMap, setShowReasoningMap] = createSignal<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [inputVal, setInputVal] = createSignal("");
  const [messages, setMessages] = createSignal<ChatMessageItem[]>([]);
  let scrollEl: HTMLDivElement | undefined;

  const weightTier = createMemo(() => props.activeWeightTier || props.output?.weight_tier || "balanced_fp16");
  const temp = createMemo(() => Number(props.liveParams?.temperature ?? props.output?.temperature ?? 0.6));
  const topP = createMemo(() => Number(props.liveParams?.top_p ?? props.output?.top_p ?? 0.92));
  const speedup = createMemo(() => props.activeSpeedup ?? 1.0);
  const tps = createMemo(() => Number(props.output?.tokens_per_sec ?? (88.4 * speedup()).toFixed(1)));
  const ttft = createMemo(() => Number(props.output?.ttft_ms ?? (14.8 / Math.max(0.4, speedup())).toFixed(1)));

  // Sync external output into conversation
  createEffect(() => {
    const answer = props.output?.answer_markdown;
    const reasoning = props.output?.reasoning_trace;
    const isStream = props.isStreaming;

    if (!answer && !props.liveInputText) return;

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant" && isStream) {
        const next = [...prev];
        next[next.length - 1] = {
          ...last,
          content: answer || "",
          reasoning: reasoning || last.reasoning,
          tokens: props.output.tokens_generated ?? last.tokens,
          tps: props.output.tokens_per_sec ?? last.tps,
        };
        return next;
      }
      if (!isStream && answer) {
        if (last && last.role === "assistant" && last.content !== answer) {
          const next = [...prev];
          next[next.length - 1] = {
            ...last,
            content: answer,
            reasoning: reasoning || last.reasoning,
            tokens: props.output.tokens_generated ?? last.tokens,
            tps: props.output.tokens_per_sec ?? last.tps,
          };
          return next;
        } else if (!last || last.role === "user") {
          return [
            ...prev,
            {
              id: safeRandomUUID(),
              role: "assistant",
              content: answer,
              reasoning: reasoning,
              timestamp: new Date().toLocaleTimeString(),
              tokens: props.output.tokens_generated,
              tps: props.output.tokens_per_sec,
            },
          ];
        }
      }
      return prev;
    });
  });

  // Initial user prompt sync if messages empty
  createEffect(() => {
    const text = typeof props.liveInputText === 'string' ? props.liveInputText.trim() : "";
    if (messages().length === 0 && text) {
      setMessages([
        {
          id: safeRandomUUID(),
          role: "user",
          content: text,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...(props.output?.answer_markdown
          ? [
              {
                id: safeRandomUUID(),
                role: "assistant" as const,
                content: props.output.answer_markdown,
                reasoning: props.output.reasoning_trace,
                timestamp: new Date().toLocaleTimeString(),
                tokens: props.output.tokens_generated,
                tps: props.output.tokens_per_sec,
              },
            ]
          : []),
      ]);
    }
  });

  createEffect(() => {
    // track messages & streaming
    messages();
    props.isStreaming;
    scrollEl?.scrollIntoView({ behavior: "smooth" });
  });

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputVal()).trim();
    if (!text) return;
    const userMsg: ChatMessageItem = {
      id: safeRandomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };
    const placeholderAssistant: ChatMessageItem = {
      id: safeRandomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg, placeholderAssistant]);
    setInputVal("");
    if (props.onSendMessage) {
      props.onSendMessage(text);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div class="flex flex-col h-[580px] rounded-2xl border border-border bg-card/60 backdrop-blur-md overflow-hidden shadow-xl">
      {/* Top Header Bar */}
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-border/80 bg-surface/80">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
            <Bot class="w-4 h-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-foreground">{props.modelDisplayName || "Local LLM / VLM Engine"}</span>
              <Badge variant="outline" class="text-[9px] uppercase px-1.5 py-0 border-primary/40 text-primary">
                {weightTier().replace("_", " ")}
              </Badge>
              <Show when={props.isStreaming}>
                <span class="flex items-center gap-1 text-[10px] text-success font-mono">
                  <span class="w-1.5 h-1.5 rounded-full bg-success animate-ping" />
                  Streaming {tps()} tok/s
                </span>
              </Show>
            </div>
            <div class="text-[10px] font-mono text-muted-foreground flex items-center gap-2">
              <span>TTFT: {ttft()}ms</span>
              <span>•</span>
              <span>Speedup: {speedup().toFixed(2)}x</span>
              <span>•</span>
              <span>T={temp().toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <Show when={messages().length > 0}>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              class="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Clear chat history"
            >
              <Trash2 class="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          </Show>
        </div>
      </div>

      {/* Messages Stream Container */}
      <div class="flex-1 p-4 overflow-y-auto space-y-4 studio-scroll">
        <Show
          when={messages().length > 0}
          fallback={
            <div class="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div class="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                <MessageSquare class="w-6 h-6" />
              </div>
              <div>
                <h4 class="text-sm font-semibold text-foreground">Interactive Local LLM/VLM Chat Box</h4>
                <p class="text-xs text-muted-foreground max-w-sm mt-1">
                  Real-time sub-second token streaming (Pattern 1) running directly on your local RTX 4070 Ti.
                </p>
              </div>
              <Show when={props.samplePrompts && props.samplePrompts.length > 0}>
                <div class="flex flex-wrap gap-1.5 justify-center max-w-md pt-2">
                  <For each={props.samplePrompts}>
                    {(p) => (
                      <button
                        type="button"
                        onClick={() => handleSend(p.text)}
                        class="text-[11px] px-2.5 py-1 rounded-full border border-border bg-surface/70 hover:bg-primary/10 hover:border-primary/40 text-muted-foreground hover:text-foreground transition"
                      >
                        {p.label || p.text.slice(0, 36)}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          }
        >
          <For each={messages()}>
            {(msg) => (
              <div
                class={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <Show when={msg.role === "assistant"}>
                  <div class="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <Bot class="w-3.5 h-3.5" />
                  </div>
                </Show>

                <div
                  class={`rounded-2xl p-3.5 space-y-2 text-xs leading-relaxed max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm shadow-md"
                      : "bg-surface/90 border border-border/80 text-foreground rounded-tl-sm shadow-sm"
                  }`}
                >
                  {/* Assistant Thinking Trace (<think>) */}
                  <Show when={msg.role === "assistant" && msg.reasoning}>
                    <div class="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden my-1">
                      <button
                        type="button"
                        onClick={() =>
                          setShowReasoningMap((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                        }
                        class="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] font-mono text-primary hover:bg-primary/10 transition"
                      >
                        <span class="flex items-center gap-1.5 font-semibold">
                          <Sparkles class="w-3 h-3" />
                          <span>&lt;think&gt; Reasoning Trace</span>
                        </span>
                        <Show when={showReasoningMap()[msg.id]} fallback={<ChevronDown class="w-3 h-3" />}>
                          <ChevronUp class="w-3 h-3" />
                        </Show>
                      </button>
                      <Show when={showReasoningMap()[msg.id]}>
                        <div class="px-2.5 py-2 border-t border-primary/20 font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">
                          {msg.reasoning}
                        </div>
                      </Show>
                    </div>
                  </Show>

                  {/* Message Body */}
                  <div class="whitespace-pre-wrap font-sans">
                    <Show
                      when={msg.content}
                      fallback={
                        <span class="italic text-muted-foreground flex items-center gap-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                          Generating tokens...
                        </span>
                      }
                    >
                      {msg.content}
                    </Show>
                    <Show when={msg.role === "assistant" && props.isStreaming && msg.id === messages()[messages().length - 1]?.id}>
                      <span class="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5 align-middle" />
                    </Show>
                  </div>

                  {/* Assistant Footer Toolbar */}
                  <Show when={msg.role === "assistant" && msg.content}>
                    <div class="flex items-center justify-between pt-1 border-t border-border/50 text-[10px] text-muted-foreground font-mono">
                      <div class="flex items-center gap-2">
                        <Show when={msg.tps}><span>{msg.tps} tok/s</span></Show>
                        <Show when={msg.tokens}><span>{msg.tokens} tokens</span></Show>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(msg.content);
                            setCopiedId(msg.id);
                            setTimeout(() => setCopiedId(null), 1500);
                          }}
                          class="px-1.5 py-0.5 rounded hover:bg-card transition flex items-center gap-1"
                          title="Copy message"
                        >
                          <Show when={copiedId() === msg.id} fallback={<Copy class="w-3 h-3" />}>
                            <Check class="w-3 h-3 text-success" />
                          </Show>
                          <span>{copiedId() === msg.id ? "Copied" : "Copy"}</span>
                        </button>
                        <Show when={props.onPipeToTts}>
                          <button
                            type="button"
                            onClick={() => props.onPipeToTts!(msg.content.replace(/[#*`]/g, "").slice(0, 420))}
                            class="px-1.5 py-0.5 rounded hover:bg-card transition flex items-center gap-1 text-success"
                            title="Speak via VieNeu-TTS 48kHz"
                          >
                            <Volume2 class="w-3 h-3" />
                            <span>TTS</span>
                          </button>
                        </Show>
                      </div>
                    </div>
                  </Show>
                </div>

                <Show when={msg.role === "user"}>
                  <div class="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <User class="w-3.5 h-3.5" />
                  </div>
                </Show>
              </div>
            )}
          </For>
        </Show>
        <div ref={scrollEl} />
      </div>

      {/* Bottom Chat Input Dock */}
      <div class="p-3 border-t border-border/80 bg-surface/90 space-y-2">
        <Show when={props.samplePrompts && props.samplePrompts.length > 0 && messages().length > 0}>
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] studio-scroll">
            <span class="text-muted-foreground shrink-0">Prompts:</span>
            <For each={props.samplePrompts!.slice(0, 4)}>
              {(p) => (
                <button
                  type="button"
                  onClick={() => handleSend(p.text)}
                  class="px-2 py-0.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground whitespace-nowrap transition"
                >
                  {p.label || p.text.slice(0, 24)}
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class="flex items-end gap-2 bg-card border border-border/90 rounded-xl p-2 focus-within:border-primary/60 transition shadow-inner">
          <textarea
            value={inputVal()}
            onInput={(e) => setInputVal(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
            rows={2}
            class="flex-1 bg-transparent border-0 outline-none resize-none text-xs text-foreground placeholder:text-muted-foreground leading-relaxed px-1"
          />

          <div class="flex items-center gap-1 shrink-0">
            <Show
              when={props.isStreaming}
              fallback={
                <Button
                  size="sm"
                  onClick={() => handleSend()}
                  disabled={!inputVal().trim()}
                  class="h-8 px-3 text-xs font-semibold gap-1.5 shadow"
                >
                  <Send class="w-3.5 h-3.5" />
                  Send
                </Button>
              }
            >
              <Button
                size="sm"
                variant="destructive"
                onClick={props.onStopStreaming}
                class="h-8 px-3 text-xs font-semibold gap-1.5 shadow"
              >
                <Square class="w-3.5 h-3.5 fill-current" />
                Stop
              </Button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
