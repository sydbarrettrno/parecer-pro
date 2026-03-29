export function normalizeText(input: string): string {
  const lower = input.toLowerCase().normalize("NFD");
  let out = "";
  for (const ch of lower) {
    const code = ch.charCodeAt(0);
    const isAccent = code >= 0x0300 && code <= 0x036f;
    out += isAccent ? "" : ch;
  }
  return out;
}

export function toTokenList(input: string): string[] {
  const separators = ["/", "\\", "-", "_", ".", "(", ")", "[", "]", ",", ";", ":"];
  let base = normalizeText(input);
  for (const sep of separators) base = base.split(sep).join(" ");
  return base
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function hasToken(tokens: string[], expected: string): boolean {
  return tokens.includes(normalizeText(expected));
}

export function hasAnyToken(tokens: string[], expected: string[]): boolean {
  return expected.some((item) => hasToken(tokens, item));
}

export function hasAnyFragment(input: string, fragments: string[]): boolean {
  const normalized = normalizeText(input);
  return fragments.some((fragment) => normalized.includes(normalizeText(fragment)));
}
