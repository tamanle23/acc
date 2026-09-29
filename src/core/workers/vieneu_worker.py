# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "torch",
#     "torchaudio",
#     "torchcodec",
#     "vieneu==3.8.3",
# ]
# ///

import sys
import json
import traceback
import os
import uuid

def log(msg):
    print(msg, file=sys.stderr, flush=True)

def main():
    try:
        import torchaudio
        import torch
        from vieneu import Vieneu
        
        log("Initializing Vieneu TTS v3 Turbo...")
        tts_engine = Vieneu(mode="v3turbo")
        log("Vieneu initialized.")
        print("WORKER_READY", flush=True)
    except ImportError as e:
        log(f"Import Error: {e}")
        log("Please ensure 'vieneu' and 'torchaudio' are installed (e.g., pip install git+https://github.com/pnnbao97/VieNeu-TTS)")
        sys.exit(1)
    except Exception as e:
        log(f"Initialization Error: {traceback.format_exc()}")
        sys.exit(1)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
            
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            action = req.get("action")
            payload = req.get("payload", {})
            
            if action == "synthesize":
                text = payload.get("text")
                voice = payload.get("voice", "Ngọc Trân")
                output_dir = payload.get("outputDir", "./output")
                
                os.makedirs(output_dir, exist_ok=True)
                file_name = f"tts_{uuid.uuid4().hex[:8]}.wav"
                output_file = os.path.join(output_dir, file_name)
                
                log(f"Synthesizing text: '{text[:30]}...' with voice: {voice}")
                
                # Perform inference
                # Note: Vieneu infer() likely returns a torch Tensor or numpy array
                audio_data = tts_engine.infer(text, voice=voice)
                
                # We assume 48kHz as per README
                sample_rate = 48000 
                
                # Convert to tensor if it's numpy
                if not isinstance(audio_data, torch.Tensor):
                    audio_data = torch.tensor(audio_data)
                
                # Ensure 2D tensor for torchaudio (channels, frames)
                if len(audio_data.shape) == 1:
                    audio_data = audio_data.unsqueeze(0)
                    
                torchaudio.save(output_file, audio_data.cpu(), sample_rate)
                log(f"Saved audio to {output_file}")
                
                print(json.dumps({
                    "id": req_id,
                    "status": "success",
                    "data": {
                        "file": output_file
                    }
                }), flush=True)
            else:
                raise ValueError(f"Unknown action: {action}")
                
        except Exception as e:
            log(f"Error processing request {req_id}: {traceback.format_exc()}")
            if req_id:
                print(json.dumps({
                    "id": req_id,
                    "status": "error",
                    "message": str(e)
                }), flush=True)

if __name__ == "__main__":
    main()
