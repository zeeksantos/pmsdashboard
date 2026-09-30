-- Salary data integrity: at least one non-negative rate, one row per effective date.
alter table employee_salaries
  add constraint salary_has_rate check (monthly_rate is not null or hourly_rate is not null),
  add constraint salary_rates_nonnegative check (
    (monthly_rate is null or monthly_rate >= 0) and (hourly_rate is null or hourly_rate >= 0)),
  add constraint salary_one_per_date unique (employee_id, effective_from);
