export type Random = {
  next(): number;
  integer(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
};

export function createRandom(seed: number): Random {
  let state = seed >>> 0;

  function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  }

  return {
    next,
    integer(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick(items) {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty array.");
      }

      return items[Math.floor(next() * items.length)]!;
    },
  };
}

