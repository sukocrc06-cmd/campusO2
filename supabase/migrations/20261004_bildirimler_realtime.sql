-- Kişiselleştirme > Bildirim Yönetimi'nin ilk adımı: bildirim geldiğinde
-- GERÇEKTEN ses çalsın istendi. Bunun için ana sayfa artık
-- kampus_duvari_bildirimleri tablosundaki INSERT olaylarını Supabase
-- Realtime ile canlı dinliyor (bkz. app/page.tsx'teki yeni
-- `co-bildirim-${userId}` kanalı) — bu da tablonun "supabase_realtime"
-- publication'ına eklenmiş olmasını gerektiriyor, yoksa realtime hiçbir
-- olay yayınlamaz.
--
-- RLS zaten "kullanici_id = auth.uid()" ile select'i sahibine sınırladığı
-- için realtime abonelikleri de otomatik olarak sadece kendi bildirimini
-- görüyor — ekstra bir güvenlik önlemi gerekmiyor.
--
-- Publication varlığı kontrol ediliyor ki bu migration lokal test
-- veritabanı gibi gerçek bir Supabase projesi olmayan ortamlarda (henüz
-- "supabase_realtime" publication'ı hiç yokken) sessizce atlanabilsin.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'kampus_duvari_bildirimleri'
    ) then
      alter publication supabase_realtime add table public.kampus_duvari_bildirimleri;
    end if;
  end if;
end $$;
