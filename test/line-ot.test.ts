import LineOT, { CHANGE_LINE_CHAR } from '../src/line-ot';

const file = `a
b
c`;

const fileLines: string[] = file.split(CHANGE_LINE_CHAR);
const fileLineCounts = fileLines.length;

describe('constructor', () => {
  it('success', () => {
    const ot = new LineOT([fileLineCounts]);
    ot.apply(file);
    expect(ot.toJSON()[0] === fileLineCounts).toBeTruthy();
  });

  it('fromJSON', () => {
    const ot = new LineOT([1, 'd', -1, 1]);
    const result = ot.apply(file);
    const lines = ([] as string[]).concat(fileLines);
    lines.splice(1, 1, 'd');
    expect(result === lines.join(CHANGE_LINE_CHAR)).toBeTruthy();
  });

  it('fromJSON error', () => {
    let error = '';
    try {
      // @ts-ignore
      const to = new LineOT([{}]);
    } catch (e) {
      error = e;
    }
    expect(error !== '').toBeTruthy();
  });

  it('error', () => {
    const ot = new LineOT([fileLineCounts + 1]);
    let result;
    let error = '';
    try {
      result = ot.apply(file);
    } catch (e) {
      error = e;
      result = '';
    }
    expect(result === '').toBeTruthy();
    expect(error !== '').toBeTruthy();
  });
});

describe('retain', () => {
  it('params 0', () => {
    const ot = new LineOT();
    let error = '';
    try {
      ot.retain(0);
    } catch (e) {
      error = e;
    }
    expect(error === '').toBeTruthy();
    expect(ot.toJSON().length === 0).toBeTruthy();
  });

  it('whole counts', () => {
    const ot = new LineOT();
    let result;
    try {
      result = ot.retain(fileLineCounts).apply(file);
    } catch (e) {
      result = '';
    }
    expect(result === file).toBeTruthy();
    expect(ot.isNoop()).toBeTruthy();
  });

  it('merge retain', () => {
    const ot = new LineOT();
    let result;
    try {
      result = ot
        .retain(1)
        .retain(2)
        .apply(file);
    } catch (e) {
      result = '';
    }
    expect(result === file).toBeTruthy();
    expect(ot.toString() === fileLineCounts.toString()).toBeTruthy();
  });

  it('out of line counts', () => {
    const ot = new LineOT();
    let result;
    let error = '';
    try {
      result = ot.retain(4).apply(file);
    } catch (e) {
      error = e;
      result = '';
    }
    expect(result === '').toBeTruthy();
    expect(error !== '').toBeTruthy();
  });

  it('out of line counts by merge', () => {
    const ot = new LineOT();
    let result;
    let error = '';
    try {
      result = ot
        .retain(2)
        .retain(2)
        .apply(file);
    } catch (e) {
      error = e;
      result = '';
    }
    expect(result === '').toBeTruthy();
    expect(error !== '').toBeTruthy();
    expect(ot.toString() === '4').toBeTruthy();
  });

  it('less then line counts', () => {
    const ot = new LineOT();
    let result;
    let error = '';
    try {
      result = ot.retain(2).apply(file);
    } catch (e) {
      error = e;
      result = '';
    }
    expect(result === '').toBeTruthy();
    expect(error !== '').toBeTruthy();
  });

  it('params error', () => {
    const ot = new LineOT();
    let error = '';
    try {
      // @ts-ignore
      ot.retain('a');
    } catch (e) {
      error = e;
    }
    expect(error !== '').toBeTruthy();
  });
});

describe('insert', () => {
  it('default in start', () => {
    const ot = new LineOT();
    const newLine = 'd';
    const result = ot
      .insert(newLine)
      .retain(3)
      .apply(file);
    const lines = result.split(CHANGE_LINE_CHAR);
    expect(lines.shift() === newLine).toBeTruthy();
    expect(lines.join(CHANGE_LINE_CHAR) === file).toBeTruthy();
  });

  it('at middle of file', () => {
    const ot = new LineOT();
    const insertIndex = 1;
    const newLine = 'd';
    const result = ot
      .retain(insertIndex)
      .insert(newLine)
      .retain(fileLineCounts - insertIndex)
      .apply(file);
    const lines = ([] as string[]).concat(fileLines);
    lines.splice(insertIndex, 0, newLine);
    expect(lines.join(CHANGE_LINE_CHAR) === result).toBeTruthy();
  });

  it('empty', () => {
    const ot = new LineOT();
    ot.insert('');
    expect(ot.toJSON().length === 0).toBeTruthy();
    expect(ot.isNoop()).toBeTruthy();
  });

  it('merge delete comes noop', () => {
    const ot = new LineOT();
    ot.delete(1).insert('d');
    expect(ot.toJSON().length === 0).toBeTruthy();
  });

  it('merge delete', () => {
    const ot = new LineOT();
    ot.delete(2).insert('d');
    expect(ot.toJSON().length === 1).toBeTruthy();
    expect(ot.toJSON().toString() === '-1').toBeTruthy();
  });

  it('params error', () => {
    const ot = new LineOT();
    let error = '';
    try {
      // @ts-ignore
      ot.insert(1);
    } catch (e) {
      error = e;
    }
    expect(error !== '').toBeTruthy();
  });
});

describe('delete', () => {
  it('default in start', () => {
    const ot = new LineOT();
    const result = ot
      .delete(1)
      .retain(fileLineCounts - 1)
      .apply(file);
    const lines = ([] as string[]).concat(fileLines);
    lines.shift();
    expect(lines.join(CHANGE_LINE_CHAR) === result).toBeTruthy();
  });

  it('at middle of file', () => {
    const ot = new LineOT();
    const deleteIndex = 1;
    const result = ot
      .retain(deleteIndex)
      .delete(1)
      .retain(fileLineCounts - deleteIndex - 1)
      .apply(file);
    const lines = ([] as string[]).concat(fileLines);
    lines.splice(deleteIndex, 1);
    expect(lines.join(CHANGE_LINE_CHAR) === result).toBeTruthy();
  });

  it('out of line counts', () => {
    const ot = new LineOT();
    let error = '';
    try {
      ot.delete(fileLineCounts + 1).apply(file);
    } catch (e) {
      error = e;
    }
    expect(error !== '').toBeTruthy();
  });

  it('params error', () => {
    const ot = new LineOT();
    let error = '';
    try {
      // @ts-ignore
      ot.delete('a').apply(file);
    } catch (e) {
      error = e;
    }
    expect(error !== '').toBeTruthy();
  });

  it('merge', () => {
    const ot = new LineOT();
    ot.delete(1).delete(1);
    expect(ot.toJSON().length === 1).toBeTruthy();
    expect(ot.toJSON()[0] === -2).toBeTruthy();
  });

  it('empty', () => {
    const ot = new LineOT();
    ot.delete(0);
    expect(ot.toJSON().length === 0).toBeTruthy();
  });
});
