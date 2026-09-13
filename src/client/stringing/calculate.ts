export function calculate(input: string): number {
 const source = input.trim().replace(/^=/, "").replace(/\s+/g, "");
 if (!source || source.length > 200) throw new Error("Enter a number or calculation.");
 let at = 0;
 function atom(): number {
  if (source[at] === "+" || source[at] === "-") { const sign = source[at++]; return (sign === "-" ? -1 : 1) * atom(); }
  if (source[at] === "(") { at++; const value = sum(); if (source[at++] !== ")") throw new Error("Check the brackets."); return value; }
  const match = source.slice(at).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
  if (!match) throw new Error("Enter a valid calculation.");
  at += match[0].length; return Number(match[0]);
 }
 function product(): number { let value = atom(); while (source[at] === "*" || source[at] === "/") { const op = source[at++], next = atom(); value = op === "*" ? value * next : value / next; } return value; }
 function sum(): number { let value = product(); while (source[at] === "+" || source[at] === "-") { const op = source[at++], next = product(); value = op === "+" ? value + next : value - next; } return value; }
 const value = sum();
 if (at !== source.length || !Number.isFinite(value)) throw new Error("Enter a valid calculation (no division by zero).");
 return Number(value.toFixed(10));
}
