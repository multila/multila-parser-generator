/*
  MULTILA Compiler and Computer Architecture Infrastructure
  Copyright (c) 2022 by Andreas Schwenk, contact@multila.org
  Licensed by GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007
*/

/**
 * Table with ACTIONs and GOTOs that can be used for a bottom-up parser of
 * type LR1.
 */
export class LR1_Table {
  /**
   * Rows of the table (one row for each state).
   */
  rows: LR1_TableRow[] = [];

  /**
   * Stringify table.
   * @returns stringified version
   */
  public toString(): string {
    let s = '';
    let i = 0;
    for (const row of this.rows) {
      s += '' + i + ': ' + row.toString() + '\n';
      i++;
    }
    return s;
  }
}

/**
 * Row of the parse table.
 */
export class LR1_TableRow {
  /**
   * ACTION entries.
   */
  actionEntries: { [terminal: string]: LR1_TableEntry } = {};
  /**
   * GOTO entries.
   */
  gotoEntries: { [nonTerminal: string]: LR1_TableEntry } = {};

  /**
   * Stringify table row.
   * @returns stringified version
   */
  public toString(): string {
    let s = 'action={';
    let a = '';
    for (const terminal in this.actionEntries) {
      const action = this.actionEntries[terminal];
      a += '"' + terminal + '"->';
      a += action.shift ? 'S' : 'R';
      a += action.value;
      a += ', ';
    }
    s += a.substring(0, a.length - 2) + '}; goto={';
    let j = '';
    for (const nonTerminal in this.gotoEntries) {
      const goto = this.gotoEntries[nonTerminal];
      j += nonTerminal + '->';
      j += goto.value;
      j += ', ';
    }
    s += j.substring(0, j.length - 2) + ' }';
    return s;
  }
}

/**
 * Table entry.
 * Reduce: rule index, shift|goto: successor state
 */
export class LR1_TableEntry {
  shift = true; // false := reduce
  value = -1;
}
