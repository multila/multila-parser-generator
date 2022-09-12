/*
  MULTILA Compiler and Computer Architecture Infrastructure
  Copyright (c) 2022 by Andreas Schwenk, contact@multila.org
  Licensed by GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007
*/

/**
 * production rule
 */
export class LR1_Rule {
  /**
   * index of the current rule
   */
  index = -1;
  /**
   * ID of the non-terminal on the left-hand side
   */
  lhs = '';
  /**
   * items of the right-hand side of the rule
   */
  rhs: LR1_RuleItem[] = [];
  /**
   * (optional) identifier of a function that is called after reduction of rule.
   */
  callBackId = '';

  /**
   * Creates a new rule.
   * @param lhs non-terminal of the left-hand side of the rule
   */
  constructor(lhs = '') {
    this.lhs = lhs;
  }

  /**
   * Adds a new terminal item to the right-hand side of the rule.
   * @param s 'INT' for integer constant, 'REAL' for real valued constant,
   * 'HEX' for hexadecimal values, 'ID' for identifier', 'STR' for a string,
   * ':TER' for a terminal (with TER an arbitrary string)
   */
  addTerminalItem(s: string): void {
    const t = new LR1_RuleItem();
    t.type = LR1_RuleItemType.Terminal;
    t.value = s;
    this.rhs.push(t);
  }

  /**
   * Adds a new non-terminal item to the right-hand side of the rule.
   * @param s identifier of the non-terminal
   */
  addNonTerminalItem(s: string): void {
    const nt = new LR1_RuleItem();
    nt.type = LR1_RuleItemType.NonTerminal;
    nt.value = s;
    this.rhs.push(nt);
  }

  /**
   * Stringify rule.
   * @param dotPos (optionally) writes '.' after the i-th item of the right-hand
   * side of the rule
   * @returns stringified rule
   */
  toString(dotPos = -1): string {
    let s = this.lhs + ' = ';
    for (let i = 0; i < this.rhs.length; i++) {
      const item = this.rhs[i];
      if (i == dotPos) s += '. ';
      s += item.toString() + ' ';
    }
    if (this.rhs.length == dotPos) s += '. ';
    s = s.trim();
    s += ';';
    return s;
  }
}

/**
 * type of rule items
 */
export enum LR1_RuleItemType {
  Terminal = 'T',
  NonTerminal = 'NT',
}

/**
 * rule item
 */
export class LR1_RuleItem {
  /**
   * type
   */
  type: LR1_RuleItemType;
  /**
   * value
   */
  value = '';

  /**
   * Stringify item.
   * @returns stringified item
   */
  toString(): string {
    let s = this.value;
    if (this.type === LR1_RuleItemType.Terminal) {
      s = '"' + s + '"';
    }
    return s;
  }
}
