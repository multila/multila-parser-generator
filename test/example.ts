/*
  MULTILA Compiler and Computer Architecture Infrastructure
  Copyright (c) 2022 by Andreas Schwenk, contact@multila.org
  Licensed by GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007
*/

// semantically equal to example.js

import { Lexer } from '@multila/multila-lexer';
import { LexerToken } from '@multila/multila-lexer/lib/token';

import { LR1 } from '../src/lr1';

const rulesSrc = `
term = add;
add = add "+" mul -> callbackAdd | mul;
mul = mul "*" unary -> callbackMultiply | unary;
unary = INT -> callbackConst | "(" add ")";
`;
const lr1 = new LR1();
lr1.parseRules(rulesSrc);
const table = lr1.calcTable();
console.log(table.toString());

const stack: number[] = [];

lr1.addCallback('callbackConst', function (t: LexerToken[]): void {
  stack.push(t[0].value);
});

lr1.addCallback('callbackMultiply', function (): void {
  const o2 = stack.pop();
  const o1 = stack.pop();
  stack.push(o1 * o2);
});

lr1.addCallback('callbackAdd', function (): void {
  const o2 = stack.pop();
  const o1 = stack.pop();
  stack.push(o1 + o2);
});

const src = '2 * (3+4)';

const lexer = new Lexer();
lexer.pushSource('', src);
lr1.parse(lexer);

console.log('result = ' + stack[0]);
