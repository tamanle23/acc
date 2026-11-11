import type { ModelCatalogEntry, VoicePreset } from "@ai-monorepo/ai-control-plane-sdk";
import { DynamicInputDeck } from "./dynamic-input-deck";
import { DynamicParameterDeck } from "./dynamic-parameter-deck";

export interface BespokePipelineInputProps {
  manifest: ModelCatalogEntry;
  inputText: string;
  onChangeInputText: (val: string) => void;
  params: Record<string, any>;
  onChangeParam: (key: string, val: any) => void;
  selectedBinaryName: string;
  onSelectBinaryFile: (file: File | Blob | null, name: string) => void;
  isRecordingMic: boolean;
  onToggleMicCapture: () => void;
  showZeroShot: boolean;
  onToggleZeroShot: () => void;
  refAudioPath: string;
  onChangeRefAudioPath: (val: string) => void;
  onResetDefaults?: () => void;
  voices?: VoicePreset[];
}

/**
 * BespokePipelineStudioSurface
 *
 * Isomorphic, contract-driven surface that renders inputs, assets, and parameters
 * dynamically based on the model manifest's input_modality and parameters_schema.
 */
export function BespokePipelineStudioSurface(props: BespokePipelineInputProps) {
  return (
    <div class="space-y-3.5">
      <DynamicInputDeck
        manifest={props.manifest}
        inputText={props.inputText}
        onChangeInputText={props.onChangeInputText}
        params={props.params}
        onChangeParam={props.onChangeParam}
        selectedBinaryName={props.selectedBinaryName}
        onSelectBinaryFile={props.onSelectBinaryFile}
        isRecordingMic={props.isRecordingMic}
        onToggleMicCapture={props.onToggleMicCapture}
        showZeroShot={props.showZeroShot}
        onToggleZeroShot={props.onToggleZeroShot}
        refAudioPath={props.refAudioPath}
        onChangeRefAudioPath={props.onChangeRefAudioPath}
      />
      <DynamicParameterDeck
        manifest={props.manifest}
        params={props.params}
        onChangeParam={props.onChangeParam}
        onResetDefaults={props.onResetDefaults}
        voices={props.voices}
        onOpenVoiceCloning={props.onToggleZeroShot}
      />
    </div>
  );
}

export { DynamicInputDeck } from "./dynamic-input-deck";
export { DynamicParameterDeck } from "./dynamic-parameter-deck";
