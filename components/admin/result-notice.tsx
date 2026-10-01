/** Outcome of the last admin action (?result=done|failed). */
export function ResultNotice({ result, done, failed }: { result?: string; done: string; failed: string }) {
  if (result !== "done" && result !== "failed") return null;
  return (
    <p role="status" data-result={result} className={result === "done" ? "rounded-md border border-border p-3 text-sm" : "rounded-md border border-red-600/40 p-3 text-sm text-red-600"}>
      {result === "done" ? done : failed}
    </p>
  );
}
