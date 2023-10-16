/***
 * Returns a new object with all keys of the original object except the ones that have a value of undefined or null.
 */
export function omitNil<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined && value !== null)) as Partial<T>
}
