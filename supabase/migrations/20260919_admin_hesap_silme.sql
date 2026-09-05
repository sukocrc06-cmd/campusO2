-- CampusO Vol 1-13 devamı: Admin panelinden akademisyen/öğrenci hesabını
-- komple silme.
--
-- 20260918'de öğrencinin/akademisyenin KENDİ hesabını silmesi için
-- campuso_hesabimi_sil() eklenmişti (auth.uid() üzerinden, yalnızca kendi
-- hesabı). Şimdi admin panelinden (Kullanıcı Veritabanı sayfası) yönetici,
-- istediği akademisyen veya öğrenci hesabını da aynı şekilde tamamen
-- silebilmeli. Aynı FK-tarama/trigger-devre dışı bırakma mantığını tekrar
-- yazmamak için o mantık ortak bir iç fonksiyona (campuso_hesap_temizle_ve_sil)
-- taşınıyor; hem kendi-hesabını-sil hem admin-hesap-sil bu ortak fonksiyonu
-- çağırıyor. Ortak fonksiyonun EXECUTE yetkisi genel kullanıcılardan
-- REVOKE ediliyor — sadece bu iki yetkilendirilmiş "kapı" fonksiyonu
-- (aynı sahip/postgres olduğu için) onu çağırabiliyor, dışarıdan
-- supabase.rpc(...) ile doğrudan çağrılamıyor.
--
-- Güvenlik: admin sadece 'student' veya 'academician' rolündeki hesapları
-- bu yoldan silebilir — başka bir admin hesabını (kendisi dahil) bu
-- fonksiyonla SİLEMEZ, yanlışlıkla/kötüye kullanımla yönetici hesaplarının
-- silinmesinin önüne geçiyor.

begin;

-- 1) Ortak temizleme+silme mantığı (20260918'deki campuso_hesabimi_sil'in
--    gövdesiyle birebir aynı, sadece hedef id artık parametre).
create or replace function public.campuso_hesap_temizle_ve_sil(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fk record;
  v_not_null boolean;
begin
  if p_user_id is null then
    raise exception 'Hedef kullanıcı belirtilmedi.';
  end if;

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
      and con.confdeltype not in ('c', 'n')
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
      using p_user_id;
  end loop;

  alter table public.ders_programi enable trigger ders_programi_akademisyen_sadece_gun_saat;
  alter table public.ders_programi enable trigger ders_programi_akademisyen_esle;

  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.campuso_hesap_temizle_ve_sil(uuid) from public, anon, authenticated;

-- 2) Kendi hesabını silme artık ortak fonksiyonu çağırıyor.
create or replace function public.campuso_hesabimi_sil()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı.';
  end if;
  perform public.campuso_hesap_temizle_ve_sil(v_uid);
end;
$$;

-- 3) Admin panelinden akademisyen/öğrenci hesabını komple silme. Yalnızca
--    admin çağırabilir; hedef 'student' veya 'academician' olmalı (başka
--    bir admin hesabı bu yoldan silinemez).
create or replace function public.campuso_admin_hesap_sil(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_hedef_rol text;
begin
  if public.campuso_current_role() <> 'admin' then
    raise exception 'Bu işlem için yönetici yetkisi gerekiyor.';
  end if;

  select role into v_hedef_rol from public.profiles where id = p_user_id;
  if v_hedef_rol is null then
    raise exception 'Kullanıcı bulunamadı.';
  end if;
  if v_hedef_rol not in ('student', 'academician') then
    raise exception 'Bu yoldan yalnızca öğrenci veya akademisyen hesapları silinebilir.';
  end if;

  perform public.campuso_hesap_temizle_ve_sil(p_user_id);
end;
$$;

commit;
