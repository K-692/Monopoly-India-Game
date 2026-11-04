import '@testing-library/jest-dom';

// Mock Web Audio API for headless Vitest runs
class MockAudioContext {
  state = 'running';
  sampleRate = 44100;
  currentTime = 0;

  createOscillator() {
    return {
      type: 'sine',
      frequency: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
      },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }

  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
      },
      connect: () => {},
    };
  }

  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }

  createBuffer() {
    return {
      getChannelData: () => new Float32Array(100),
    };
  }

  get destination() {
    return {};
  }

  resume() {
    return Promise.resolve();
  }
}

// Attach to global window
if (typeof window !== 'undefined') {
  (window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext;
  (window as unknown as { webkitAudioContext: typeof MockAudioContext }).webkitAudioContext = MockAudioContext;
}

