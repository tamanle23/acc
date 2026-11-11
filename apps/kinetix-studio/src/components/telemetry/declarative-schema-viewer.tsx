import { createSignal, createMemo, Show, type Component } from 'solid-js';
import { Code2, Copy, Check, Edit3 } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Button } from '@/components/ui/button';
import { generateDeclarativeSchema } from '@/lib/schema';

export const DeclarativeSchemaViewer: Component = () => {
  const studio = useStudio();
  const [isEditing, setIsEditing] = createSignal<boolean>(false);
  const [editText, setEditText] = createSignal<string>('');
  const [editError, setEditError] = createSignal<string | null>(null);

  const schemaJsonString = createMemo(() =>
    generateDeclarativeSchema(studio.state, studio.wcagContrast)
  );

  const handleStartEditing = () => {
    setEditText(schemaJsonString());
    setEditError(null);
    setIsEditing(true);
  };

  const handleApply = () => {
    const result = studio.applyDeclarativeContract(editText());
    if (result.success) {
      setEditError(null);
      setIsEditing(false);
      studio.triggerToast('Applied Declarative Contract to Studio');
    } else {
      setEditError(result.error ?? 'Invalid declarative schema contract');
    }
  };

  return (
    <div class="flex-1 flex flex-col overflow-hidden p-3 select-none">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
          <Code2 class="w-3.5 h-3.5 text-primary" />
          4-Layer Declarative Schema (v4.1)
        </span>
        <div class="flex items-center gap-1">
          <Show
            when={isEditing()}
            fallback={
              <>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleStartEditing}
                  title="Edit or Paste Declarative Contract JSON"
                >
                  <Edit3 class="w-3 h-3" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    navigator.clipboard?.writeText(schemaJsonString());
                    studio.triggerToast('Copied Declarative JSON Contract');
                  }}
                >
                  <Copy class="w-3 h-3" /> Copy
                </Button>
              </>
            }
          >
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="xs"
              onClick={handleApply}
            >
              <Check class="w-3 h-3" /> Apply
            </Button>
          </Show>
        </div>
      </div>

      <Show
        when={isEditing()}
        fallback={
          <pre class="flex-1 overflow-y-auto p-2.5 rounded bg-card border border-border text-xs font-mono text-foreground leading-relaxed select-text">
            {schemaJsonString()}
          </pre>
        }
      >
        <div class="flex-1 flex flex-col overflow-hidden space-y-1">
          <textarea
            value={editText()}
            onInput={(e) => {
              setEditText(e.currentTarget.value);
              setEditError(null);
            }}
            class="flex-1 overflow-y-auto p-2.5 rounded bg-background border border-border text-xs font-mono text-foreground leading-relaxed select-text focus:outline-none focus:border-primary resize-none"
          />
          <Show when={editError()}>
            <div class="text-[11px] font-mono text-red-400 px-1 py-0.5">
              {editError()}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
