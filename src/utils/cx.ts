/** Une clases de CSS ignorando los valores vacíos: cx('a', cond && 'b') */
export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');
