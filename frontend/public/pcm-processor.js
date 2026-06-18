class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // No resampling here. We just convert the native input to 16-bit PCM.
    // The backend will handle the downsampling using Python's audioop.
    
    // Output buffer: collect 2048 output samples (4096 bytes) before sending
    this.outputBuffer = new ArrayBuffer(4096);
    this.outputView = new DataView(this.outputBuffer);
    this.outputByteOffset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const float32 = input[0]; // 128 samples at native inputRate (e.g. 48kHz)

    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      const intVal = s < 0 ? s * 0x8000 : s * 0x7FFF;

      // Write little-endian int16
      this.outputView.setInt16(this.outputByteOffset, intVal, true);
      this.outputByteOffset += 2;

      // Flush when buffer is full (2048 samples * 2 bytes = 4096 bytes)
      if (this.outputByteOffset >= this.outputBuffer.byteLength) {
        this.port.postMessage(this.outputBuffer.slice(0));
        this.outputByteOffset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
