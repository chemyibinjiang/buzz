# Channel Agent schedules and Heartbeat

Open a channel, choose **Schedule a task** in the members bar, select an Agent
in that channel, and enter the instructions it should receive.

## Recurrence

- **Daily:** run at the selected local time each day.
- **Weekdays:** run Monday through Friday at the selected local time.
- **Weekly:** select one or more weekdays and a local time.
- **Custom:** repeat every N days, every N weeks on selected weekdays, or at
  an interval in minutes/hours.
- **Heartbeat:** send the instructions repeatedly at an interval of at least
  one minute. Tell the Agent in the instructions whether to report every run
  or only on meaningful changes.

Calendar schedules default to 09:00 in the computer's timezone. **Advanced**
lets you set an optional task name, IANA timezone and start date. The start date
anchors every-N-days schedules; every-N-weeks schedules use the Monday of that
date's week and never run before the start date. At daylight-saving boundaries,
nonexistent local times are skipped and repeated local times run once.

The channel's **Workflows** view lists tasks and their creator, source, channel,
target Agent, and run history. Use it to edit, pause, or delete a task.
Editing a task preserves its recurrence and source attribution.

## Runtime requirements

Deploy the Relay containing `prompt_agent`, scheduled instruction events
(`kind:40009`) and calendar scheduling along with the desktop change. An older
Relay cannot execute these definitions; installing the desktop alone is
insufficient.

The Agent runtime must be online and its **Who can send instructions** policy
must permit the task creator. The Relay checks that the Agent still belongs to
the channel before sending a scheduled instruction. Removing the Agent stops
delivery. Calendar occurrences missed while the Relay is offline are not
replayed in bulk. Existing cron definitions retain their UTC semantics.
