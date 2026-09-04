-- CampusO Vol 1-8 devamı: Akademisyenin kendi dersinin gün/saatini
-- sürükle-bırak ile değiştirebilmesi.
--
-- ders_programi tablosunun mevcut RLS politikası (ders_programi_write)
-- yazma iznini sadece admin'e veriyordu. Şimdi akademisyene, SADECE kendi
-- akademisyen_id'sine bağlı derslerde, SADECE gün/başlangıç-bitiş saatini
-- değiştirebileceği ayrı ve dar kapsamlı bir politika ekleniyor. Bölüm,
-- sınıf, ders adı, derslik, hoca adı ve akademisyen_id gibi alanları bir
-- akademisyenin değiştirememesi bir trigger ile veritabanı seviyesinde
-- garanti ediliyor (RLS kolon bazlı kısıtlama yapamadığı için).

begin;

drop policy if exists ders_programi_akademisyen_kendi_dersi on public.ders_programi;
create policy ders_programi_akademisyen_kendi_dersi on public.ders_programi
  for update
  using (akademisyen_id = auth.uid())
  with check (akademisyen_id = auth.uid());

create or replace function public.campuso_ders_akademisyen_sadece_gun_saat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- admin her alanı değiştirebilir, dokunma.
  if public.campuso_current_role() = 'admin' then
    return new;
  end if;

  -- admin olmayan biri (akademisyenin kendisi) sadece kendi dersini,
  -- sadece gün/başlangıç/bitiş saati alanlarında güncelleyebilir; başka her
  -- alan eski değerine sabitlenir, akademisyen_id ise hiç değiştirilemez.
  new.bolum := old.bolum;
  new.sinif := old.sinif;
  new.ders_kodu := old.ders_kodu;
  new.ders_adi := old.ders_adi;
  new.derslik := old.derslik;
  new.hoca_adi := old.hoca_adi;
  new.akademisyen_id := old.akademisyen_id;
  new.akademisyen_id_manuel := old.akademisyen_id_manuel;
  return new;
end;
$$;

drop trigger if exists ders_programi_akademisyen_sadece_gun_saat on public.ders_programi;
create trigger ders_programi_akademisyen_sadece_gun_saat
  before update on public.ders_programi
  for each row execute function public.campuso_ders_akademisyen_sadece_gun_saat();

commit;
