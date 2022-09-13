/*
  MULTILA Compiler and Computer Architecture Infrastructure
  Copyright (c) 2022 by Andreas Schwenk, contact@multila.org
  Licensed by GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007
*/

import { Lexer } from '@multila/multila-lexer';
import { LexerToken, LexerTokenType } from '@multila/multila-lexer/lib/token';
import { LR1_Rule, LR1_RuleItemType } from './lr1rule';
import { LR1_State, LR1_StateItem } from './lr1state';
import { LR1_Table, LR1_TableEntry, LR1_TableRow } from './lr1table';

// TODO: shift-reduce conflicts
// TODO: reduce-reduce conflicts

/**
 * Error that may be thrown while table-construction or parsing.
 */
export class LR1Error extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'LR1Error';
  }
}

/**
 * LR1 parser generator and parser.
 */
export class LR1 {
  /**
   * list of production rules
   */
  private rules: LR1_Rule[] = [];
  /**
   * first set for each non-terminal of rules
   */
  private first: { [id: string]: Set<string> } = {};
  /**
   * states created while table creation
   */
  private states: LR1_State[] = [];
  /**
   * LR(1) table
   */
  private table: LR1_Table = null;
  /**
   * Callback functions that are automatically called after rule reduction (if
   * provided). Parameter "terminals" contains tokens for all terminal items
   * of a rule. The i-th element in list refers to the i-th terminal in the
   * right-hand side of a rule. Non-terminals are skipped while indexing.
   */
  private callBacks: { [id: string]: (terminals: LexerToken[]) => void } = {};

  public constructor() {
    //
  }

  /**
   * Gets the set of production rules.
   * @returns rules as list. The first rule represents the root rule.
   */
  public getRules(): LR1_Rule[] {
    return this.rules;
  }

  /**
   * Gets the first set, i.e. the FIRST-set of each non-terminal.
   * @returns first set
   */
  public getFirst(): { [id: string]: Set<string> } {
    return this.first;
  }

  /**
   * Gets the generated parse table.
   * @returns the parse table or null if it has not yet been generated
   */
  public getTable(): LR1_Table {
    return this.table;
  }

  /**
   * Add a callback method that is automatically called after reduction of a
   * production rule while parsing.
   * @param id identifier of the callback function
   * @param f implementation of the callback function
   */
  public addCallback(id: string, f: (terminals: LexerToken[]) => void): void {
    this.callBacks[id] = f;
  }

  /**
   * Parses production rules in the form "u = v1 v2 ... -> callback;",
   * specified in a small DSL. Grammar is as follows:
   *   rules = { rule };
   *   rule = ID "=" rhs { "|" rhs } ";";
   *   rhs = { item } [ "->" ID ];
   *   item = "INT" | "REAL" | "HEX" | "ID" | "STR" | ID | STR;
   * @param src rules defined in the DSL specified above
   */
  public parseRules(src: string): void {
    this.rules = [];
    const lexer = new Lexer();
    lexer.setTerminals(['->']);
    lexer.pushSource('LR1RULES', src);
    while (lexer.isNotEND()) {
      this.parseRule(lexer);
    }
  }
  private parseRule(lexer: Lexer): void {
    const lhs = lexer.ID();
    lexer.TER('=');
    this.parseRhs(lhs, lexer);
    while (lexer.isTER('|')) {
      lexer.next();
      this.parseRhs(lhs, lexer);
    }
    lexer.TER(';');
  }
  private parseRhs(lhs: string, lexer: Lexer): void {
    const r = this.addRule(lhs);
    while (lexer.isNotTER('|') && lexer.isNotTER(';') && lexer.isNotTER('->')) {
      this.parseItem(lexer, r);
    }
    if (lexer.isTER('->')) {
      lexer.next();
      r.callBackId = lexer.ID();
    }
  }
  private parseItem(lexer: Lexer, r: LR1_Rule): void {
    if (
      lexer.isTER('INT') ||
      lexer.isTER('REAL') ||
      lexer.isTER('HEX') ||
      lexer.isTER('ID') ||
      lexer.isTER('STR')
    ) {
      r.addTerminalItem(lexer.getToken().token);
      lexer.next();
    } else if (lexer.isID()) {
      const nonTerminal = lexer.ID();
      r.addNonTerminalItem(nonTerminal);
    } else if (lexer.isSTR()) {
      const terminal = lexer.STR();
      r.addTerminalItem(':' + terminal);
    } else {
      lexer.errorExpected([
        '"INT"',
        '"REAL"',
        '"HEX"',
        '"ID"',
        '"STR"',
        'ID',
        'STR',
      ]);
    }
  }

  /**
   * Create a new production rule.
   * @param lhs non-terminal id of the rule
   * @returns a new rule object
   */
  public addRule(lhs: string): LR1_Rule {
    const r = new LR1_Rule(lhs);
    this.rules.push(r);
    return r;
  }

  /**
   * Parse an input program according to the specified grammar.
   * Note: Method createTable must be called first!
   * @param lexer lexer instance with already pushed source code
   * @param verbose print verbose output
   * @returns this method may throw an LR1Error
   */
  public parse(lexer: Lexer, verbose = false): void {
    // check if we are ready to parse
    if (this.table == null) {
      throw new LR1Error('table not generated');
    }
    if (this.table.rows.length == 0) {
      throw new LR1Error('table has no rules');
    }
    // Parse stack that contains state numbers, terminals and non-terminals
    const stack: (LexerToken | string | number)[] = [];
    // Push the initial state to the stack
    stack.push(0);
    // Run until the accept-state. Stop on errors.
    for (;;) {
      if (verbose) this.printParseStack(stack);
      const state = stack[stack.length - 1] as number;
      const tk = lexer.getToken();
      // find action entry in the table
      let entry: LR1_TableEntry = null;
      if (
        tk.type === LexerTokenType.TER ||
        tk.type === LexerTokenType.DEL ||
        tk.type === LexerTokenType.ID
      ) {
        entry = this.table.rows[state].actionEntries[':' + tk.token];
        if (entry === undefined) entry = null;
      }
      if (entry == null) {
        entry = this.table.rows[state].actionEntries[tk.type];
      }
      if (entry == null) {
        lexer.error('unexpected token "' + tk.token + '"');
        // TODO: list expected token-types / token-value
      }
      // SHIFT the next input token
      if (entry.shift) {
        stack.push(tk);
        lexer.next();
        stack.push(entry.value); // push state
        if (verbose) console.log('shifted ' + tk.token);
      }
      // REDUCE the currently processed rule to a non-terminal
      else {
        // if we are reducing the root-rule, parsing is finished
        const rootRule = entry.value == 0;
        // get the rule that reduces the rightmost elements of the stack
        const rule = this.rules[entry.value];
        // pop N items from stack, with N the number of rule items;
        // we need factor 2 due to the state numbers
        const items = stack.splice(stack.length - 2 * rule.rhs.length);
        // call the callback method, if present
        if (rule.callBackId.length > 0) {
          if (rule.callBackId in this.callBacks == false) {
            lexer.error('UNIMPLEMENTED callback function ' + rule.callBackId);
          }
          // get terminal tokens for the caller
          const terminals: LexerToken[] = [];
          for (let i = 0; i < items.length >> 1; i++) {
            if (rule.rhs[i].type === LR1_RuleItemType.Terminal) {
              terminals.push(items[i * 2] as LexerToken);
            }
          }
          // call
          this.callBacks[rule.callBackId](terminals);
        }
        // stop if we are reducing the root rule
        if (rootRule) {
          if (lexer.isEND() == false) {
            // throw an error in case that the end token is not reached
            lexer.error('expected END');
          }
          if (verbose) {
            console.log('parsed successfully');
          }
          return;
        }
        // read the state number on top of stack
        const s = stack[stack.length - 1] as number;
        // let x be the non-terminal on the left-hand side of the rule.
        // push x onto the stack
        stack.push(rule.lhs);
        // get the state of x from the goto table an put it onto the stack
        stack.push(this.table.rows[s].gotoEntries[rule.lhs].value);
        if (verbose) {
          console.log(
            'reduced rule ' + rule.index + ' [' + rule.toString() + ']',
          );
        }
      }
    }
  }

  /**
   * prints the current parse stack
   * @param stack current parse stack
   */
  private printParseStack(stack: (LexerToken | string | number)[]): void {
    let s = 'stack: ';
    for (const item of stack) {
      if (typeof item === 'number' || typeof item === 'string') {
        s += item;
      } else {
        s += '"' + (item as LexerToken).token + '"';
      }
      s += ' ';
    }
    console.log(s);
  }

  /**
   * Calculate parsing table.
   * @returns parsing table
   */
  public calcTable(): LR1_Table {
    if (this.rules.length == 0) {
      throw new LR1Error('cannot calculate table without any production rule');
    }
    // check if all rules are valid
    // (a) get the entire set of non-terminals
    const nt = new Set<string>();
    for (const rule of this.rules) {
      nt.add(rule.lhs);
    }
    // (b) check each rule
    for (const rule of this.rules) {
      // are all non-terminals on the right-hand side of a rule defined?
      for (const item of rule.rhs) {
        if (item.type === LR1_RuleItemType.NonTerminal) {
          if (nt.has(item.value) == false) {
            throw new LR1Error(
              'rule [' +
                rule.toString() +
                '] uses undefined non-terminal ' +
                item.value,
            );
          }
        }
      }
    }
    // calculate the first set for each non-terminal
    this.calcFirst();
    // set an index number to each rule
    for (let i = 0; i < this.rules.length; i++) {
      this.rules[i].index = i;
    }
    // create an initial state with the root rule
    const state = new LR1_State(this);
    const item = new LR1_StateItem();
    item.lookAheadSet.add('END');
    item.pos = 0;
    item.rule = this.rules[0];
    state.addItem(item);
    // Q := yet unprocessed states; the initial state is yet unprocessed
    let Q: LR1_State[] = [state];
    // run until there are no remaining unprocessed states
    while (Q.length > 0) {
      // process one of the remaining states
      const q = Q.pop();
      // calculate CLOSURE for currently processed state
      const R = q.calcItemSet();
      // add state
      if (this.addState(q)) {
        // if the state was not present before, add its successor states
        // as yet unprocessed states
        Q = Q.concat(R);
      }
    }
    // finally create the parse table; its data is retrieved from the states
    this.table = new LR1_Table();
    // for each state: add a row to the table
    for (const state of this.states) {
      const row = new LR1_TableRow();
      this.table.rows.push(row);
      // state transitions define SHIFT-actions and GOTO-entries
      for (const outEdge of state.outEdges) {
        // crate a new entry and store the index of the destination state in it
        const entry = new LR1_TableEntry();
        entry.value = outEdge.dest.getIndex();
        if (outEdge.label.type === LR1_RuleItemType.Terminal) {
          entry.shift = true;
          if (outEdge.label.value in row.actionEntries) {
            // TODO
            const bp = 1337;
            process.exit(-1);
          }
          row.actionEntries[outEdge.label.value] = entry;
        } else {
          if (outEdge.label.value in row.gotoEntries) {
            // TODO
            const bp = 1337;
            process.exit(-1);
          }
          row.gotoEntries[outEdge.label.value] = entry;
        }
      }
      // reduction takes place, when the position of a rule is after its last
      // item
      const reduceEntries = state.calcReduceEntries();
      // create a REDUCE-action for each lookahead-terminal
      for (const terminal in reduceEntries) {
        const entry = new LR1_TableEntry();
        entry.shift = false; // reduce
        entry.value = reduceEntries[terminal].value;
        if (terminal in row.actionEntries) {
          // TODO
          const bp = 1337;
          process.exit(-1);
        }
        row.actionEntries[terminal] = entry;
      }
    }
    // return table
    return this.table;
  }

  /**
   * Calculates the first-set for each non-terminal.
   * The first set is the set of terminals that are parsed next:
   *   rule 'x = y ...;' -> first(x) = first(x) uu first(y);
   *   rule 'x = "z" ...;' -> first(x) = first(x) uu { "z" };
   * with non-terminals x and y, as well as terminal "z";
   * "uu" denotes the union operator.
   */
  private calcFirst(): void {
    for (const rule of this.rules) {
      if (rule.lhs in this.first == false)
        this.first[rule.lhs] = new Set<string>();
    }
    let changed = false;
    do {
      // run until no more changes occur
      changed = false;
      for (const rule of this.rules) {
        if (rule.rhs.length > 0) {
          const rhs0 = rule.rhs[0];
          // rule 'x = y ...;' -> first(x) = first(x) uu first(y);
          if (rhs0.type === LR1_RuleItemType.NonTerminal) {
            const n = this.first[rule.lhs].size;
            this.first[rule.lhs] = new Set<string>([
              ...this.first[rule.lhs],
              ...this.first[rhs0.value],
            ]);
            if (this.first[rule.lhs].size > n) {
              changed = true;
            }
          } else {
            // rule 'x = "y" ...;' -> first(x) = first(x) uu { "y" };
            if (this.first[rule.lhs].has(rhs0.value) == false) {
              changed = true;
            }
            this.first[rule.lhs].add(rhs0.value);
          }
        }
      }
    } while (changed);
  }

  /**
   * Adds a new state while the parsing table is created.
   * @param sNew the state to be added
   * @returns true, if the state has been added; false if an equal state is
   * already present
   */
  private addState(sNew: LR1_State): boolean {
    // check if there already is a state equal to sNew
    for (const s of this.states) {
      if (s.equal(sNew)) {
        // if we found a state equal to sNew, we still have to ensure that
        // the set of all in-edges to the sNew are also present in the existing
        // state
        for (const u of sNew.inEdges) {
          // set the destination vertex to the existing state
          u.dest = s;
          let found = false;
          // is the edge already present?
          for (const v of s.inEdges) {
            if (
              u.src == v.src &&
              u.dest == v.dest &&
              u.label.type === v.label.type &&
              u.label.value === v.label.value
            ) {
              found = true;
              break;
            }
          }
          // only add it, if it was NOT found
          if (!found) {
            s.inEdges.push(u);
          }
        }
        // false := the number of states did NOT increase
        return false;
      }
    }
    // if there is no state equal to sNew, create it
    sNew.setIndex(this.states.length);
    this.states.push(sNew);
    // true := the number of states increased
    return true;
  }

  /**
   * Stringifies the current object.
   * @returns stringified representation
   */
  public toString(): string {
    let s = 'LR1-rules: {\n';
    let i = 0;
    for (const rule of this.rules) {
      s += '' + i + ': ' + rule.toString() + '\n';
      i++;
    }
    s += '}\n';
    s += 'LR1-first: ';
    for (const id in this.first) {
      s += 'FIRST(' + id + ') = { ';
      for (const item of this.first[id]) {
        s += '"' + item + '", ';
      }
      if (s.endsWith(', ')) s = s.substring(0, s.length - 2);
      s += ' }, ';
    }
    s += '\n';
    s += 'LR1-STATES:\n';
    for (const state of this.states) {
      s += state.toString();
    }
    s += '\n';
    s += 'LR1-TABLE:\n';
    s += this.table == null ? '%' : this.table.toString();
    return s;
  }
}
