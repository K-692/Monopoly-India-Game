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
// Polyfill / normalize localStorage for Node 22+ jsdom test runner
const memoryStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => memoryStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    memoryStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete memoryStorage[key];
  },
  clear: () => {
    for (const k of Object.keys(memoryStorage)) delete memoryStorage[k];
  },
  get length() {
    return Object.keys(memoryStorage).length;
  },
  key: (index: number) => Object.keys(memoryStorage)[index] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

if (typeof window !== 'undefined') {
  (window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext;
  (window as unknown as { webkitAudioContext: typeof MockAudioContext }).webkitAudioContext = MockAudioContext;
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
}

