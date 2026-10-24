import { TextPreprocessor } from './text-preprocessor';

describe('TextPreprocessor', () => {
  const preprocessor = new TextPreprocessor();

  it('collapses whitespace and trims', () => {
    const result = preprocessor.normalize('  hello   world\n\tagain  ');
    expect(result.text).toBe('hello world again');
    expect(result.empty).toBe(false);
  });

  it('flags null, undefined and whitespace-only input as empty', () => {
    expect(preprocessor.normalize(null).empty).toBe(true);
    expect(preprocessor.normalize(undefined).empty).toBe(true);
    expect(preprocessor.normalize('   \n  ').empty).toBe(true);
    expect(preprocessor.normalize(null).text).toBe('');
  });

  it('detects Ukrainian (Cyrillic) text', () => {
    expect(preprocessor.normalize('Дуже смачно').language).toBe('uk');
  });

  it('detects English (Latin) text', () => {
    expect(preprocessor.normalize('Great food').language).toBe('en');
  });

  it('prefers Ukrainian when both scripts are present', () => {
    expect(preprocessor.normalize('Great, але смачно').language).toBe('uk');
  });

  it('returns unknown when there are no letters', () => {
    expect(preprocessor.normalize('12345 !!!').language).toBe('unknown');
  });

  it('truncates text to the maximum length', () => {
    const result = preprocessor.normalize('a'.repeat(5000));
    expect(result.text.length).toBe(2000);
  });
});
