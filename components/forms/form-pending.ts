"use client";

import { createContext } from "react";

/**
 * "The surrounding form is saving", for forms that do not post through the `action` prop (useFormStatus only sees
 * those): SaveInPlaceForm provides it, SubmitButton reads it.
 */
export const FormPendingContext = createContext(false);
