/*
  MULTILA Compiler and Computer Architecture Infrastructure
  Copyright (c) 2022 by Andreas Schwenk, contact@multila.org
  Licensed by GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007
*/

import { Lexer } from '@multila/multila-lexer';
import { LexerToken } from '@multila/multila-lexer/lib/token';

import { LR1 } from '../src/lr1';
import { LR1_Rule } from '../src/lr1rule';

const lr1 = new LR1();

lr1.parseRules(`
z = s;
s = s "b";
s = "b" a "a";
a = "a" s "c";
a = "a";
//a = "a" s "b";
a = "a" s INT -> blub;
`);

/*let r: LR1_Rule;
//G z = s;
r = lr1.addRule('z');
r.addNonTerminalItem('s');
//G s = s "b";
r = lr1.addRule('s');
r.addNonTerminalItem('s');
r.addTerminalItem(':b');
//G s = "b" a "a";
r = lr1.addRule('s');
r.addTerminalItem(':b');
r.addNonTerminalItem('a');
r.addTerminalItem(':a');
//G a = "a" s "c";
r = lr1.addRule('a');
r.addTerminalItem(':a');
r.addNonTerminalItem('s');
r.addTerminalItem(':c');
//G a = "a";
r = lr1.addRule('a');
r.addTerminalItem(':a');
//G a = "a" s "b";
r = lr1.addRule('a');
r.addTerminalItem(':a');
r.addNonTerminalItem('s');
r.addTerminalItem(':b');*/

lr1.calcTable();
console.log(lr1.toString());

lr1.addCallback('blub', function (t: LexerToken[]): void {
  console.log('blub ' + t[1].value);
});

const src = 'b a b a a 42 a';

const lexer = new Lexer();
lexer.pushSource('$', src);
const verbose = true;
lr1.parse(lexer, verbose);
