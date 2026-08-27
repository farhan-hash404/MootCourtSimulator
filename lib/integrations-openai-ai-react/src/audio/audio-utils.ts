/**
 * Audio utility functions for voice chat.
 * Handles PCM16 decoding and AudioContext initialization.
 */

/**
 * Decode base64 PCM16 audio to Float32Array for Web Audio API
 */
export function decodePCM16ToFloat32(base64Audio: string): Float32Array {
  try {
    const raw = atob(base64Audio);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    const sampleCount = Math.floor(bytes.byteLength / 2);
    const float32 = new Float32Array(sampleCount);
    const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
    for (let i = 0; i < sampleCount; i++) {
      float32[i] = view.getInt16(i * 2, true) / 32768;
    }
    return float32;
  } catch (err) {
    console.warn("Failed to decode PCM16 chunk:", err);
    return new Float32Array(0);
  }
}

/**
 * Create and initialize AudioContext with worklet
 */
export async function createAudioPlaybackContext(
  workletPath: string,
  sampleRate = 24000
): Promise<{ ctx: AudioContext; worklet: AudioWorkletNode }> {
  if (!workletPath) {
    throw new Error("workletPath is required for audio playback");
  }
  const ctx = new AudioContext({ sampleRate });
  await ctx.audioWorklet.addModule(workletPath);
  const worklet = new AudioWorkletNode(ctx, "audio-playback-processor");
  worklet.connect(ctx.destination);
  return { ctx, worklet };
}
