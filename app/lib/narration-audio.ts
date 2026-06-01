"use client";

/**
 * Browser-side narration audio processing — ported from the TB Audio Editor:
 *  - detectSpeechRegions(): RMS-based silence detection → speech segments
 *  - encodeSliceToMp3(): slice an AudioBuffer and encode that span to MP3 (lamejs)
 * The ZIP/download path is dropped here — each slice is uploaded straight to a
 * page's narration slot instead.
 */

export type SpeechRegion = { start: number; end: number };

export type SilenceOpts = {
  /** RMS below this counts as silence. */
  silenceThreshold?: number;
  /** Minimum silence length that breaks a segment (sec). */
  minSilenceSec?: number;
  /** Drop segments shorter than this (sec). */
  minRegionSec?: number;
  /** Pad each segment by this on both ends (sec). */
  paddingSec?: number;
};

/** Detect speech (non-silent) segments via a 20ms RMS window. */
export function detectSpeechRegions(
  buffer: AudioBuffer,
  opts: SilenceOpts = {},
): SpeechRegion[] {
  const {
    silenceThreshold = 0.015,
    minSilenceSec = 0.4,
    minRegionSec = 0.2,
    paddingSec = 0.08,
  } = opts;
  const sampleRate = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.02)); // 20ms
  const loud: boolean[] = [];
  for (let i = 0; i < data.length; i += windowSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, data.length);
    for (let j = i; j < end; j++) sum += data[j] * data[j];
    loud.push(Math.sqrt(sum / (end - i)) >= silenceThreshold);
  }

  const winSec = windowSize / sampleRate;
  const minSilenceWins = Math.ceil(minSilenceSec / winSec);
  const out: SpeechRegion[] = [];
  let inSpeech = false;
  let startWin = 0;
  let silenceRun = 0;
  for (let w = 0; w < loud.length; w++) {
    if (loud[w]) {
      if (!inSpeech) {
        inSpeech = true;
        startWin = w;
      }
      silenceRun = 0;
    } else if (inSpeech) {
      silenceRun++;
      if (silenceRun >= minSilenceWins) {
        const endWin = w - silenceRun + 1;
        out.push({ start: startWin * winSec, end: endWin * winSec });
        inSpeech = false;
        silenceRun = 0;
      }
    }
  }
  if (inSpeech) out.push({ start: startWin * winSec, end: loud.length * winSec });

  const dur = buffer.duration;
  return out
    .filter((r) => r.end - r.start >= minRegionSec)
    .map((r) => ({
      start: Math.max(0, r.start - paddingSec),
      end: Math.min(dur, r.end + paddingSec),
    }));
}

/** -1.0..1.0 float → -32768..32767 int16 (lamejs wants Int16 PCM). */
function floatTo16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

type LameModule = {
  Mp3Encoder: new (
    channels: number,
    sampleRate: number,
    kbps: number,
  ) => {
    encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array;
    flush: () => Int8Array;
  };
};

/** Concatenate Int16 PCM chunks into one buffer. */
function concatInt16(parts: Int16Array[]): Int16Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Int16Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Encode [startSec, endSec) of the buffer to an MP3 byte array. */
export async function encodeSliceToMp3(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
  kbps = 128,
): Promise<Uint8Array> {
  return encodeSlicesToMp3(buffer, [{ start: startSec, end: endSec }], kbps);
}

/**
 * Encode several [start, end) ranges of the buffer into ONE MP3, concatenated
 * in the given order — used when a page holds multiple narration segments.
 */
export async function encodeSlicesToMp3(
  buffer: AudioBuffer,
  ranges: { start: number; end: number }[],
  kbps = 128,
): Promise<Uint8Array> {
  const mod = (await import("@breezystack/lamejs")) as unknown as
    | LameModule
    | { default: LameModule };
  const Mp3Encoder =
    (mod as LameModule).Mp3Encoder ??
    (mod as { default: LameModule }).default.Mp3Encoder;

  const sampleRate = buffer.sampleRate;
  const channels = Math.min(2, buffer.numberOfChannels);
  const ch0 = buffer.getChannelData(0);
  const ch1 = channels > 1 ? buffer.getChannelData(1) : null;
  const leftParts: Int16Array[] = [];
  const rightParts: Int16Array[] = [];
  for (const { start, end } of ranges) {
    const a = Math.floor(start * sampleRate);
    const b = Math.floor(end * sampleRate);
    if (b <= a) continue;
    leftParts.push(floatTo16(ch0.subarray(a, b)));
    if (ch1) rightParts.push(floatTo16(ch1.subarray(a, b)));
  }
  const left = concatInt16(leftParts);
  const right = ch1 ? concatInt16(rightParts) : null;

  const enc = new Mp3Encoder(channels, sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  const BLOCK = 1152; // MP3 frame size
  for (let i = 0; i < left.length; i += BLOCK) {
    const l = left.subarray(i, i + BLOCK);
    const mp3 = right
      ? enc.encodeBuffer(l, right.subarray(i, i + BLOCK))
      : enc.encodeBuffer(l);
    if (mp3.length > 0) chunks.push(new Uint8Array(mp3));
  }
  const tail = enc.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    result.set(c, off);
    off += c.length;
  }
  return result;
}
