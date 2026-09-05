-- CampusO Vol 1-15: Öğrenci ana sayfasına "Çalışma Teknikleri" araç seti ve
-- büyüyen bitki gamification'ı.
--
-- Kullanıcı isteği: "öğrenci anasayfasına bu sistemi kursak gerçekten bir
-- filiz büyüse ve zaman bittiğinde olgunlaşsa görüntü ve sistem olarak çok
-- güzel olur anasayfada bunu inşa edelim" — sunumdaki üç kart (Pomodoro
-- Tekniği, Aralıklı Tekrar, Uzun Odaklı Çalışma) esas alınarak üçü birden
-- kuruluyor; büyüyen/olgunlaşan bitki yalnızca "Uzun Odaklı Çalışma"
-- oturumlarına bağlanıyor (kullanıcının seçimiyle).
--
-- Tasarım notları:
--   - calisma_oturumlari: her Pomodoro/Uzun Odaklı Çalışma oturumu bir satır.
--     bitis_zamani_planlanan İSTEMCİDEN GELMİYOR — bir BEFORE INSERT
--     trigger'ı sunucu saatiyle (now() + hedef_saniye) hesaplıyor, böylece
--     istemci geri sayımı manipüle etse bile sunucu gerçek bitiş anını bilir.
--   - "tamamlandı" durumuna geçiş de bir BEFORE UPDATE trigger'ı ile
--     korunuyor: now() henüz bitis_zamani_planlanan'a ulaşmadıysa güncelleme
--     reddediliyor — yani süre gerçekten dolmadan bitki "olgunlaşamaz".
--   - AFTER UPDATE trigger'ı, yalnızca tur='uzun_odakli' bir oturum ilk kez
--     "tamamlandı" olduğunda profiles.tamamlanan_odak_oturumu_sayisi'ni
--     (hasat sayacı) artırıyor.
--   - Aralıklı Tekrar için ayrı bir tablo açmak yerine mevcut kişisel takvim
--     (20260901_kisisel_takvim.sql) yeniden kullanılıyor: yeni 'tekrar' türü
--     eklenip, seçilen gün sayısı kadar sonrasına bir hatırlatıcı düşürülüyor.

begin;

-- 1) Çalışma oturumları tablosu.
create table if not exists public.calisma_oturumlari (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  tur text not null check (tur in ('pomodoro', 'uzun_odakli')),
  hedef_saniye int not null check (
    (tur = 'pomodoro' and hedef_saniye = 1500)
    or (tur = 'uzun_odakli' and hedef_saniye between 300 and 14400)
  ),
  baslangic_at timestamptz not null default now(),
  bitis_zamani_planlanan timestamptz not null default now(),
  durum text not null default 'devam_ediyor' check (durum in ('devam_ediyor', 'tamamlandi', 'iptal')),
  tamamlanma_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calisma_oturumlari_kullanici_idx on public.calisma_oturumlari(kullanici_id, durum);

drop trigger if exists campuso_calisma_oturumlari_touch_trg on public.calisma_oturumlari;
create trigger campuso_calisma_oturumlari_touch_trg
  before update on public.calisma_oturumlari
  for each row execute function public.campuso_touch_updated_at();

alter table public.calisma_oturumlari enable row level security;

drop policy if exists calisma_oturumlari_all on public.calisma_oturumlari;
create policy calisma_oturumlari_all on public.calisma_oturumlari
  for all using (kullanici_id = auth.uid())
  with check (kullanici_id = auth.uid());

-- 2) bitis_zamani_planlanan'ı sunucu saatiyle, dokunulmaz şekilde hesapla.
create or replace function public.campuso_calisma_oturumu_bitis_hesapla()
returns trigger
language plpgsql
as $$
begin
  new.baslangic_at := coalesce(new.baslangic_at, now());
  new.bitis_zamani_planlanan := new.baslangic_at + (new.hedef_saniye || ' seconds')::interval;
  return new;
end;
$$;

drop trigger if exists campuso_calisma_oturumu_bitis_trg on public.calisma_oturumlari;
create trigger campuso_calisma_oturumu_bitis_trg
  before insert on public.calisma_oturumlari
  for each row execute function public.campuso_calisma_oturumu_bitis_hesapla();

-- 3) "tamamlandı"ya geçişi, planlanan bitiş anına gerçekten ulaşılmadan
--    engelle (istemci tarafı geri sayım hilesine karşı).
create or replace function public.campuso_calisma_oturumu_tamamlanma_kontrol()
returns trigger
language plpgsql
as $$
begin
  if new.durum = 'tamamlandi' and old.durum <> 'tamamlandi' then
    if now() < old.bitis_zamani_planlanan then
      raise exception 'Süre henüz dolmadı.';
    end if;
    new.tamamlanma_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists campuso_calisma_oturumu_tamamlanma_trg on public.calisma_oturumlari;
create trigger campuso_calisma_oturumu_tamamlanma_trg
  before update on public.calisma_oturumlari
  for each row execute function public.campuso_calisma_oturumu_tamamlanma_kontrol();

-- 4) Hasat sayacı: yalnızca Uzun Odaklı Çalışma oturumu ilk kez tamamlanınca.
alter table public.profiles
  add column if not exists tamamlanan_odak_oturumu_sayisi int not null default 0;

create or replace function public.campuso_calisma_oturumu_hasat_sayaci()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'tamamlandi' and old.durum <> 'tamamlandi' and new.tur = 'uzun_odakli' then
    update public.profiles
    set tamamlanan_odak_oturumu_sayisi = tamamlanan_odak_oturumu_sayisi + 1
    where id = new.kullanici_id;
  end if;
  return new;
end;
$$;

drop trigger if exists campuso_calisma_oturumu_hasat_trg on public.calisma_oturumlari;
create trigger campuso_calisma_oturumu_hasat_trg
  after update on public.calisma_oturumlari
  for each row execute function public.campuso_calisma_oturumu_hasat_sayaci();

-- 5) Aralıklı Tekrar: kişisel takvime yeni 'tekrar' türü.
alter table public.kisisel_takvim_etkinlikleri drop constraint if exists kisisel_takvim_etkinlikleri_tur_check;
alter table public.kisisel_takvim_etkinlikleri add constraint kisisel_takvim_etkinlikleri_tur_check
  check (tur in ('ders', 'sinav', 'proje', 'sunum', 'tekrar', 'diger'));

create or replace function public.campuso_tekrar_hatirlatici_ekle(p_konu text, p_gun int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_konu text := trim(coalesce(p_konu, ''));
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı.';
  end if;
  if v_konu = '' then
    raise exception 'Konu boş olamaz.';
  end if;
  if char_length(v_konu) > 120 then
    raise exception 'Konu çok uzun.';
  end if;
  if p_gun not in (1, 3, 7) then
    raise exception 'Geçersiz gün seçimi.';
  end if;

  insert into public.kisisel_takvim_etkinlikleri (kullanici_id, tarih, tur, baslik)
  values (v_uid, (current_date + p_gun), 'tekrar', 'Tekrar: ' || v_konu)
  returning id into v_id;

  return v_id;
end;
$$;

commit;
