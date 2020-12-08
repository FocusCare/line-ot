export type RetainOperation = number;
export type InsertOperation = string[];
export type DeleteOperation = number;

export type Operation = RetainOperation | InsertOperation | DeleteOperation;

export const CHANGE_LINE_CHAR = '\n';

class LineOT {
  ops: Operation[] = [];

  baseLineCounts: number = 0;

  targetLineCounts: number = 0;

  constructor(ops?: Operation[]) {
    if (ops && ops.length > 0) {
      this.fromJSON(ops);
    }
  }

  isRetain = (op: Operation) => {
    return typeof op === 'number' && op > 0;
  };

  isInsert = (op: Operation) => {
    // tslint:disable-next-line: strict-type-predicates
    return op instanceof Array && op.every(o => typeof o === 'string');
  };

  isDelete = (op: Operation) => {
    return typeof op === 'number' && op < 0;
  };

  retain = (n: RetainOperation) => {
    // tslint:disable-next-line: strict-type-predicates
    if (typeof n !== 'number') {
      throw new Error('retain expects an integer');
    }
    if (n === 0) {
      return this;
    }
    this.baseLineCounts += n;
    this.targetLineCounts += n;
    const beforeOp = this.ops[this.ops.length - 1];

    if (this.isRetain(beforeOp)) {
      // 操作符合并逻辑
      // retain(1),retain(1) => retain(2)
      this.ops[this.ops.length - 1] = (beforeOp as number) + n;
    } else {
      this.ops.push(n);
    }
    return this;
  };

  insert = (strList: InsertOperation) => {
    if (!(strList instanceof Array)) {
      throw new Error('insert expects an array');
    }
    if (strList.length === 0) {
      return this;
    }
    // tslint:disable-next-line: strict-type-predicates
    if (!strList.every(s => typeof s === 'string')) {
      throw new Error('insert item expects string');
    }
    this.targetLineCounts += strList.length;
    const ops = this.ops;
    const beforeOp = ops[ops.length - 1];
    if (this.isInsert(beforeOp)) {
      // Merge insert op.
      ops[ops.length - 1] = (beforeOp as InsertOperation).concat(strList);
    } else if (this.isDelete(beforeOp)) {
      // It doesn't matter when an operation is applied whether the operation
      // is delete(3), insert("something") or insert("something"), delete(3).
      // Here we enforce that in this case, the insert op always comes first.
      // This makes all operations that have the same effect when applied to
      // a document of the right length equal in respect to the `equals` method.
      if (this.isInsert(ops[ops.length - 2])) {
        ops[ops.length - 2] = (ops[ops.length - 2] as InsertOperation).concat(strList);
      } else {
        ops[ops.length] = ops[ops.length - 1];
        ops[ops.length - 2] = strList;
      }
    } else {
      ops.push(strList);
    }
    return this;
  };

  delete = (n: DeleteOperation) => {
    // tslint:disable-next-line: strict-type-predicates
    if (typeof n !== 'number') {
      throw new Error('delete expects an integer or a string');
    }
    if (n === 0) {
      return this;
    }
    if (n > 0) {
      n = -n;
    }
    this.baseLineCounts -= n;
    const ops = this.ops;

    const beforeOp = ops[ops.length - 1];

    if (this.isDelete(beforeOp)) {
      this.ops[this.ops.length - 1] = (beforeOp as number) + n;
    } else {
      this.ops.push(n);
    }
    return this;
  };

  isNoop = (): boolean => {
    return this.ops.length === 0 || (this.ops.length === 1 && this.isRetain(this.ops[0]));
  };

  toJSON = () => {
    return this.ops;
  };

  toString = () => {
    return JSON.stringify(this.toJSON());
  };

  fromJSON = (ops: Operation[]) => {
    return ops.map(op => {
      if (this.isRetain(op)) {
        this.retain(op as RetainOperation);
      } else if (this.isInsert(op)) {
        this.insert(op as InsertOperation);
      } else if (this.isDelete(op)) {
        this['delete'](op as DeleteOperation);
      } else {
        throw new Error('unknown operation: ' + JSON.stringify(op));
      }
    });
  };

  apply = (file: string) => {
    const lines = file ? file.split(CHANGE_LINE_CHAR) : [];

    if (lines.length !== this.baseLineCounts) {
      throw new Error("The operation's base line counts must be equal to the file's line counts.");
    }

    let resultFile: string[] = [];
    let indexOfLines = 0;
    this.ops.forEach(op => {
      if (this.isRetain(op)) {
        if (indexOfLines + (op as RetainOperation) > lines.length) {
          throw new Error("Operation can't retain more line counts than are left in the file.");
        }
        const endIndex = indexOfLines + (op as RetainOperation);
        resultFile = resultFile.concat(lines.slice(indexOfLines, endIndex));
        indexOfLines = endIndex;
      } else if (this.isInsert(op)) {
        resultFile = resultFile.concat(op as InsertOperation);
      } else {
        // delete op
        indexOfLines -= op as DeleteOperation;
      }
    });

    return resultFile.join(CHANGE_LINE_CHAR);
  };

  // Compose merges two consecutive operations into one operation, that
  // preserves the changes of both. Or, in other words, for each input string S
  // and a pair of consecutive operations A and B,
  // apply(apply(S, A), B) = apply(S, compose(A, B)) must hold.
  compose = (operation2: LineOT) => {
    const operation1 = this;
    if (operation1.targetLineCounts !== operation2.baseLineCounts) {
      throw new Error(
        'The base line counts of the second operation has to be the target line counts of the first operation',
      );
    }

    const { isInsert, isRetain, isDelete } = operation1;
    const operation = new LineOT(); // the combined operation
    const ops1 = operation1.ops;
    const ops2 = operation2.ops; // for fast access
    let i1 = 0;
    let i2 = 0; // current index into ops1 respectively ops2
    let op1 = ops1[i1++];
    let op2 = ops2[i2++]; // current ops
    while (true) {
      // Dispatch on the type of op1 and op2
      // tslint:disable-next-line: strict-type-predicates
      if (typeof op1 === 'undefined' && typeof op2 === 'undefined') {
        // end condition: both ops1 and ops2 have been processed
        break;
      }

      if (isDelete(op1)) {
        operation['delete'](op1 as DeleteOperation);
        op1 = ops1[i1++];
        continue;
      }
      if (isInsert(op2)) {
        operation.insert(op2 as InsertOperation);
        op2 = ops2[i2++];
        continue;
      }

      // tslint:disable-next-line: strict-type-predicates
      if (typeof op1 === 'undefined') {
        throw new Error('Cannot compose operations: first operation is too short.');
      }
      // tslint:disable-next-line: strict-type-predicates
      if (typeof op2 === 'undefined') {
        throw new Error('Cannot compose operations: first operation is too long.');
      }

      if (isRetain(op1) && isRetain(op2)) {
        if (op1 > op2) {
          operation.retain(op2 as RetainOperation);
          op1 = (op1 as RetainOperation) - (op2 as RetainOperation);
          op2 = ops2[i2++];
        } else if (op1 === op2) {
          operation.retain(op1 as RetainOperation);
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          operation.retain(op1 as RetainOperation);
          op2 = (op2 as RetainOperation) - (op1 as RetainOperation);
          op1 = ops1[i1++];
        }
      } else if (isInsert(op1) && isDelete(op2)) {
        if ((op1 as InsertOperation).length > -op2) {
          op1 = (op1 as InsertOperation).slice(-op2);
          op2 = ops2[i2++];
        } else if ((op1 as InsertOperation).length === -op2) {
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          op2 = (op2 as DeleteOperation) + (op1 as InsertOperation).length;
          op1 = ops1[i1++];
        }
      } else if (isInsert(op1) && isRetain(op2)) {
        if ((op1 as InsertOperation).length > op2) {
          operation.insert((op1 as InsertOperation).slice(0, op2 as RetainOperation));
          op1 = (op1 as InsertOperation).slice(op2 as RetainOperation);
          op2 = ops2[i2++];
        } else if ((op1 as InsertOperation).length === op2) {
          operation.insert(op1 as InsertOperation);
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          operation.insert(op1 as InsertOperation);
          op2 = (op2 as RetainOperation) - (op1 as InsertOperation).length;
          op1 = ops1[i1++];
        }
      } else if (isRetain(op1) && isDelete(op2)) {
        if (op1 > -op2) {
          operation['delete'](op2 as DeleteOperation);
          op1 = (op1 as RetainOperation) + (op2 as DeleteOperation);
          op2 = ops2[i2++];
        } else if (op1 === -op2) {
          operation['delete'](op2 as DeleteOperation);
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          operation['delete'](op1 as DeleteOperation);
          op2 = (op2 as DeleteOperation) + (op1 as RetainOperation);
          op1 = ops1[i1++];
        }
      } else {
        throw new Error(
          "This shouldn't happen: op1: " + JSON.stringify(op1) + ', op2: ' + JSON.stringify(op2),
        );
      }
    }
    return operation;
  };

  // Transform takes two operations A and B that happened concurrently and
  // produces two operations A' and B' (in an array) such that
  // `apply(apply(S, A), B') = apply(apply(S, B), A')`. This function is the
  // heart of OT.
  static transform = (operation1: LineOT, operation2: LineOT) => {
    if (operation1.baseLineCounts !== operation2.baseLineCounts) {
      throw new Error('Both operations have to have the same line counts');
    }

    const { isInsert, isRetain, isDelete } = operation1;

    const operation1prime = new LineOT();
    const operation2prime = new LineOT();
    const ops1 = operation1.ops;
    const ops2 = operation2.ops;
    let i1 = 0;
    let i2 = 0;
    let op1 = ops1[i1++];
    let op2 = ops2[i2++];
    while (true) {
      // At every iteration of the loop, the imaginary cursor that both
      // operation1 and operation2 have that operates on the input string must
      // have the same position in the input string.

      // tslint:disable-next-line: strict-type-predicates
      if (typeof op1 === 'undefined' && typeof op2 === 'undefined') {
        // end condition: both ops1 and ops2 have been processed
        break;
      }

      // next two cases: one or both ops are insert ops
      // => insert the string in the corresponding prime operation, skip it in
      // the other one. If both op1 and op2 are insert ops, prefer op1.
      if (isInsert(op1)) {
        operation1prime.insert(op1 as InsertOperation);
        operation2prime.retain((op1 as InsertOperation).length);
        op1 = ops1[i1++];
        continue;
      }
      if (isInsert(op2)) {
        operation1prime.retain((op2 as InsertOperation).length);
        operation2prime.insert(op2 as InsertOperation);
        op2 = ops2[i2++];
        continue;
      }

      // tslint:disable-next-line: strict-type-predicates
      if (typeof op1 === 'undefined') {
        throw new Error('Cannot compose operations: first operation is too short.');
      }
      // tslint:disable-next-line: strict-type-predicates
      if (typeof op2 === 'undefined') {
        throw new Error('Cannot compose operations: first operation is too long.');
      }

      let minL;
      if (isRetain(op1) && isRetain(op2)) {
        // Simple case: retain/retain
        if (op1 > op2) {
          minL = op2;
          op1 = (op1 as RetainOperation) - (op2 as RetainOperation);
          op2 = ops2[i2++];
        } else if (op1 === op2) {
          minL = op2;
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          minL = op1;
          op2 = (op2 as RetainOperation) - (op1 as RetainOperation);
          op1 = ops1[i1++];
        }
        operation1prime.retain(minL as RetainOperation);
        operation2prime.retain(minL as RetainOperation);
      } else if (isDelete(op1) && isDelete(op2)) {
        // Both operations delete the same string at the same position. We don't
        // need to produce any operations, we just skip over the delete ops and
        // handle the case that one operation deletes more than the other.
        if (-op1 > -op2) {
          op1 = (op1 as DeleteOperation) - (op2 as DeleteOperation);
          op2 = ops2[i2++];
        } else if (op1 === op2) {
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          op2 = (op2 as DeleteOperation) - (op1 as DeleteOperation);
          op1 = ops1[i1++];
        }
        // next two cases: delete/retain and retain/delete
      } else if (isDelete(op1) && isRetain(op2)) {
        if (-op1 > op2) {
          minL = op2;
          op1 = (op1 as DeleteOperation) + (op2 as RetainOperation);
          op2 = ops2[i2++];
        } else if (-op1 === op2) {
          minL = op2;
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          minL = -op1;
          op2 = (op2 as RetainOperation) + (op1 as DeleteOperation);
          op1 = ops1[i1++];
        }
        operation1prime['delete'](minL as DeleteOperation);
      } else if (isRetain(op1) && isDelete(op2)) {
        if (op1 > -op2) {
          minL = -op2;
          op1 = (op1 as RetainOperation) + (op2 as DeleteOperation);
          op2 = ops2[i2++];
        } else if (op1 === -op2) {
          minL = op1;
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          minL = op1;
          op2 = (op2 as DeleteOperation) + (op1 as RetainOperation);
          op1 = ops1[i1++];
        }
        operation2prime['delete'](minL as DeleteOperation);
      } else {
        throw new Error("The two operations aren't compatible");
      }
    }

    return [operation1prime, operation2prime];
  };
}

export default LineOT;
