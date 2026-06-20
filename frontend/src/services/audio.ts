export function pcm16ToFloat32(arrayBuffer: ArrayBuffer): Float32Array {
  const dataView = new DataView(arrayBuffer);
  const float32Array = new Float32Array(arrayBuffer.byteLength / 2);
  for (let i = 0; i < float32Array.length; i++) {
    const int16 = dataView.getInt16(i * 2, true);
    float32Array[i] = int16 / 32768.0;
  }
  return float32Array;
}
