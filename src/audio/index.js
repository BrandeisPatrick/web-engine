// Audio layer: context/mixer bus, synth voices, positional emitters, ambience, vehicle synth, and the sound kit (named
// sounds rendered in plain JS, a voice policy, footsteps, a measured self-test).
export { AudioBus, DEFAULT_BUSES, SAFE_MASTER, safeClipCurve } from './AudioBus.js';
export { noiseBuffer, loopSource, makeFilter, makeGain, makeShaper, softClipCurve, chain as audioChain, setParam, NoiseVoice, OscStack, LFO, Envelope, playTone, playNoiseBurst } from './Synth.js';
export { PositionalAudio, AudioListener3D, Emitter as AudioEmitter } from './Positional.js';
export { CityAmbience } from './Ambience.js';
export { VehicleAudio } from './VehicleAudio.js';
export { registerAudioLoader, SamplePlayer } from './Samples.js';
/** @typedef {import('./VehicleAudio.js').VehicleAudioState} VehicleAudioState  what VehicleAudio.update reads */
export { SoundBank, INERT_VOICE } from './SoundBank.js';
export { SOUND_PRESETS, PRESET_SAMPLE_RATE, renderSound, renderPreset } from './presets.js';
export { VoicePool } from './VoicePool.js';
export { Footsteps } from './Footsteps.js';
export { audioSelfTest, analyseMix, MIX_LIMITS } from './selfTest.js';
export { encodeWav } from './dsp.js';
/** The DSP kit the presets render with (rng, noise, biquad, envelope, glide, modes, crackle, loopify, measure, ...). */
export * as dsp from './dsp.js';
/** @typedef {import('./presets.js').SoundPreset} SoundPreset  a named sound: data plus a render function */
/** @typedef {import('./SoundBank.js').SoundVoice} SoundVoice  what SoundBank.play returns */
/** @typedef {import('./SoundBank.js').LoopHandle} LoopHandle  what SoundBank.loop returns */
/** @typedef {import('./selfTest.js').SelfTestReport} SelfTestReport  what audioSelfTest resolves to */
