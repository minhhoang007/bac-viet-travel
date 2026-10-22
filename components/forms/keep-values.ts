"use client";

import { startTransition, type FormEvent } from "react";

/**
 * onSubmit for a form posting to a server action through useActionState. React resets a form after its `action`
 * runs, so a visitor sent back with an error would lose everything typed; submitting by hand keeps the fields (the
 * `action` prop still works without JavaScript). useFormStatus does not see these submits: give SubmitButton the
 * pending flag through FormPendingContext.
 */
export function keepValuesOnSubmit(dispatch: (data: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
}
