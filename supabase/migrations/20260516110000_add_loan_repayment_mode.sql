alter table loans
  add column if not exists repayment_mode text;

update loans
set repayment_mode = 'scheduled'
where repayment_mode is null;

alter table loans
  alter column repayment_mode set default 'scheduled';

alter table loans
  alter column repayment_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loans_repayment_mode_check'
  ) then
    alter table loans
      add constraint loans_repayment_mode_check
      check (repayment_mode in ('scheduled', 'flexible'));
  end if;
end $$;
