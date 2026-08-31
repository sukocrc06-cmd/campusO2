-- CampusO Vol 1-11 devamı 3: Kampüs Duvarı'nı akademisyenlere de aç
-- Akademisyenler duvarı görebilsin (okuma), paylaşım/yorum/tepki/kaydetme
-- gibi yazma işlemleri şimdilik yalnızca öğrencilerde kalsın.

begin;

drop policy if exists gonderiler_select on public.gonderiler;
create policy gonderiler_select on public.gonderiler
  for select using (
    public.campuso_current_role() in ('student', 'academician', 'admin')
    and (onay_bekliyor = false or yazar_id = auth.uid() or public.campuso_current_role() = 'admin')
  );

drop policy if exists yorumlar_select on public.yorumlar;
create policy yorumlar_select on public.yorumlar
  for select using (
    public.campuso_current_role() in ('student', 'academician', 'admin')
    and (onay_bekliyor = false or yazar_id = auth.uid() or public.campuso_current_role() = 'admin')
  );

drop policy if exists gonderi_begenileri_select on public.gonderi_begenileri;
create policy gonderi_begenileri_select on public.gonderi_begenileri
  for select using (public.campuso_current_role() in ('student', 'academician', 'admin'));

drop policy if exists yorum_begenileri_select on public.yorum_begenileri;
create policy yorum_begenileri_select on public.yorum_begenileri
  for select using (public.campuso_current_role() in ('student', 'academician', 'admin'));

commit;
