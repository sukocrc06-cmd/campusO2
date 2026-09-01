-- CampusO Vol 1-11 devamı 4: Kampüs Duvarı — resmi duyuru gönderme
-- Admin artık duvara, normal öğrenci gönderilerinden görsel olarak ayrışan
-- "resmi duyuru" paylaşabiliyor (otomatik sabitlenir). Susturulmuş
-- kullanıcılar listesi için ek bir izin gerekmiyor — mevcut
-- kampus_duvari_susturmalar_all politikası zaten admin'e tam erişim
-- veriyor, sadece admin panelinde bir liste/erken kaldırma arayüzü ekleniyor.

begin;

alter table public.gonderiler
  add column if not exists resmi_duyuru boolean not null default false;

drop policy if exists gonderiler_insert on public.gonderiler;
create policy gonderiler_insert on public.gonderiler
  for insert with check (
    yazar_id = auth.uid()
    and (
      public.campuso_current_role() = 'student'
      or (public.campuso_current_role() = 'admin' and resmi_duyuru = true)
    )
  );

commit;
