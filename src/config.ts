/**
 * Config file parsing (tickets/T-008-config-ignore-patterns.md).
 *
 * Validate Before You Normalize: values are checked and used exactly as written. The only
 * framing removed is one leading byte order mark. This module never touches the file system;
 * `src/cli.ts` reads the file and passes the text in.
 */

export interface Config {
  /** Regular expressions, as written, tested against the first line of a commit message. */
  ignore: string[];
}

const BOM = '\uFEFF';

/**
 * Compile one ignore pattern exactly as written, with the `u` flag and no other.
 *
 * @param pattern Regular expression source.
 * @param label How error messages name the pattern, for example `ignore[2]`.
 * @returns The compiled expression. It has no `g` or `y` flag, so `test` keeps no state.
 * @throws RangeError when the pattern is the empty string (it would match every commit) or is
 *         not a valid regular expression under the `u` flag.
 */
export function compileIgnorePattern(pattern: string, label: string): RegExp {
  if (pattern === '') {
    throw new RangeError(`invalid config: ${label} is an empty pattern, which would match every commit`);
  }
  try {
    return new RegExp(pattern, 'u');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RangeError(
      `invalid config: ${label} is not a valid regular expression: ${JSON.stringify(pattern)} (${detail})`,
    );
  }
}

/**
 * Parse the text of a `.tracenotes.json` file.
 *
 * @param text File content. One leading byte order mark is allowed and removed.
 * @returns `{ ignore }` with the patterns exactly as written; `ignore` is `[]` when the key is
 *          absent. Pure: no file access, no environment.
 * @throws RangeError naming the problem when the text is not JSON, the top level is not an
 *         object, a key other than `ignore` is present, `ignore` is not an array, or an element
 *         is not a string, is empty, or is not a valid regular expression under the `u` flag.
 */
export function parseConfig(text: string): Config {
  const body = text.startsWith(BOM) ? text.slice(1) : text;
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RangeError(`invalid config: not valid JSON (${detail})`);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RangeError('invalid config: the top level must be a JSON object');
  }
  for (const key of Object.keys(value)) {
    if (key !== 'ignore') {
      throw new RangeError(`invalid config: unknown key ${JSON.stringify(key)}; the only key is "ignore"`);
    }
  }
  if (!Object.hasOwn(value, 'ignore')) return { ignore: [] };
  const ignore = (value as { ignore: unknown }).ignore;
  if (!Array.isArray(ignore)) {
    throw new RangeError('invalid config: "ignore" must be an array of strings');
  }
  ignore.forEach((pattern: unknown, index) => {
    if (typeof pattern !== 'string') {
      throw new RangeError(`invalid config: ignore[${index}] must be a string`);
    }
    compileIgnorePattern(pattern, `ignore[${index}]`);
  });
  return { ignore: [...(ignore as string[])] };
}
