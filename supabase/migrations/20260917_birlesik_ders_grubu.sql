-- CampusO Vol 1-8 devamı: Birleşik (çift/çoklu bölüme verilen) ders şubeleri.
--
-- BULUNAN GERÇEK SORUN: bir hoca aynı fiziksel dersi (aynı gün/saat/derslik,
-- aynı ders kodu) birden fazla bölüme veriyorsa, ders_programi tablosunda bu
-- BİRDEN FAZLA SATIR olarak duruyor (yalnızca "bolum" farklı) — örnek: Ali
-- İhsan Çetin'in BUS201 "İstatistik 1" dersi güz 2026-2027'de hem "İşletme"
-- hem "Uluslararası Ticaret ve İşletmecilik" için ayrı satırlar. Öğrenci
-- ders_kayitlari'na KENDİ bölümünün satırına kayıt oluyor. Ama akademisyen QR
-- oluştururken ya da elle yoklama alırken dropdown'dan hangi satırı seçtiği
-- şansa bağlıydı — yanlış satır seçilirse diğer bölümden kayıtlı öğrenciler
-- "bu derse kayıtlı görünmüyorsun" diye REDDEDİLİYORDU. Ali İhsan hocanın güz
-- dönemi pilot testi için bu gerçek ve somut bir risk.
--
-- ÇÖZÜM: "aynı fiziksel ders" tanımını (akademisyen + ders kodu + gün + saat
-- + dönem) yakalayan bir campuso_ders_grubu(p_ders_id) fonksiyonu ekleniyor;
-- roster ve QR/yoklama tohumlama fonksiyonları artık TEK bir ders_programi_id
-- yerine bu grubun TÜMÜNE kayıtlı/override edilmiş öğrencileri topluyor.
-- Var olan mimari (yoklama_oturumlari, yoklama_kayitlari, override tablosu)
-- hiç değişmiyor; ön yüz de artık bu fiziksel dersi tek, birleşik bir seçenek
-- olarak (sabit/kanonik bir ders_programi_id ile) gösterecek şekilde
-- güncelleniyor — böylece bir oturum hep aynı id altında birikip parçalanmaz.

begin;

-- Aynı hoca + aynı ders kodu + aynı gün/saat + aynı dönem olan TÜM
-- ders_programi satırlarını (kendisi dahil) döner — "fiziksel ders" grubu.
create or replace function public.campuso_ders_grubu(p_ders_id uuid)
returns table(id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select dp2.id
  from public.ders_programi dp1
  join public.ders_programi dp2
    on dp2.akademisyen_id is not distinct from dp1.akademisyen_id
   and dp2.ders_kodu is not distinct from dp1.ders_kodu
   and dp2.gun is not distinct from dp1.gun
   and dp2.baslangic_saat is not distinct from dp1.baslangic_saat
   and dp2.bitis_saat is not distinct from dp1.bitis_saat
   and dp2.donem is not distinct from dp1.donem
  where dp1.id = p_ders_id;
$$;

-- Roster fonksiyonu artık grubun TÜMÜNE kayıtlı öğrencileri döner (tekrarsız).
create or replace function public.campuso_ders_kayitli_ogrenciler(p_ders_id uuid)
returns table(id uuid, full_name text, avatar_url text, hero_renk text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (public.campuso_ders_akademisyeni_mi(p_ders_id) or public.campuso_current_role() = 'admin') then
    raise exception 'Bu listeye erişim yetkiniz yok.';
  end if;
  return query
    select distinct p.id, p.full_name, p.avatar_url, p.hero_renk
    from public.ders_kayitlari dk
    join public.profiles p on p.id = dk.ogrenci_id and p.role = 'student'
    where dk.ders_programi_id in (select gid.id from public.campuso_ders_grubu(p_ders_id) gid)
    order by p.full_name;
end;
$$;

-- QR yoklama roster tohumlaması: artık "birleşik şube" grubunun tümünden
-- (ders_kayitlari + override) tohumlanıyor, ama oturum/QR yine TEK bir
-- (kanonik) ders_programi_id altında açılıyor — ön yüz her zaman aynı id'yi
-- seçeceği için oturum geçmişi bölünmüyor.
create or replace function public.campuso_qr_yoklama_baslat(p_ders_id uuid, p_sure_dk integer default 3)
returns table(qr_oturum_id uuid, token text, gecerlilik_bitis timestamptz, ders_kodu text, ders_adi text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ders record;
  v_oturum_id uuid;
  v_token text;
  v_bitis timestamptz;
  v_sure integer := greatest(1, least(10, coalesce(p_sure_dk, 3)));
begin
  if not (public.campuso_ders_akademisyeni_mi(p_ders_id) or public.campuso_current_role() = 'admin') then
    raise exception 'Bu ders için yoklama başlatma yetkiniz yok.';
  end if;

  select * into v_ders from public.ders_programi where id = p_ders_id;
  if not found then
    raise exception 'Ders bulunamadı.';
  end if;

  v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_bitis := now() + (v_sure || ' minutes')::interval;

  insert into public.yoklama_oturumlari (ders_programi_id, tarih, olusturan_id)
  values (p_ders_id, current_date, auth.uid())
  on conflict (ders_programi_id, tarih) do update set updated_at = now()
  returning id into v_oturum_id;

  insert into public.yoklama_qr_oturumlari (oturum_id, token, gecerlilik_bitis, baslatan_id)
  values (v_oturum_id, v_token, v_bitis, auth.uid())
  on conflict (oturum_id) do update
    set token = excluded.token, gecerlilik_bitis = excluded.gecerlilik_bitis, baslatan_id = excluded.baslatan_id, created_at = now();

  -- Roster'ı tohumla: birleşik şube grubunun TÜMÜNE kayıtlı öğrenciler +
  -- override(dahil=true), override(dahil=false) hariç (grubun herhangi bir
  -- satırı üzerinden verilmiş override'lar da sayılır).
  insert into public.yoklama_kayitlari (oturum_id, ogrenci_id, durum)
  select v_oturum_id, dk.ogrenci_id, 'yok'
  from public.ders_kayitlari dk
  where dk.ders_programi_id in (select gid.id from public.campuso_ders_grubu(p_ders_id) gid)
    and not exists (
      select 1 from public.yoklama_ogrenci_override o
      where o.ders_programi_id in (select gid.id from public.campuso_ders_grubu(p_ders_id) gid)
        and o.ogrenci_id = dk.ogrenci_id and o.dahil = false
    )
  on conflict (oturum_id, ogrenci_id) do nothing;

  insert into public.yoklama_kayitlari (oturum_id, ogrenci_id, durum)
  select v_oturum_id, o.ogrenci_id, 'yok'
  from public.yoklama_ogrenci_override o
  where o.ders_programi_id in (select gid.id from public.campuso_ders_grubu(p_ders_id) gid) and o.dahil = true
  on conflict (oturum_id, ogrenci_id) do nothing;

  return query select v_oturum_id, v_token, v_bitis, v_ders.ders_kodu, v_ders.ders_adi;
end;
$$;

commit;
