"use client";

import * as React from "react";
import { format, startOfToday } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/components/ui/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const LOCALES = { vi, en: enUS } as const;

export interface DatePickerProps {
  /** Form field name; the value is submitted as YYYY-MM-DD. */
  name: string;
  id?: string;
  locale: keyof typeof LOCALES;
  placeholder: string;
  /** Disable days before today (e.g. departure dates). */
  futureOnly?: boolean;
  defaultValue?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function DatePicker({ name, id, locale, placeholder, futureOnly, defaultValue, ...aria }: DatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(defaultValue ? new Date(`${defaultValue}T00:00:00`) : undefined);
  const [open, setOpen] = React.useState(false);
  const [today] = React.useState(startOfToday);
  const dfLocale = LOCALES[locale];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" className={cn("mt-1 h-10 w-full justify-start font-normal", !date && "text-muted-foreground")} {...aria}>
          <CalendarIcon aria-hidden="true" />
          {date ? format(date, "PPP", { locale: dfLocale }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            setDate(d);
            setOpen(false);
          }}
          locale={dfLocale}
          disabled={futureOnly ? { before: today } : undefined}
          autoFocus
        />
      </PopoverContent>
      <input type="hidden" name={name} value={date ? format(date, "yyyy-MM-dd") : ""} />
    </Popover>
  );
}
