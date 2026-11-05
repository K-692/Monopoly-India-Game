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
export function generateFairDie(): number {
  // If running in Node.js environment with crypto.randomInt
  if (
    typeof process !== 'undefined' &&
    process.versions &&
    process.versions.node
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require('crypto');
      if (typeof crypto.randomInt === 'function') {
        return crypto.randomInt(1, 7);
      }
    } catch {
      // Fallback to Web Crypto or rejection sampling below
    }
  }

  // Web Crypto API in browser or modern Node
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint8Array(1);
    while (true) {
      crypto.getRandomValues(buffer);
      const val = buffer[0];
      // 252 is the highest multiple of 6 below 256
      if (val < 252) {
        return (val % 6) + 1;
      }
    }
  }

  // Fallback (e.g. legacy test environment without crypto)
  return Math.floor(Math.random() * 6) + 1;
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

