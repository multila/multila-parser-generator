/*
  MULTILA Compiler and Computer Architecture Infrastructure
  Copyright (c) 2022 by Andreas Schwenk, contact@multila.org
  Licensed by GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007
*/

import { LR1, LR1Error } from './lr1';
import { LR1_Rule, LR1_RuleItem, LR1_RuleItemType } from './lr1rule';
import { LR1_TableEntry } from './lr1table';

/**
 * Paring state (refer to LR(1) parsing textbooks).
 */
export class LR1_State {
  /**
   * index number of the state (labeling of the state graph; root-state has
   * index 0).
   */
  private index = -1;
  /**
   * CLOSURE_1 items of the state. ATTENTION: implemented as array; not as set.
   */
  private itemSet: LR1_StateItem[] = [];
  /**
   * reference to LR1 object
   */
  private lr1: LR1 = null;
  /**
   * outgoing edges of state transitions
   */
  outEdges: LR1_Edge[] = []; // TODO: private!
  /**
   * incoming edges of state transitions
   */
  inEdges: LR1_Edge[] = []; // TODO: private!

  public constructor(lr1: LR1) {
    this.lr1 = lr1;
  }

  public setIndex(i: number): void {
    this.index = i;
  }

  public getIndex(): number {
    return this.index;
  }

  /**
   * Compares a given state to the current state object
   * @param s state to be compared with
   * @returns true, if the given state is equal th the current state object.
   */
  public equal(s: LR1_State): boolean {
    const n = this.itemSet.length;
    // If the number of items in item set differs, states are obviously not
    // equal.
    if (n != s.itemSet.length) {
      return false;
    }
    // since the item set is implemented as arrays, we have to compare them
    // in two loops.
    for (let i = 0; i < n; i++) {
      let found = false;
      for (let j = 0; j < n; j++) {
        if (this.itemSet[i].equal(s.itemSet[j])) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  /**
   * Adds a new item if it is not yet present in the item set.
   * NOTE: items are said to be equal, if the rule and the current position are
   * equal. The lookahead set is updated such that the new lookahead-set is
   * constructed from the previous lookahead-set unified the lookahead-set of
   * the given item.
   * @param newItem The item to be added
   * @returns true, if the number of items increased; otherwise false
   */
  public addItem(newItem: LR1_StateItem): boolean {
    let found = false;
    for (const item of this.itemSet) {
      // only compare the position and the rule
      if (item.pos == newItem.pos && item.rule == newItem.rule) {
        found = true;
        // unify lookahead sets
        item.lookAheadSet = new Set<string>([
          ...item.lookAheadSet,
          ...newItem.lookAheadSet,
        ]);
        break;
      }
    }
    // add the item if it is not yet in the set
    if (!found) {
      this.itemSet.push(newItem);
      return true;
    }
    return false;
  }

  /**
   * Calculates CLOSURE_1 from an initial item set as follows:
   * Let a, b, c in (Sigma uu V)^* and let "." denote the current position.
   * For all items of the form [x -> a . y b, L],
   *   with rule [x -> a . y b] and lookahead set L,
   * add all production rules [y -> . c, FIRST(bL)] to the closure.
   * If only FIRST(bL) is different to existing items, than modify the
   * existing item where only FIRST differs by L := L uu FIRST(bL).
   * Run this procedure until no more changes occur.
   * This method also calculates and returns transitions to other states.
   * For these states, only the initial CLOSURE_1 is drawn, s.t. a recursive
   * calls construct the set of all states.
   * Transitions are calculated as follows: Determine the set of outgoing
   * terminals (called "t") and the set of outgoing non-terminals (called "nt").
   * These sets are constructed by the set of (non-)terminals at the current
   * position.
   * For each element of t and nt, an outgoing edge and a (temporary) destination
   * state is created.
   * For all items [x -> a . y b, L], add [x -> a y . b, L] to the set of
   * initial items of the appropriate destination state.
   * @returns destination states for the transitions outgoing from this state.
   */
  public calcItemSet(): LR1_State[] {
    const rules = this.lr1.getRules();
    const first = this.lr1.getFirst(); // first set
    // run until convergency
    let change = false;
    do {
      const n = this.itemSet.length;
      change = false;
      const newItems: LR1_StateItem[] = [];
      for (const item of this.itemSet) {
        if (
          item.pos < item.rule.rhs.length &&
          item.rule.rhs[item.pos].type === LR1_RuleItemType.NonTerminal
        ) {
          const y = item.rule.rhs[item.pos].value;
          for (const rule of rules) {
            if (rule.lhs === y) {
              const newItem = new LR1_StateItem();
              newItem.pos = 0;
              newItem.rule = rule;
              if (item.pos + 1 < item.rule.rhs.length) {
                const b = item.rule.rhs[item.pos + 1];
                const v = b.value;
                if (b.type === LR1_RuleItemType.Terminal) {
                  newItem.lookAheadSet.add(v);
                } else {
                  newItem.lookAheadSet = new Set<string>(first[v]);
                }
              } else {
                newItem.lookAheadSet = new Set<string>(item.lookAheadSet);
              }
              newItems.push(newItem);
            }
          }
        }
      }
      for (const item of newItems) {
        this.addItem(item);
      }
      if (this.itemSet.length > n) {
        change = true;
      }
    } while (change);
    // calculate successor items
    const t = new Set<string>(); // successor terminals
    const nt = new Set<string>(); // successor non-terminals
    for (const item of this.itemSet) {
      if (item.pos < item.rule.rhs.length) {
        const x = item.rule.rhs[item.pos];
        if (x.type === LR1_RuleItemType.Terminal) {
          t.add(x.value);
        } else {
          nt.add(x.value);
        }
      }
    }
    // create successor states (initial version only)
    const s: LR1_State[] = [];
    for (const ti of t) {
      const si = new LR1_State(this.lr1);
      s.push(si);
      const e = new LR1_Edge(this, si);
      e.label.type = LR1_RuleItemType.Terminal;
      e.label.value = ti;
      this.outEdges.push(e);
      si.inEdges.push(e);
      for (const item of this.itemSet) {
        if (item.pos < item.rule.rhs.length) {
          const x = item.rule.rhs[item.pos];
          if (x.type === LR1_RuleItemType.Terminal && x.value == ti) {
            const i = item.clone();
            i.pos++;
            if (si.addItem(i) == false) {
              // TODO
              const bp = 1337;
              process.exit(-1);
            }
          }
        }
      }
    }
    for (const nti of nt) {
      const si = new LR1_State(this.lr1);
      s.push(si);
      const e = new LR1_Edge(this, si);
      e.label.type = LR1_RuleItemType.NonTerminal;
      e.label.value = nti;
      this.outEdges.push(e);
      si.inEdges.push(e);
      for (const item of this.itemSet) {
        if (item.pos < item.rule.rhs.length) {
          const x = item.rule.rhs[item.pos];
          if (x.type === LR1_RuleItemType.NonTerminal && x.value == nti) {
            const i = item.clone();
            i.pos++;
            if (si.addItem(i) == false) {
              // TODO
              const bp = 1337;
              process.exit(-1);
            }
          }
        }
      }
    }
    return s;
  }

  /**
   * Calculate REDUCE entries for the parsing table.
   * For each item of the state, check if the current position is right to
   * the last item of the right-hand side. In this case, a reduce entry is
   * constructed for each item of the lookahead set of that item.
   * @returns dictionary of table entries for each item of the lookahead set
   */
  public calcReduceEntries(): { [terminalId: string]: LR1_TableEntry } {
    const rules = this.lr1.getRules();
    const entries: { [terminalId: string]: LR1_TableEntry } = {};
    for (const item of this.itemSet) {
      if (item.pos === item.rule.rhs.length) {
        for (const terminal of item.lookAheadSet) {
          const entry = new LR1_TableEntry();
          entry.value = item.rule.index;
          if (terminal in entries) {
            const r1 = entries[terminal].value;
            const r2 = entry.value;
            throw new LR1Error(
              'reduce/reduce conflict for rules ' +
                r1 +
                ' [' +
                rules[r1] +
                '] and ' +
                r2 +
                ' [' +
                rules[r2] +
                ']',
            );
          }
          entries[terminal] = entry;
        }
      }
    }
    return entries;
  }

  /**
   * Stringifies the state.
   * @returns stringified version of the state
   */
  public toString(): string {
    let s = 'state ' + this.index + ' = {\n';
    for (const item of this.itemSet) {
      s += '  ' + item.toString() + '\n';
    }
    s += '  inEdges = ';
    for (const edge of this.inEdges) {
      s +=
        edge.label.type === LR1_RuleItemType.Terminal
          ? '"' + edge.label.value + '"'
          : edge.label.value;
      s += ':' + edge.src.index + '->' + edge.dest.index;
      s += ', ';
    }
    s += '\n';
    s += '  outEdges = ';
    for (const edge of this.outEdges) {
      s +=
        edge.label.type === LR1_RuleItemType.Terminal
          ? '"' + edge.label.value + '"'
          : edge.label.value;
      s += ':' + edge.src.index + '->' + edge.dest.index;
      s += ', ';
    }
    s += '\n';
    s += '}\n';
    return s;
  }
}

/**
 * State item := item of CLOSURE_1.
 */
export class LR1_StateItem {
  /**
   * current position (referred to the items of the right-hand side)
   */
  pos = 0;
  /**
   * lookahead set := items after the right-most item of the rule.
   */
  lookAheadSet = new Set<string>();
  /**
   * reference to the rule
   */
  rule: LR1_Rule = null;

  /**
   * Checks if the given item is equal to the current item object.
   * @param i item that is compared to the current item object
   * @returns true, if the given item is equal to the present item object;
   * otherwise false
   */
  public equal(i: LR1_StateItem): boolean {
    if (this.pos != i.pos) return false;
    if (this.rule != i.rule) return false;
    if (this.compareLookAhead(i.lookAheadSet) == false) return false;
    return true;
  }

  /**
   * Clones the current item object
   * @returns clone of the current object
   */
  public clone(): LR1_StateItem {
    const c = new LR1_StateItem();
    c.pos = this.pos;
    c.lookAheadSet = new Set(this.lookAheadSet);
    c.rule = this.rule;
    return c;
  }

  /**
   * Compares a given lookahead set to the lookahead set of the current object.
   * @param l lookahead set to compare to
   * @returns true, if both sets are equal; otherwise false
   */
  public compareLookAhead(l: Set<string>): boolean {
    if (this.lookAheadSet.size != l.size) {
      return false;
    }
    for (const li of l) {
      if (this.lookAheadSet.has(li) == false) {
        return false;
      }
    }
    return true;
  }

  /**
   * Stringifies the state.
   * @returns stringified version of the state
   */
  public toString(): string {
    let s = '[' + this.rule.toString(this.pos) + ' { ';
    for (const l of this.lookAheadSet) {
      s += '"' + l.toString() + '", ';
    }
    s = s.substring(0, s.length - 2);
    s += ' }]';
    return s;
  }
}

/**
 * Directed edge (transition) between two states.
 */
export class LR1_Edge {
  /**
   * source state
   */
  src: LR1_State = null;
  /**
   * destination state
   */
  dest: LR1_State = null;
  /**
   * label of the transition (type and value of terminal or non-terminal)
   */
  label = new LR1_RuleItem();

  constructor(src: LR1_State, dest: LR1_State) {
    this.src = src;
    this.dest = dest;
  }
}
