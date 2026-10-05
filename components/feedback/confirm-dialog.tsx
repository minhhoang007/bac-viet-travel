"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface ConfirmDialogProps {
  /** Text of the button that opens the dialog; also the confirm button's text. */
  trigger: string;
  title: string;
  description?: string;
  cancel: string;
  /** Server action run on confirm. */
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden inputs posted with the action. */
  children?: ReactNode;
  destructive?: boolean;
}

/** Asks before running a server action that is hard to undo. */
export function ConfirmDialog({ trigger, title, description, cancel, action, children, destructive }: ConfirmDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{trigger}</Button>
      </DialogTrigger>
      <DialogContent closeLabel={cancel} {...(!description && { "aria-describedby": undefined })}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form action={action}>
          {children}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {cancel}
              </Button>
            </DialogClose>
            <Button type="submit" variant={destructive ? "destructive" : "default"}>
              {trigger}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
