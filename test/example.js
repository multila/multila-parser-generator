/*
  MULTILA Compiler and Computer Architecture Infrastructure
  Copyright (c) 2022 by Andreas Schwenk, contact@multila.org
  Licensed by GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007
*/

// Import dependencies
var lex = require('@multila/multila-lexer');
const parse = require('@multila/multila-parser-generator');

// Define production rules for bottom-up parsing.
// The identifier right to "->" defines the name of a callback function that
// is called after reduction of the rule.
// The first rule is also called root-rule.
// Instead of using the or operator "|", you may write rules also individually.
const rulesSrc = `
term = add;
add = add "+" mul -> callbackAdd | mul;
mul = mul "*" unary -> callbackMultiply | unary;
unary = INT -> callbackConst | "(" add ")";
`;

// Create an instance of parser the generator and parse rules
const lr1 = new parse.LR1();
lr1.parseRules(rulesSrc);
const table = lr1.calcTable();
console.log(table.toString());

// Define functions that are called after the reduction of rules.
// The parameter is an array of objects of type LexerToken.

const stack = []; // stack of numbers for interpretation

lr1.addCallback('callbackConst', function (terminals) {
  // push a constant (integral) value to the stack
  stack.push(terminals[0].value);
});

lr1.addCallback('callbackMultiply', function () {
  // pop two values from the stack, multiply them and put them
  // back onto the stack.
  const o2 = stack.pop();
  const o1 = stack.pop();
  stack.push(o1 * o2);
});

lr1.addCallback('callbackAdd', function () {
  // pop two values from the stack, add them and put them
  // back onto the stack.
  const o2 = stack.pop();
  const o1 = stack.pop();
  stack.push(o1 + o2);
});

// Source code to be parsed and interpreted.
const src = '2 * (3+4)';
const lexer = new lex.Lexer();
lexer.pushSource('', src);

try {
  // Parse
  lr1.parse(lexer);
  // Print the result (2 * (3+4) = 14)
  console.log('result = ' + stack[0]);
} catch (e) {
  console.log('Error:' + e);
}
