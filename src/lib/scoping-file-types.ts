/** Client-safe validation used before sending a scoping document for parsing. */
export const SCOPING_FILE_NAME_PATTERN = /\.(?:pdf|docx|txt)$/i;

export function isSupportedScopingFileName(filename: string): boolean {
  return SCOPING_FILE_NAME_PATTERN.test(filename);
}
