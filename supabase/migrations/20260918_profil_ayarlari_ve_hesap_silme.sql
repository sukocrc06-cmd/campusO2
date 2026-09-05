-- CampusO Vol 1-13: Profil Ayarları sayfası (/profil şu ana kadar linki olan
-- ama HİÇ var olmayan bir sayfaydı) + hem öğrenci hem akademisyen için ek
-- ayar alanları + "Danger Zone" (kalıcı, anında hesap silme).
--
-- Kullanıcının seçtiği kapsam:
--   - Ortak: bildirim tercihleri (bildirim tipine göre aç/kapa), oturum/
--     güvenlik paneli (son giriş + tüm cihazlardan çıkış — DB değişikliği
--     gerektirmiyor, ön yüzde auth.getSession()/signOut({scope:'global'})
--     ile çözülüyor), profil görünürlüğü (gizli profil profil aramasında
--     çıkmaz).
--   - Akademisyene özel: unvan, ofis/danışmanlık saatleri metni, yeni ders
--     kaydı bildirimini e-postaya da düşürme tercihi.
--   - Danger Zone: hesabı KALICI ve ANINDA silme (auth.users dahil, geri
--     dönüşü yok). Onay ön yüzde yapılıyor ("SİL" yaz + şifre tekrar gir);
--     bu migration yalnızca sunucu tarafı silme fonksiyonunu güvenli hale
--     getiriyor.

begin;

-- 1) Yeni profil alanları.
alter table public.profiles
  add column if not exists bildirim_tercihleri jsonb not null default '{"ders_kaydi": true, "yorum": true, "duyuru": true, "etiket": true}'::jsonb,
  add column if not exists gorunurluk text not null default 'herkese_acik',
  add column if not exists unvan text,
  add column if not exists ofis_saatleri text,
  add column if not exists email_bildirim_ders_kaydi boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_gorunurluk_check'
  ) then
    alter table public.profiles
      add constraint profiles_gorunurluk_check check (gorunurluk in ('herkese_acik', 'gizli'));
  end if;
end $$;

-- 2) Kullanıcı kendi bu yeni alanlarını (ve var olan avatar_url/hero_renk/
--    full_name/bolum/sinif alanlarını) güncelleyebilsin — profiles tablosunda
--    zaten "kendi satırını güncelleme" politikası olması bekleniyor; burada
--    sadece emin olmak için idempotent bir "kendi profilini güncelleyebilir"
--    politikası ekliyoruz (var olan politikalarla çakışmaz, aynı davranışı
--    ifade eder).
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles
      for update using (id = auth.uid()) with check (id = auth.uid());
  end if;
end $$;

-- 3) campuso_profil_ara: gizli profiller genel profil aramasında (kampüs
--    duvarı etiketleme, akademisyenin elle öğrenci ekleme aramasında) artık
--    çıkmıyor. Not: ders kaydı / QR yoklama roster'ı id bazlı olduğu için
--    (bkz. campuso_ders_kayitli_ogrenciler, campuso_qr_yoklama_baslat) bu
--    ayardan ETKİLENMİYOR — gizli bir öğrenci, kayıtlı olduğu derste yine
--    normal şekilde görünür ve QR okutabilir. Bu bilinçli bir ayrım.
create or replace function public.campuso_profil_ara(p_sorgu text, p_limit int default 6)
returns table (id uuid, full_name text, avatar_url text, bolum text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.avatar_url, p.bolum
  from public.profiles p
  where p.role = 'student'
    and p.id <> auth.uid()
    and coalesce(p.gorunurluk, 'herkese_acik') <> 'gizli'
    and p.full_name ilike '%' || coalesce(p_sorgu, '') || '%'
  order by p.full_name asc
  limit greatest(1, least(p_limit, 20));
$$;

-- 4) Kalıcı hesap silme.
--
-- ÖNEMLİ TASARIM NOTU: auth.users(id)'e veya public.profiles(id)'e referans
-- veren, ON DELETE CASCADE / SET NULL OLMAYAN (yani "no action"/"restrict")
-- bir foreign key varsa, doğrudan "delete from auth.users" FK ihlali
-- hatasıyla PATLAR — bu da kullanıcının "hemen ve kalıcı silinsin" isteğini
-- bozar. Bunu genel (gelecekteki yeni migration'lara da dayanıklı) şekilde
-- çözmek için: silmeden ÖNCE, auth.users veya public.profiles'a referans
-- veren ve cascade/set-null OLMAYAN tüm foreign key kolonlarını otomatik
-- olarak NULL'a çekiyoruz (hepsi nullable olacak şekilde tasarlanmış —
-- örn. ders_programi.akademisyen_id, kampus_duvari_bildirimleri.olusturan_id,
-- yoklama_oturumlari.olusturan_id, yoklama_qr_oturumlari.baslatan_id,
-- ders_programi_guncelleme_log.guncelleyen_id, akademisyen_esleme_onaylari.
-- karar_veren_id). Böylece örn. bir akademisyen hesabını silerse, dersleri
-- SİLİNMİYOR — sadece "akademisyen atanmamış" durumuna dönüyor (öğrenci
-- kayıtları, ders_kayitlari, yoklama geçmişi olduğu gibi kalıyor); bir
-- öğrenci hesabını silerse, kendi kişisel verileri (ders_kayitlari,
-- yoklama_kayitlari, kişisel takvim, kulüp üyelikleri, kampüs duvarı
-- gönderileri/yorumları) cascade ile birlikte temizleniyor.
create or replace function public.campuso_hesabimi_sil()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_fk record;
  v_not_null boolean;
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  -- ders_programi tablosunda akademisyen_id'yi koruyan/otomatik yeniden
  -- dolduran İKİ tetikleyici var:
  --   1) ders_programi_akademisyen_sadece_gun_saat (BEFORE UPDATE) — admin
  --      olmayan bir kullanıcının akademisyen_id'yi değiştirmesini engeller
  --      (bkz. 20260909/20260915).
  --   2) ders_programi_akademisyen_esle (BEFORE INSERT/UPDATE) — akademisyen_id
  --      null'a çekilse bile, satırın hoca_adi/hoca_email'i hâlâ o kişiyle
  --      eşleştiği için katalog/e-posta eşlemesiyle akademisyen_id'yi HEMEN
  --      GERİ DOLDURUR (bkz. 20260912 katalog eşlemesi).
  -- İkisi de kötü niyetli/yanlışlıkla değişikliği engellemek için var, ama
  -- burada MEŞRU bir kendi-hesabını-silme işlemi söz konusu — bu yüzden
  -- yalnızca bu işlem süresince (aynı transaction içinde, hata olursa zaten
  -- geri alınır) devre dışı bırakılıyor.
  alter table public.ders_programi disable trigger ders_programi_akademisyen_sadece_gun_saat;
  alter table public.ders_programi disable trigger ders_programi_akademisyen_esle;

  for v_fk in
    select
      con.conname,
      ns.nspname as tablosema,
      cls.relname as tabloadi,
      att.attname as kolonadi
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    join pg_class frel on frel.oid = con.confrelid
    join pg_namespace fns on fns.oid = frel.relnamespace
    where con.contype = 'f'
      and array_length(con.conkey, 1) = 1
      and fns.nspname = 'auth' and frel.relname = 'users'
      and con.confdeltype not in ('c', 'n') -- cascade / set null hariç
      and ns.nspname = 'public'
    union
    select
      con.conname,
      ns.nspname as tablosema,
      cls.relname as tabloadi,
      att.attname as kolonadi
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    join pg_class frel on frel.oid = con.confrelid
    join pg_namespace fns on fns.oid = frel.relnamespace
    where con.contype = 'f'
      and array_length(con.conkey, 1) = 1
      and fns.nspname = 'public' and frel.relname = 'profiles'
      and con.confdeltype not in ('c', 'n')
      and ns.nspname = 'public'
      and cls.relname <> 'profiles'
  loop
    select att.attnotnull into v_not_null
    from pg_attribute att
    join pg_class cls on cls.oid = att.attrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where ns.nspname = v_fk.tablosema and cls.relname = v_fk.tabloadi and att.attname = v_fk.kolonadi;

    if v_not_null then
      raise exception 'Hesap silinemiyor: %.% kolonu NOT NULL ve cascade/set-null tanımlı değil — önce bu kısıtı gözden geçir.', v_fk.tabloadi, v_fk.kolonadi;
    end if;

    execute format('update public.%I set %I = null where %I = $1', v_fk.tabloadi, v_fk.kolonadi, v_fk.kolonadi)
      using v_uid;
  end loop;

  alter table public.ders_programi enable trigger ders_programi_akademisyen_sadece_gun_saat;
  alter table public.ders_programi enable trigger ders_programi_akademisyen_esle;

  delete from public.profiles where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

-- 5) Profil fotoğrafı için Storage bucket'ı — kampüs duvarı gönderi
--    görselleriyle aynı desen (Yol kuralı: <kullanici_id>/dosya_adi).
insert into storage.buckets (id, name, public)
values ('profil-fotograflari', 'profil-fotograflari', true)
on conflict (id) do nothing;

drop policy if exists profil_foto_public_select on storage.objects;
create policy profil_foto_public_select on storage.objects
  for select using (bucket_id = 'profil-fotograflari');

drop policy if exists profil_foto_owner_insert on storage.objects;
create policy profil_foto_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'profil-fotograflari'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists profil_foto_owner_update on storage.objects;
create policy profil_foto_owner_update on storage.objects
  for update using (
    bucket_id = 'profil-fotograflari'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists profil_foto_owner_delete on storage.objects;
create policy profil_foto_owner_delete on storage.objects
  for delete using (
    bucket_id = 'profil-fotograflari'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

commit;
