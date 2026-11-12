/**
 * Indian Monopoly - Cryptographically Fair & Unbiased Dice Engine
 *
 * Implements rejection sampling using cryptographically secure random generators
 * (Node.js crypto.randomInt or Web Crypto API crypto.getRandomValues)
 * to eliminate modulo bias and guarantee an exact uniform distribution across [1..6].
 */

/**
 * Generates an unbiased random integer between 1 and 6 inclusive.
 * Uses rejection sampling on 8-bit unsigned integers to avoid any modulo bias:
 * 256 is not evenly divisible by 6 (256 % 6 = 4).
 * By rejecting raw byte values >= 252 (42 * 6), each outcome 1..6 has an exact
 * probability of 42 / 252 = 1/6 (~16.6667%).
 */
/**
 * Maps a single 8-bit unsigned integer (0..255) to a fair die outcome (1..6)
 * using rejection sampling.
 * Returns null if the byte is rejected (values 252..255) to eliminate modulo bias.
 */
export function mapByteToDie(byte: number): number | null {
  if (byte >= 252) {
    return null;
  }
  return (byte % 6) + 1;
}

/**
 * Generates an unbiased random integer between 1 and 6 inclusive.
 * Uses rejection sampling on 8-bit unsigned integers to avoid any modulo bias:
 * 256 is not evenly divisible by 6 (256 % 6 = 4).
 * By rejecting raw byte values >= 252 (42 * 6), each outcome 1..6 has an exact
 * probability of 42 / 252 = 1/6 (~16.6667%).
 *
 * Uses Web Crypto API crypto.getRandomValues() (with Node.js fallback) and
 * strictly throws an error if cryptographically secure randomness is unavailable.
 * Insecure Math.random fallback is completely eliminated.
 */
export function generateFairDie(): number {
  // Web Crypto API in browser or modern Node environment
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : typeof crypto !== 'undefined'
      ? crypto
      : null;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buffer = new Uint8Array(1);
    while (true) {
      cryptoObj.getRandomValues(buffer);
      const die = mapByteToDie(buffer[0]);
      if (die !== null) {
        return die;
      }
    }
  }

  // Node.js crypto fallback with rejection sampling
  if (
    typeof process !== 'undefined' &&
    process.versions &&
    process.versions.node
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCrypto = require('crypto');
      if (typeof nodeCrypto.randomBytes === 'function') {
        while (true) {
          const byte: number = nodeCrypto.randomBytes(1)[0];
          const die = mapByteToDie(byte);
          if (die !== null) {
            return die;
          }
        }
      }
    } catch {
      // Fallback below
    }
  }

  // If secure crypto is unavailable, fail clearly rather than using Math.random
  throw new Error('Cryptographically secure random number generator is unavailable.');
}

/**
 * Generates an authoritative pair of independent fair dice [d1, d2].
 * All 36 outcomes (1,1) to (6,6) have equal probability 1/36.
 */
export function generateFairDicePair(): [number, number] {
  return [generateFairDie(), generateFairDie()];
}

/**
 * Performs a Pearson's Chi-Square Goodness-of-Fit test on observed dice counts
 * against the expected uniform distribution.
 *
 * @param observed Array of counts for outcomes [1, 2, 3, 4, 5, 6]
 * @returns Chi-Square statistic and degrees of freedom (5)
 */
export function calculateChiSquareStatistic(observed: number[]): {
  chiSquare: number;
  degreesOfFreedom: number;
  expectedPerFace: number;
  criticalValue001: number; // 99% confidence (alpha = 0.01): 15.086
  criticalValue005: number; // 95% confidence (alpha = 0.05): 11.070
  isUniformAt001: boolean;
} {
  const totalRolls = observed.reduce((a, b) => a + b, 0);
  const expectedPerFace = totalRolls / 6;

  let chiSquare = 0;
  for (let i = 0; i < 6; i++) {
    const diff = observed[i] - expectedPerFace;
    chiSquare += (diff * diff) / expectedPerFace;
  }

  const criticalValue001 = 15.086;
  const criticalValue005 = 11.07;

  return {
    chiSquare,
    degreesOfFreedom: 5,
    expectedPerFace,
    criticalValue001,
    criticalValue005,
    isUniformAt001: chiSquare < criticalValue001,
  };
}

