import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { FieldLabel, FormSelect } from "./workflowFormPrimitives";
import { AgentTaskCalendarAdvanced } from "./AgentTaskScheduleFields";
import { optionsFromTrigger, WEEKDAYS } from "./agentTaskSchedule";
import type { CalendarSchedule } from "./workflowFormTypes";

export function WorkflowCalendarFields({
  value,
  onChange,
}: {
  value: CalendarSchedule;
  onChange: (value: CalendarSchedule) => void;
}) {
  const update = (patch: Partial<CalendarSchedule>) =>
    onChange({ ...value, ...patch });
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="wf-calendar-frequency">Repeats</FieldLabel>
          <FormSelect
            id="wf-calendar-frequency"
            value={value.frequency}
            onChange={(frequency) =>
              update({
                frequency: frequency as CalendarSchedule["frequency"],
                weekdays: frequency === "daily" ? [] : [1, 2, 3, 4, 5],
              })
            }
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </FormSelect>
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="wf-calendar-every">
            Every ({value.frequency === "daily" ? "days" : "weeks"})
          </FieldLabel>
          <Input
            id="wf-calendar-every"
            type="number"
            min={1}
            max={366}
            value={value.every}
            onChange={(event) => update({ every: Number(event.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="wf-calendar-time">Time</FieldLabel>
          <Input
            id="wf-calendar-time"
            type="time"
            value={value.time}
            onChange={(event) => update({ time: event.target.value })}
          />
        </div>
      </div>
      {value.frequency === "weekly" ? (
        <fieldset className="flex flex-wrap gap-2" aria-label="Weekdays">
          {WEEKDAYS.map((day, index) => (
            <Button
              key={day}
              type="button"
              size="sm"
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
      ) : null}
      <AgentTaskCalendarAdvanced
        value={optionsFromTrigger({ on: "schedule", calendar: value })}
        onChange={(options) =>
          update({ timezone: options.timezone, start_date: options.startDate })
        }
      />
    </div>
  );
}
