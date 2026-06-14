import wave
import os

def raw_to_wav(raw_file, wav_file, framerate):
    if not os.path.exists(raw_file):
        print(f"File {raw_file} does not exist.")
        return
    with open(raw_file, "rb") as f:
        data = f.read()
    with wave.open(wav_file, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(framerate)
        wf.writeframes(data)
    print(f"Saved {wav_file}")

raw_to_wav("frontend_input.raw", "frontend_input.wav", 16000)
raw_to_wav("gemini_output.raw", "gemini_output.wav", 24000)
