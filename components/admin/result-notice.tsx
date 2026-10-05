import { Notice } from "@/components/feedback/notice";

/** Outcome of the last admin action (?result=done|failed). */
export function ResultNotice({ result, done, failed }: { result?: string; done: string; failed: string }) {
  if (result !== "done" && result !== "failed") return null;
  return (
    <Notice tone={result === "done" ? "success" : "danger"} role="status" data-result={result}>
      {result === "done" ? done : failed}
    </Notice>
  );
}
