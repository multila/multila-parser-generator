# multila-parser-generator

An LR(1) Parser Generator for the Web written in TypeScript.

> Copyright 2022 by Andreas Schwenk

> Licensed by GPLv3

> Multila Website: https://www.multila.org

> Personal Website: https://www.arts-and-sciences.com

> Mail: contact@compiler-construction.com

## Installation

```bash
npm install @multila/multila-parser-generator
```

## Example

The example program in this section defines a trivial interpreter for mathematical terms.
These terms consist of integer constants, operators `+` and `*`, as well as parentheses.
For example, `2 * (3+4)` is evaluated as `14`.

The grammar for this simple language can be written in BNF as follows:

```ebnf
term = add;
add = add "+" mul | mul;
mul = mul "*" unary | unary;
unary = INT | "(" add ")";
```

Interpretation can be handled by using a stack:

- Constant integer values are pushed on top of the stack.
- Binary operations, pop the two topmost values from the stack, add them (or multiply them respectively), and push the result onto the stack.

The following code (that can also be found in file `test/example.js`) implements the example. Copy it to [https://npm.runkit.com/](https://npm.runkit.com/) and run it!

```javascript
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
```

## Grammar of rule definitions

Grammar rules can be implemented programmatically or by a domain-specific language (DSL).

The following terminal types are supported:

- `INT` integer values, e.g. `42`.
- `REAL` real values, e.g. `3.14`, `.1337`
- `HEX` hexadecimal values, e.g. `0xAFFE`
- `STR` strings, e.g. `"Knuth"`
- `ID` identifiers, e.g. `pi`, `mp3`, `imaginary_value`

### Rule definition with API

- Create a new rule with method `addRule(id:string):Rule` from class `LR1`. The identifier is the non-terminal on the left-hand side of the rule.
- Use methods `addTerminalItem(t:string)` and `addNonTerminalItem(nt:string)` from class `Rule` to create items on the right-hand side of the rule. Use a preceding colon (`:`) to mark explicit terminal values. Otherwise use one of the terminal types from the table above.

> Example

```javascript
const parse = require('@multila/multila-parser-generator');
const lr1 = new parse.LR1();

// x = INT "a" y;
const rule = lr1.addRule('x');
rule.addTerminalItem('INT');
rule.addTerminalItem(':a'); // precede terminal with a colon
rule.addNonTerminalItem('y');
```

### Rule definition with DSL

> Grammar

```ebnf
rules = { rule };
rule = ID "=" rhs { "|" rhs } ";";
rhs = { item } [ "->" ID ];
item = "INT" | "REAL" | "HEX" | "ID" | "STR" | ID | STR;
```

> Example

See introduction example in this README file.

## Parsing

For parsing an input program, you may either use method `parse(lexer:Lexer)` of class `LR1` or write your own LR(1) parser.

Use method `getTable()` of class `LR1` to get the generated parse table. An stringified output for the example above is listed in the following:

```json
0: action={"INT"->S18, ":("->S5}; goto={add->19, mul->2, unary->1 }
1: action={"END"->R4, ":+"->R4, ":*"->R4}; goto={ }
2: action={":*"->S3, "END"->R2, ":+"->R2}; goto={ }
3: action={"INT"->S18, ":("->S5}; goto={unary->4 }
4: action={"END"->R3, ":+"->R3, ":*"->R3}; goto={ }
5: action={"INT"->S14, ":("->S10}; goto={add->16, mul->7, unary->6 }
6: action={":)"->R4, ":+"->R4, ":*"->R4}; goto={ }
7: action={":*"->S8, ":)"->R2, ":+"->R2}; goto={ }
8: action={"INT"->S14, ":("->S10}; goto={unary->9 }
9: action={":)"->R3, ":+"->R3, ":*"->R3}; goto={ }
10: action={"INT"->S14, ":("->S10}; goto={add->11, mul->7, unary->6 }
11: action={":)"->S15, ":+"->S12}; goto={ }
12: action={"INT"->S14, ":("->S10}; goto={mul->13, unary->6 }
13: action={":*"->S8, ":)"->R1, ":+"->R1}; goto={ }
14: action={":)"->R5, ":+"->R5, ":*"->R5}; goto={ }
15: action={":)"->R6, ":+"->R6, ":*"->R6}; goto={ }
16: action={":)"->S17, ":+"->S12}; goto={ }
17: action={"END"->R6, ":+"->R6, ":*"->R6}; goto={ }
18: action={"END"->R5, ":+"->R5, ":*"->R5}; goto={ }
19: action={":+"->S20, "END"->R0}; goto={ }
20: action={"INT"->S18, ":("->S5}; goto={mul->21, unary->1 }
21: action={":*"->S3, "END"->R1, ":+"->R1}; goto={ }
```
