import type { ReactNode } from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { FieldLabel, FormSelect } from "./workflowFormPrimitives";
import { WEEKDAYS } from "./agentTaskSchedule";
import type { ScheduleOptions } from "./agentTaskSchedule";

type Props = {
  value: ScheduleOptions;
  onChange: (value: ScheduleOptions) => void;
  disabled?: boolean;
};

function ScheduleRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3">
      <label className="text-sm font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="min-w-36 max-w-full">{children}</div>
    </div>
  );
}

export function AgentTaskScheduleFields({ value, onChange, disabled }: Props) {
  const update = (patch: Partial<ScheduleOptions>) =>
    onChange({ ...value, ...patch });
  const interval =
    value.repeat === "heartbeat" ||
    (value.repeat === "custom" &&
      ["minutes", "hours"].includes(value.frequency));
  const weekly =
    value.repeat === "weekly" ||
    (value.repeat === "custom" && value.frequency === "weekly");
  return (
    <div className="divide-y rounded-2xl border bg-muted/20">
      <ScheduleRow label="Repeat" htmlFor="task-repeat">
        <FormSelect
          id="task-repeat"
          disabled={disabled}
          value={value.repeat}
          onChange={(repeat) =>
            update({
              repeat: repeat as ScheduleOptions["repeat"],
              ...(repeat === "heartbeat"
                ? { frequency: "minutes", every: "30" }
                : {}),
            })
          }
        >
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">Weekly</option>
          <option value="heartbeat">Heartbeat</option>
          <option value="custom">Custom</option>
        </FormSelect>
      </ScheduleRow>
      {value.repeat === "custom" || value.repeat === "heartbeat" ? (
        <>
          <ScheduleRow label="Repeats" htmlFor="task-frequency">
            <FormSelect
              id="task-frequency"
              disabled={disabled}
              value={value.frequency}
              onChange={(frequency) =>
                update({ frequency: frequency as ScheduleOptions["frequency"] })
              }
            >
              {value.repeat !== "heartbeat" ? (
                <>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </>
              ) : null}
              <option value="minutes">Every few minutes</option>
              <option value="hours">Every few hours</option>
            </FormSelect>
          </ScheduleRow>
          <ScheduleRow label="Every" htmlFor="task-every">
            <div className="flex items-center justify-end gap-2">
              <Input
                className="w-20"
                id="task-every"
                type="number"
                min={1}
                max={interval ? 10080 : 366}
                disabled={disabled}
                value={value.every}
                onChange={(event) => update({ every: event.target.value })}
              />
              <span className="text-sm text-muted-foreground">
                {value.frequency === "daily"
                  ? "days"
                  : value.frequency === "weekly"
                    ? "weeks"
                    : value.frequency}
              </span>
            </div>
          </ScheduleRow>
        </>
      ) : null}
      {weekly ? (
        <div className="space-y-3 px-4 py-3">
          <span className="text-sm font-medium">On</span>
          <fieldset className="flex flex-wrap gap-2" aria-label="Weekdays">
            {WEEKDAYS.map((day, index) => (
              <Button
                key={day}
                type="button"
                size="sm"
                disabled={disabled}
                aria-label={day}
                aria-pressed={value.weekdays.includes(index + 1)}
                variant={
                  value.weekdays.includes(index + 1) ? "default" : "outline"
                }
                onClick={() =>
                  update({
                    weekdays: value.weekdays.includes(index + 1)
                      ? value.weekdays.filter((item) => item !== index + 1)
                      : [...value.weekdays, index + 1],
                  })
                }
              >
                {day.slice(0, 3)}
              </Button>
            ))}
          </fieldset>
        </div>
      ) : null}
      {interval ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          Runs repeatedly after saving. The minimum interval is one minute.
        </p>
      ) : (
        <ScheduleRow
          label={value.repeat === "custom" ? "Start time" : "Time"}
          htmlFor="task-time"
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Input
              className="w-32"
              id="task-time"
              type="time"
              disabled={disabled}
              value={value.time}
              onChange={(event) => update({ time: event.target.value })}
            />
            <span className="text-xs text-muted-foreground">
              {value.timezone === "Asia/Shanghai"
                ? "China Time"
                : value.timezone}
            </span>
          </div>
        </ScheduleRow>
      )}
    </div>
  );
}

export function AgentTaskCalendarAdvanced({
  value,
  onChange,
  disabled,
}: Props) {
  const update = (patch: Partial<ScheduleOptions>) =>
    onChange({ ...value, ...patch });
  const interval =
    value.repeat === "heartbeat" ||
    (value.repeat === "custom" &&
      ["minutes", "hours"].includes(value.frequency));
  if (interval) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <FieldLabel htmlFor="task-timezone">Timezone</FieldLabel>
        <Input
          id="task-timezone"
          list="task-timezones"
          disabled={disabled}
          value={value.timezone}
          onChange={(event) => update({ timezone: event.target.value })}
        />
        <datalist id="task-timezones">
          {[
            ...new Set([
              Intl.DateTimeFormat().resolvedOptions().timeZone,
              "Asia/Shanghai",
              "UTC",
              "America/New_York",
              "America/Los_Angeles",
              "Europe/London",
              "Asia/Tokyo",
            ]),
          ].map((timezone) => (
            <option key={timezone} value={timezone} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="task-start-date">Start date</FieldLabel>
        <Input
          id="task-start-date"
          type="date"
          disabled={disabled}
          value={value.startDate}
          onChange={(event) => update({ startDate: event.target.value })}
        />
      </div>
    </div>
  );
}
