//! Local-time calendar recurrence with deterministic UTC fire anchors.

use chrono::{DateTime, Datelike, Duration, NaiveDate, NaiveTime, TimeZone, Utc};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};

use crate::error::WorkflowError;

/// Calendar recurrence unit. Weekly schedules also select ISO weekdays.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CalendarFrequency {
    /// Repeat every N local calendar days.
    Daily,
    /// Repeat on selected weekdays every N local calendar weeks.
    Weekly,
}

/// A timezone-aware recurring task, anchored to a local start date.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CalendarSchedule {
    /// Recurrence unit.
    pub frequency: CalendarFrequency,
    /// Number of days or weeks between occurrences (1 through 366).
    pub every: u16,
    /// Local start time in strict HH:MM format.
    pub time: String,
    /// IANA timezone, e.g. Asia/Shanghai.
    pub timezone: String,
    /// Inclusive first date in YYYY-MM-DD format; anchors every-N recurrences.
    pub start_date: String,
    /// ISO weekdays (Monday=1, Sunday=7). Required only for weekly recurrence.
    #[serde(default)]
    pub weekdays: Vec<u8>,
}

impl CalendarSchedule {
    fn parsed(&self) -> Option<(Tz, NaiveDate, NaiveTime)> {
        let timezone = self.timezone.parse::<Tz>().ok()?;
        let date = NaiveDate::parse_from_str(&self.start_date, "%Y-%m-%d").ok()?;
        let time = NaiveTime::parse_from_str(&self.time, "%H:%M").ok()?;
        if date.format("%Y-%m-%d").to_string() != self.start_date
            || time.format("%H:%M").to_string() != self.time
        {
            return None;
        }
        Some((timezone, date, time))
    }

    /// Validate the timezone, date, time, recurrence interval and weekdays.
    pub fn validate(&self) -> Result<(), WorkflowError> {
        let valid_days = self.weekdays.iter().all(|day| (1..=7).contains(day))
            && self
                .weekdays
                .iter()
                .collect::<std::collections::HashSet<_>>()
                .len()
                == self.weekdays.len();
        let valid_frequency = match self.frequency {
            CalendarFrequency::Daily => self.weekdays.is_empty(),
            CalendarFrequency::Weekly => !self.weekdays.is_empty() && valid_days,
        };
        if !(1..=366).contains(&self.every) || !valid_frequency || self.parsed().is_none() {
            return Err(WorkflowError::InvalidDefinition(
                "invalid calendar schedule: use every=1..366, HH:MM, an IANA timezone, YYYY-MM-DD, and unique ISO weekdays 1..7 for weekly schedules".into(),
            ));
        }
        Ok(())
    }

    /// Return the UTC occurrence in the open/closed window (now-window, now].
    ///
    /// A nonexistent DST time is skipped. An ambiguous fall-back time runs only
    /// at its earlier UTC occurrence. Every pod therefore claims the same instant.
    /// Missed occurrences outside this window are not replayed.
    pub(crate) fn fire_instant(
        &self,
        now: DateTime<Utc>,
        window_secs: i64,
    ) -> Option<DateTime<Utc>> {
        if self.validate().is_err() {
            return None;
        }
        let (timezone, anchor, time) = self.parsed()?;
        let local_date = now.with_timezone(&timezone).date_naive();
        if local_date < anchor {
            return None;
        }
        let days = local_date.signed_duration_since(anchor).num_days();
        let matches = match self.frequency {
            CalendarFrequency::Daily => days % i64::from(self.every) == 0,
            CalendarFrequency::Weekly => {
                // Monday of the start week is the anchor, even when start_date
                // itself falls mid-week; earlier dates remain excluded above.
                let anchor_monday = anchor.checked_sub_signed(Duration::days(i64::from(
                    anchor.weekday().num_days_from_monday(),
                )))?;
                let weeks = local_date.signed_duration_since(anchor_monday).num_days() / 7;
                weeks % i64::from(self.every) == 0
                    && self
                        .weekdays
                        .contains(&(local_date.weekday().number_from_monday() as u8))
            }
        };
        if !matches {
            return None;
        }
        let scheduled = timezone
            .from_local_datetime(&local_date.and_time(time))
            .earliest()?
            .with_timezone(&Utc);
        let window_start = now.checked_sub_signed(Duration::seconds(window_secs))?;
        (scheduled > window_start && scheduled <= now).then_some(scheduled)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(text: &str) -> DateTime<Utc> {
        text.parse().expect("test UTC time")
    }

    fn daily() -> CalendarSchedule {
        CalendarSchedule {
            frequency: CalendarFrequency::Daily,
            every: 1,
            time: "09:00".into(),
            timezone: "Asia/Shanghai".into(),
            start_date: "2026-10-12".into(),
            weekdays: vec![],
        }
    }

    #[test]
    fn china_time_and_tick_drift_use_the_exact_utc_anchor() {
        let schedule = daily();
        assert_eq!(
            schedule.fire_instant(utc("2026-10-12T01:00:42Z"), 60),
            Some(utc("2026-10-12T01:00:00Z"))
        );
        assert_eq!(schedule.fire_instant(utc("2026-10-12T09:00:00Z"), 60), None);
        assert_eq!(schedule.fire_instant(utc("2026-10-12T01:01:00Z"), 60), None);
        assert_eq!(schedule.fire_instant(utc("2026-10-11T01:00:00Z"), 60), None);
    }

    #[test]
    fn every_two_days_is_anchored_across_months() {
        let mut schedule = daily();
        schedule.start_date = "2026-10-31".into();
        schedule.every = 2;
        assert!(schedule
            .fire_instant(utc("2026-11-01T01:00:00Z"), 60)
            .is_none());
        assert!(schedule
            .fire_instant(utc("2026-11-02T01:00:00Z"), 60)
            .is_some());
    }

    #[test]
    fn every_two_weeks_and_selected_days_do_not_degrade_to_weekly() {
        let mut schedule = daily();
        schedule.frequency = CalendarFrequency::Weekly;
        schedule.every = 2;
        schedule.weekdays = vec![1, 5];
        assert!(schedule
            .fire_instant(utc("2026-10-12T01:00:00Z"), 60)
            .is_some());
        assert!(schedule
            .fire_instant(utc("2026-10-16T01:00:00Z"), 60)
            .is_some());
        assert!(schedule
            .fire_instant(utc("2026-10-13T01:00:00Z"), 60)
            .is_none());
        assert!(schedule
            .fire_instant(utc("2026-10-19T01:00:00Z"), 60)
            .is_none());
        assert!(schedule
            .fire_instant(utc("2026-10-26T01:00:00Z"), 60)
            .is_some());
        schedule.start_date = "2026-10-14".into();
        assert!(schedule
            .fire_instant(utc("2026-10-12T01:00:00Z"), 60)
            .is_none());
        assert!(schedule
            .fire_instant(utc("2026-10-16T01:00:00Z"), 60)
            .is_some());
    }

    #[test]
    fn local_date_boundary_and_dst_do_not_duplicate_occurrences() {
        let mut schedule = daily();
        schedule.time = "00:30".into();
        assert!(schedule
            .fire_instant(utc("2026-10-11T16:30:00Z"), 60)
            .is_some());
        schedule.timezone = "America/New_York".into();
        schedule.start_date = "2026-01-01".into();
        schedule.time = "01:30".into();
        assert!(schedule
            .fire_instant(utc("2026-11-01T05:30:00Z"), 60)
            .is_some());
        assert!(schedule
            .fire_instant(utc("2026-11-01T06:30:00Z"), 60)
            .is_none());
        schedule.time = "02:30".into();
        assert!(schedule
            .fire_instant(utc("2026-03-08T07:30:00Z"), 60)
            .is_none());
        assert!(schedule
            .fire_instant(utc("2026-03-09T06:30:00Z"), 60)
            .is_some());
    }

    #[test]
    fn rejects_invalid_calendar_fields() {
        for (field, value) in [
            ("time", "24:00"),
            ("time", "9:00"),
            ("timezone", "China Time"),
            ("start_date", "2026-02-30"),
        ] {
            let mut schedule = daily();
            match field {
                "time" => schedule.time = value.into(),
                "timezone" => schedule.timezone = value.into(),
                _ => schedule.start_date = value.into(),
            }
            assert!(schedule.validate().is_err());
        }
        let mut schedule = daily();
        schedule.every = 0;
        assert!(schedule.validate().is_err());
        schedule.every = 1;
        schedule.frequency = CalendarFrequency::Weekly;
        for weekdays in [vec![], vec![0], vec![8], vec![1, 1]] {
            schedule.weekdays = weekdays;
            assert!(schedule.validate().is_err());
        }
    }
}
