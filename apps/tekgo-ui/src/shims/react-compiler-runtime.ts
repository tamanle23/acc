const $empty = Symbol.for('react.memo_cache_sentinel');

export function c(size: number) {
  return new Array(size).fill($empty);
}

export default { c };
