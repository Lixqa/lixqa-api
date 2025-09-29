export class Random {
  static chars = 'abcdesfghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(
    '',
  );

  static string(length = 10, chars = this.chars) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }

    return result;
  }

  static stringRandomLength(minLength = 0, maxLength = 10, chars = this.chars) {
    return this.string(this.number(minLength, maxLength), chars);
  }

  static number(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static choice<T>(array: T[]): T {
    return array[this.number(0, array.length - 1)];
  }

  static chance(percentage: number) {
    return this.number(0, 100) <= percentage;
  }

  static uuid() {
    const timeHex = BigInt(Date.now()).toString(16).padStart(12, '0');

    const randomHex = Array.from({ length: 10 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0'),
    ).join('');

    return [
      timeHex.substring(0, 8),
      timeHex.substring(8) + '7',
      randomHex.substring(0, 4),
      randomHex.substring(4, 8),
      randomHex.substring(8),
    ].join('-');
  }
}
