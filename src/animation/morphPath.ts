const PATH_NUMBER_REGEX = /-?\d*\.?\d+/g;

export function parsePath(d: string): number[] {
  const matches = d.match(PATH_NUMBER_REGEX);

  if (!matches) {
    return [];
  }

  return matches.map((value) => Number(value));
}

export function morphPath(a: string, b: string, t: number): string {
  const from = parsePath(a);
  const to = parsePath(b);

  if (from.length !== to.length) {
    throw new Error(
      `Cannot morph paths with different numeric token counts: ${from.length} !== ${to.length}`,
    );
  }

  let index = 0;

  return a.replace(PATH_NUMBER_REGEX, () => {
    const start = from[index];
    const end = to[index];
    const value = start * (1 - t) + end * t;
    index += 1;
    return Number(value.toFixed(4)).toString();
  });
}
