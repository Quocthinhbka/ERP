/** Serialize query params — mảng lặp key (statusIn=A&statusIn=B) cho NestJS. */
export function appendArrayParams(
  searchParams: URLSearchParams,
  key: string,
  values?: string[],
) {
  if (!values?.length) return;
  for (const value of values) {
    searchParams.append(key, value);
  }
}
