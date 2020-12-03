import LineOT from '../src/line-ot';

const file = `a
b
c`;

const fileLineCounts = file.split('\n').length;

describe('constructor', () => {
  it('success', () => {
    const ot = new LineOT([fileLineCounts]);
    ot.apply(file);
    expect(ot.toJSON()[0] === fileLineCounts).toBeTruthy();
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
