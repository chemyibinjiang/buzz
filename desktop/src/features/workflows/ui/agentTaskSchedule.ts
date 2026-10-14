import type { CalendarSchedule, TriggerConfig } from "./workflowFormTypes";

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type ScheduleOptions = {
  repeat: "daily" | "weekdays" | "weekly" | "custom" | "heartbeat";
  frequency: "daily" | "weekly" | "minutes" | "hours";
  every: string;
  time: string;
  timezone: string;
  startDate: string;
  weekdays: number[];
};

export function dateInTimezone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function defaultScheduleOptions(): ScheduleOptions {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return {
    repeat: "daily",
    frequency: "weekly",
    every: "1",
    time: "09:00",
    timezone,
    startDate: dateInTimezone(timezone),
    weekdays: [1, 2, 3, 4, 5],
  };
}

export function optionsFromTrigger(trigger: TriggerConfig): ScheduleOptions {
  const defaults = defaultScheduleOptions();
  if (trigger.calendar) {
    const calendar = trigger.calendar;
    return {
      ...defaults,
      repeat: "custom",
      frequency: calendar.frequency,
      every: String(calendar.every),
      time: calendar.time,
      timezone: calendar.timezone,
      startDate: calendar.start_date,
      weekdays: calendar.weekdays,
    };
  }
  const interval = /^(\d+)(m|h)$/.exec(trigger.interval ?? "");
  return interval
    ? {
        ...defaults,
        repeat: "heartbeat",
        every: interval[1],
        frequency: interval[2] === "h" ? "hours" : "minutes",
      }
    : defaults;
}

export function scheduleTrigger(
  options: ScheduleOptions,
):
  | { trigger: TriggerConfig; error?: undefined }
  | { trigger?: undefined; error: string } {
  const isInterval =
    options.repeat === "heartbeat" ||
    (options.repeat === "custom" &&
      ["minutes", "hours"].includes(options.frequency));
  const every =
    options.repeat === "custom" || isInterval ? Number(options.every) : 1;
  if (
    !/^\d+$/.test(String(every)) ||
    !Number.isSafeInteger(every) ||
    every < 1 ||
    every > (isInterval ? 10080 : 366)
  ) {
    return {
      error: `Every must be a whole number from 1 to ${isInterval ? 10080 : 366}.`,
    };
  }
  if (isInterval) {
    return {
      trigger: {
        on: "schedule",
        interval: `${every}${options.frequency === "hours" ? "h" : "m"}`,
      },
    };
  }
  try {
    dateInTimezone(options.timezone);
  } catch {
    return { error: "Select a valid IANA timezone, such as Asia/Shanghai." };
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(options.time)) {
    return { error: "Choose a valid start time." };
  }
  const date = new Date(`${options.startDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(options.startDate) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== options.startDate
  ) {
    return { error: "Choose a valid start date." };
  }
  const frequency =
    options.repeat === "daily"
      ? "daily"
      : options.repeat === "custom" && options.frequency === "daily"
        ? "daily"
        : "weekly";
  const weekdays =
    frequency === "daily"
      ? []
      : options.repeat === "weekdays"
        ? [1, 2, 3, 4, 5]
        : options.weekdays;
  if (
    frequency === "weekly" &&
    (weekdays.length === 0 ||
      weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7) ||
      new Set(weekdays).size !== weekdays.length)
  ) {
    return { error: "Select at least one weekday." };
  }
  return {
    trigger: {
      on: "schedule",
      calendar: {
        frequency,
        every,
        time: options.time,
        timezone: options.timezone,
        start_date: options.startDate,
        weekdays: [...weekdays].sort((a, b) => a - b),
      },
    },
  };
}

export function scheduledTaskName(name: string, instruction: string): string {
  return (
    name.trim() ||
    Array.from(instruction.trim().split(/\r?\n/)[0]).slice(0, 80).join("")
  );
}

export function calendarSummary(calendar: CalendarSchedule): string {
  const frequency = calendar.frequency === "daily" ? "day" : "week";
  const days =
    calendar.frequency === "weekly"
      ? ` on ${calendar.weekdays.map((day) => WEEKDAYS[day - 1]?.slice(0, 3)).join(", ")}`
      : "";
  return `Every ${calendar.every} ${frequency}${calendar.every === 1 ? "" : "s"}${days} at ${calendar.time} (${calendar.timezone}), from ${calendar.start_date}`;
}
