// Speech Lab model worker. Runs every model off the main thread so the page stays responsive.
// Libraries and model weights are fetched on first use and then served from the browser cache.
//
// Tasks (message { id, task, ...payload } -> { id, type: "progress" | "result" | "error", ... }):
//   asr  { audio: Float32Array@16k, language }        -> { text }
//   sv   { a: Float32Array@16k, b: Float32Array@16k }  -> { score, threshold }
//   tts  { text, voice, speed }                        -> { audio: Float32Array, sampleRate }
//   cm   { audio: Float32Array@16k }                   -> { bonafide, windows: [p, ...] }

const TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort.wasm.min.mjs";
const ORT_WASM = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/";
const PHONEMIZE = "https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/dist/piper-o91UDS6e.js";
const PHONEMIZE_WASM = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm";
const PHONEMIZE_DATA = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data";
const VOICES_BASE = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main/";
const AASIST_URL = new URL("../models/aasist.onnx", import.meta.url).href;

const ASR_MODEL = "onnx-community/whisper-base";
const SV_MODEL = "Xenova/wavlm-base-plus-sv";
const SV_THRESHOLD = 0.86; // cosine threshold suggested on the model card
const CACHE = "speech-lab-v1";

// ---------- helpers ----------
let current = null; // id of the task being processed, for progress messages
const progress = (label, loaded, total) => postMessage({ id: current, type: "progress", label, loaded, total });

async function fetchCached(url, label) {
  let cache = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch (e) { cache = null; }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const total = +res.headers.get("content-length") || 0;
  const reader = res.body.getReader();
  const parts = [];
  let loaded = 0, last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    if (label && Date.now() - last > 120) { last = Date.now(); progress(label, loaded, total); }
  }
  const buf = new Uint8Array(loaded);
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  if (label) progress(label, loaded, loaded);
  try { if (cache) await cache.put(url, new Response(buf)); } catch (e) { /* quota: ignore */ }
  return buf;
}

// Aggregates transformers.js per-file progress into one bar.
function hfProgress(label) {
  const files = {};
  return (e) => {
    if (e.status === "progress" && e.total) {
      files[e.file] = [e.loaded, e.total];
      let l = 0, t = 0;
      for (const [a, b] of Object.values(files)) { l += a; t += b; }
      progress(label, l, t);
    }
  };
}

// ---------- onnxruntime (Piper + AASIST) ----------
let ortLib = null;
async function getOrt() {
  if (!ortLib) {
    ortLib = await import(ORT);
    ortLib.env.wasm.wasmPaths = ORT_WASM;
    ortLib.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  }
  return ortLib;
}

// ---------- transformers.js (Whisper + WavLM) ----------
let tf = null;
async function getTf() {
  if (!tf) {
    tf = await import(TRANSFORMERS);
    tf.env.allowLocalModels = false;
  }
  return tf;
}

let asrPipe = null;
async function asr({ audio, language }) {
  const { pipeline } = await getTf();
  asrPipe = asrPipe || await pipeline("automatic-speech-recognition", ASR_MODEL, {
    dtype: "q8", progress_callback: hfProgress("Whisper"),
  });
  progress("run");
  const opts = { task: "transcribe", chunk_length_s: 30, stride_length_s: 5 };
  if (language && language !== "auto") opts.language = language;
  const out = await asrPipe(audio, opts);
  return { text: (out.text || "").trim() };
}

let sv = null;
async function speakerVerify({ a, b }) {
  const { AutoProcessor, WavLMForXVector } = await getTf();
  if (!sv) {
    const cb = hfProgress("WavLM");
    sv = {
      processor: await AutoProcessor.from_pretrained(SV_MODEL, { progress_callback: cb }),
      model: await WavLMForXVector.from_pretrained(SV_MODEL, { dtype: "q8", progress_callback: cb }),
    };
  }
  progress("run");
  const embed = async (x) => (await sv.model(await sv.processor(x))).embeddings.data;
  const ea = await embed(a), eb = await embed(b);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < ea.length; i++) { dot += ea[i] * eb[i]; na += ea[i] * ea[i]; nb += eb[i] * eb[i]; }
  return { score: dot / Math.sqrt(na * nb), threshold: SV_THRESHOLD };
}

// ---------- Piper TTS ----------
let phonemizeLib = null;
const voices = {};

async function phonemize(text, espeakVoice) {
  phonemizeLib = phonemizeLib || await import(PHONEMIZE);
  // The phonemizer data file is large; download it once with progress so later runs hit the HTTP cache.
  await fetchCached(PHONEMIZE_DATA, "espeak-ng");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Phonemizer timed out")), 60000);
    phonemizeLib.createPiperPhonemize({
      print: (line) => {
        try { clearTimeout(timer); resolve(JSON.parse(line).phoneme_ids); } catch (e) { reject(e); }
      },
      printErr: (m) => console.warn("[phonemize]", m),
      locateFile: (u) => (u.endsWith(".wasm") ? PHONEMIZE_WASM : u.endsWith(".data") ? PHONEMIZE_DATA : u),
    }).then((mod) => {
      mod.callMain(["-l", espeakVoice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
    }).catch((e) => { clearTimeout(timer); reject(e); });
  });
}

async function loadVoice(path) {
  if (!voices[path]) {
    const ort = await getOrt();
    const cfg = JSON.parse(new TextDecoder().decode(await fetchCached(VOICES_BASE + path + ".json")));
    const model = await fetchCached(VOICES_BASE + path, "Piper");
    voices[path] = { cfg, session: await ort.InferenceSession.create(model, { executionProviders: ["wasm"] }) };
  }
  return voices[path];
}

async function tts({ text, voice, speed }) {
  const ort = await getOrt();
  const { cfg, session } = await loadVoice(voice);
  progress("run");
  const ids = await phonemize(text, cfg.espeak.voice);
  const inf = cfg.inference || {};
  const feeds = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / (speed || 1), inf.noise_w ?? 0.8]), [3]),
  };
  if (cfg.num_speakers > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1]);
  const out = await session.run(feeds);
  return { audio: new Float32Array(out.output.data), sampleRate: cfg.audio.sample_rate };
}

// ---------- AASIST countermeasure ----------
const CM_LEN = 64600; // ~4 s at 16 kHz, the input length AASIST was trained with
const CM_HOP = 32000;
let cmSession = null;

async function countermeasure({ audio }) {
  const ort = await getOrt();
  if (!cmSession) cmSession = await ort.InferenceSession.create(await fetchCached(AASIST_URL, "AASIST"), { executionProviders: ["wasm"] });
  progress("run");
  const windows = [];
  if (audio.length <= CM_LEN) {
    const x = new Float32Array(CM_LEN);
    for (let i = 0; i < CM_LEN; i++) x[i] = audio[i % audio.length]; // repeat-pad, as in AASIST's data loader
    windows.push(x);
  } else {
    const starts = [];
    for (let s = 0; s + CM_LEN <= audio.length; s += CM_HOP) starts.push(s);
    if (starts[starts.length - 1] + CM_LEN < audio.length) starts.push(audio.length - CM_LEN);
    for (const s of starts) windows.push(audio.slice(s, s + CM_LEN));
  }
  const probs = [];
  for (const w of windows) {
    const out = await cmSession.run({ waveform: new ort.Tensor("float32", w, [1, CM_LEN]) });
    probs.push(out.probs.data[1]); // [spoof, bona fide]
  }
  return { bonafide: probs.reduce((a, b) => a + b, 0) / probs.length, windows: probs };
}

// ---------- dispatch (one task at a time) ----------
const TASKS = { asr, sv: speakerVerify, tts, cm: countermeasure };
let queue = Promise.resolve();
self.onmessage = (e) => {
  const { id, task, ...payload } = e.data;
  queue = queue.then(async () => {
    current = id;
    try {
      const result = await TASKS[task](payload);
      const transfer = result.audio ? [result.audio.buffer] : [];
      postMessage({ id, type: "result", result }, transfer);
    } catch (err) {
      postMessage({ id, type: "error", message: (err && err.message) || String(err) });
    }
  });
};
