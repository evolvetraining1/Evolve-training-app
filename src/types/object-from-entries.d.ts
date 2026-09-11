declare global {
  interface ObjectConstructor {
    fromEntries(
      entries: Array<readonly [PropertyKey, string] | null>
    ): Record<string, string>;
  }
}

export {};
