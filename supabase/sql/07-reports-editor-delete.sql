-- Ynmo Roadmaps - 07: any editor can delete a weekly report (also one that is already saved for the executives). Safe to re-run. Run AFTER 06.
drop policy if exists "report remove" on public.reports;
create policy "report remove" on public.reports for delete to authenticated
  using (public.is_editor());
