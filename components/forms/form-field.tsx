import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FieldProps = { id: string; label: string; error?: string };

export type FormFieldProps = FieldProps &
  (({ multiline?: false } & ComponentProps<"input">) | ({ multiline: true } & ComponentProps<"textarea">));

/** Label + input (or textarea) + error message, with aria-invalid/aria-describedby wired. */
export function FormField(props: FormFieldProps) {
  const { id, label, error } = props;
  const errorId = `${id}-error`;
  const aria = { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined };
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {props.multiline ? (
        <Textarea rows={4} {...controlProps(props)} {...aria} />
      ) : (
        <Input {...controlProps(props)} {...aria} />
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Props meant for the input/textarea itself. */
function controlProps<T extends FieldProps & { multiline?: boolean }>(props: T): Omit<T, keyof FieldProps | "multiline"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, label, error, multiline, ...rest } = props;
  return rest;
}
