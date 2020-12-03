type RetainOperation = number;
type InsertOperation = string;
type DeleteOperation = number;

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
    return typeof op === 'string';
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

  insert = (str: InsertOperation) => {
    // tslint:disable-next-line: strict-type-predicates
    if (typeof str !== 'string') {
      throw new Error('insert expects a string');
    }
    if (str === '') {
      return this;
    }
    this.targetLineCounts++;
    const ops = this.ops;
    const beforeOp = ops[ops.length - 1];
    if (this.isDelete(beforeOp)) {
      // 操作符合并逻辑
      // 如果前一个是DeleteOperation
      // delete(2),insert('a') => delete(1)
      // delete(1),insert('a') => noop
      const deleteLineCounts = (beforeOp as number) + 1;
      if (deleteLineCounts === 0) {
        ops.pop();
      } else {
        ops[ops.length - 1] = deleteLineCounts;
      }
    } else {
      ops.push(str);
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
    return this.toJSON().toString();
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
    const lines = file.split(CHANGE_LINE_CHAR);

    if (lines.length !== this.baseLineCounts) {
      throw new Error("The operation's base line counts must be equal to the file's line counts.");
    }

    let resultFile: string[] = [];
    let indexOfLines = 0;
    this.ops.forEach(op => {
      if (this.isRetain(op)) {
        if (indexOfLines + (op as number) > lines.length) {
          throw new Error("Operation can't retain more line counts than are left in the file.");
        }
        const endIndex = indexOfLines + (op as number);
        resultFile = resultFile.concat(lines.slice(indexOfLines, endIndex));
        indexOfLines = endIndex;
      } else if (this.isInsert(op)) {
        resultFile.push(op as string);
      } else {
        // delete op
        indexOfLines -= op as number;
      }
    });

    return resultFile.join(CHANGE_LINE_CHAR);
  };
}

export default LineOT;
