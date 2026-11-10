/**
 * An agent's reply → the few plain words worth singing: no code, no markup, no paths.
 */
import { numberWords } from "./score.ts";

export interface CleanOptions {
  /** stop after about this many words (at a sentence end when one is near) */
  maxWords: number;
}

/** Markdown and code out, prose in: letters, apostrophes and , . ; : ! ? only. */
export function plainText(md: string): string {
  let t = md.replace(/\r/g, "");
  t = t.replace(/```[\s\S]*?(```|$)/g, " ").replace(/~~~[\s\S]*?(~~~|$)/g, " "); // fenced code
  t = t.replace(/<[^>\n]{1,200}>/g, " "); // html tags
  t = t.replace(/^\s*\|.*\|\s*$/gm, " "); // table rows
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"); // images, links
  t = t.replace(/\bhttps?:\/\/\S+/g, " ");
  // inline code: a plain word stays, anything code-like goes
  t = t.replace(/`([^`\n]*)`/g, (_m, c: string) => (/^[A-Za-z][A-Za-z' ]*$/.test(c) ? c : " "));
  t = t.replace(/(^|\s)[~.]?\/?(?:[\w.@-]+\/)+[\w.@-]*/g, "$1 "); // paths
  t = t.replace(/\b[\w-]+\.(?:ts|tsx|js|jsx|mjs|json|md|rs|py|toml|yaml|yml|html|css|sh|txt|lock|wasm)\b/g, " "); // file names
  t = t.replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, "$1."); // headings end a phrase
  t = t.replace(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/gm, "$1."); // list items too
  t = t.replace(/^\s*>\s?/gm, "");
  t = t.replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, "$1");
  t = t.replace(/&/g, " and ").replace(/%/g, " percent ").replace(/\+/g, " plus ").replace(/=/g, " is ");
  t = t.replace(/(\d),(?=\d{3}\b)/g, "$1");
  t = t.replace(/\d+(\.\d+)?/g, (d) => ` ${numberWords(Number(d))} `);
  t = t.replace(/[—–]/g, ", ").replace(/\n{2,}/g, ". ").replace(/\n/g, " ");
  // camelCase and snake_case read as words
  t = t.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  t = t.replace(/[’‘]/g, "'").replace(/[^A-Za-z' .,;:!?]/g, " ");
  t = t.replace(/(^|\s)'+|'+(?=\s|$|[.,;:!?])/g, "$1"); // quote marks, not apostrophes
  t = t.replace(/\s+([.,;:!?])/g, "$1").replace(/([.,;:!?])(?:\s*[.,;:!?])+/g, "$1").replace(/\s+/g, " ").trim();
  return t.replace(/^[.,;:!?\s]+/, "");
}

/** The first sentences of `text`, up to about `maxWords` words. */
export function excerpt(text: string, { maxWords }: CleanOptions): string {
  const sentences = text.match(/[^.!?]+[.!?]?/g) ?? [];
  const out: string[] = [];
  let n = 0;
  for (const raw of sentences) {
    const sen = raw.trim();
    if (!/[A-Za-z]/.test(sen)) continue;
    const words = sen.split(/\s+/);
    if (n + words.length > maxWords) {
      if (!out.length) {
        // one long sentence: stop at its last clause that fits, when that keeps most of the words
        let cut = words.slice(0, maxWords);
        const clause = cut.findLastIndex((w, i) => i < cut.length - 1 && /[,;:]$/.test(w));
        if (clause + 1 >= maxWords / 2) cut = cut.slice(0, clause + 1);
        out.push(cut.join(" ").replace(/[,;:]$/, "") + ".");
      }
      break;
    }
    out.push(/[.!?]$/.test(sen) ? sen : sen + ".");
    n += words.length;
  }
  return out.join(" ");
}

export function singable(md: string, opts: CleanOptions = { maxWords: 28 }): string {
  return excerpt(plainText(md), opts);
}
