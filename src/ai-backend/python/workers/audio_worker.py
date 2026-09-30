# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "torch",
#     "diffusers==0.27.2",
#     "transformers==4.38.2",
#     "huggingface-hub==0.22.2",
#     "accelerate",
#     "soundfile",
#     "scipy"
# ]
# ///

import sys
import torch
import scipy.io.wavfile
from diffusers import AudioLDM2Pipeline
from base_worker import run_worker

_pipelines = {}

def get_pipeline(model_id):
    if model_id in _pipelines:
        return _pipelines[model_id]
        
    print(f"Loading audio model {model_id} into memory...", flush=True)
    
    repo_id = "cvssp/audioldm2"
    if model_id == "audioldm2-large":
        repo_id = "cvssp/audioldm2-large"
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if device == "cuda" else torch.float32

    pipe = AudioLDM2Pipeline.from_pretrained(repo_id, torch_dtype=torch_dtype)
    pipe = pipe.to(device)
    
    _pipelines[model_id] = pipe
    print(f"Model {model_id} successfully loaded to {device}.", flush=True)
    return pipe

def audio_task_handler(action, payload):
    if action == "generate_sfx":
        prompt = payload.get("prompt")
        model_id = payload.get("model", "audioldm2-base")
        duration = payload.get("duration", 3.0)
        output_path = payload.get("output_path")
        
        if not prompt or not output_path:
            raise ValueError("Missing prompt or output_path in payload")
            
        pipe = get_pipeline(model_id)
        audio_length_in_s = float(duration)
        num_inference_steps = 50 if torch.cuda.is_available() else 20
        
        print(f"Generating audio: '{prompt}' ({audio_length_in_s}s)", flush=True)
        
        generator = torch.Generator(device=pipe.device)
        audio = pipe(
            prompt,
            num_inference_steps=num_inference_steps,
            audio_length_in_s=audio_length_in_s,
            num_waveforms_per_prompt=1,
            generator=generator
        ).audios[0]

        scipy.io.wavfile.write(output_path, rate=16000, data=audio)
        
        return {
            "file_path": output_path
        }
    else:
        raise ValueError(f"Unknown action: {action}")

if __name__ == "__main__":
    run_worker(audio_task_handler)
