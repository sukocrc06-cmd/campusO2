-- CampusO Vol 1-16: Bilimsel Çalışma Teknikleri'ni derinleştirme.
--
-- Kullanıcı isteği: Pomodoro / Aralıklı Tekrar / Uzun Odaklı Çalışma artık
-- Akademik Yönetim menüsünde ayrı ayrı sayfalar olacak; bu migration üçünü
-- de zenginleştiren veri modelini kuruyor:
--   1) calisma_oturumlari.konu — hem Pomodoro hem Uzun Odaklı Çalışma
--      oturumlarına isteğe bağlı "ne üzerinde çalışıyorsun" etiketi.
--   2) profiles.toplam_odak_saniyesi — Uzun Odaklı Çalışma'da biriken toplam
--      süre; farklı "bitki türlerinin" (çiçek/bonsai/fidan/meyve ağacı)
--      hangi eşikte açılacağını istemci bu sütuna bakarak hesaplıyor.
--   3) tekrar_programlari — Aralıklı Tekrar'ı tek seferlik hatırlatıcıdan
--      gerçek bir 1→3→7→16 gün zincirine çeviriyor. Her aşama, aynı zamanda
--      kişisel takvimdeki TEK bir 'tekrar' etkinliğini güncelliyor (yeni
--      satır açmak yerine tarihini ileri kaydırıyor), böylece takvim kirlenmiyor.
--      Zincir bitince (4. aşama da tamamlanınca) hatırlatıcı takvimden
--      kaldırılıyor, program 'tamamlandı' olarak işaretli kalıyor.
--   Anti-cheat: bir tekrar aşaması, planlanan tarihi gerçekten gelmeden
--   "tamamlandı" işaretlenemiyor (sunucu current_date kontrolü yapıyor) —
--   tıpkı Uzun Odaklı Çalışma'daki süre kontrolü gibi.

begin;

-- 1) Konu etiketi.
alter table public.calisma_oturumlari
  add column if not exists konu text;
alter table public.calisma_oturumlari drop constraint if exists calisma_oturumlari_konu_check;
alter table public.calisma_oturumlari add constraint calisma_oturumlari_konu_check
  check (konu is null or char_length(konu) <= 120);

-- 2) Toplam odak süresi (bitki türü eşiği için).
alter table public.profiles
  add column if not exists toplam_odak_saniyesi bigint not null default 0;

create or replace function public.campuso_calisma_oturumu_hasat_sayaci()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'tamamlandi' and old.durum <> 'tamamlandi' and new.tur = 'uzun_odakli' then
    update public.profiles
    set tamamlanan_odak_oturumu_sayisi = tamamlanan_odak_oturumu_sayisi + 1,
        toplam_odak_saniyesi = toplam_odak_saniyesi + new.hedef_saniye
    where id = new.kullanici_id;
  end if;
  return new;
end;
$$;

-- 3) Aralıklı Tekrar zinciri.
create table if not exists public.tekrar_programlari (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  konu text not null check (char_length(konu) between 1 and 120),
  asama_index int not null default 1 check (asama_index between 1 and 4),
  sonraki_tarih date not null,
  tamamlandi_mi boolean not null default false,
  takvim_etkinlik_id uuid references public.kisisel_takvim_etkinlikleri(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tekrar_programlari_kullanici_idx on public.tekrar_programlari(kullanici_id, tamamlandi_mi, sonraki_tarih);

drop trigger if exists campuso_tekrar_programlari_touch_trg on public.tekrar_programlari;
create trigger campuso_tekrar_programlari_touch_trg
  before update on public.tekrar_programlari
  for each row execute function public.campuso_touch_updated_at();

alter table public.tekrar_programlari enable row level security;

-- Yalnızca kendi programlarını görebilir; ekleme/güncelleme yalnızca aşağıdaki
-- iki fonksiyon üzerinden (SECURITY DEFINER, tablo sahibi olarak RLS'i
-- doğal biçimde atlıyor) yapılabilir — istemci doğrudan insert/update ile
-- tarih/aşama mantığını manipüle edemez.
drop policy if exists tekrar_programlari_select on public.tekrar_programlari;
create policy tekrar_programlari_select on public.tekrar_programlari
  for select using (kullanici_id = auth.uid());

-- Eski tek seferlik hatırlatıcı fonksiyonu artık zincir fonksiyonlarıyla
-- değiştiriliyor.
drop function if exists public.campuso_tekrar_hatirlatici_ekle(text, int);

create or replace function public.campuso_tekrar_programi_baslat(p_konu text, p_gun int)
returns public.tekrar_programlari
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_konu text := trim(coalesce(p_konu, ''));
  v_index int;
  v_tarih date;
  v_etkinlik_id uuid;
  v_program public.tekrar_programlari;
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

  v_index := case p_gun when 1 then 1 when 3 then 2 when 7 then 3 else null end;
  if v_index is null then
    raise exception 'Geçersiz gün seçimi.';
  end if;

  v_tarih := current_date + p_gun;

  insert into public.kisisel_takvim_etkinlikleri (kullanici_id, tarih, tur, baslik)
  values (v_uid, v_tarih, 'tekrar', 'Tekrar: ' || v_konu || ' (1. tekrar)')
  returning id into v_etkinlik_id;

  insert into public.tekrar_programlari (kullanici_id, konu, asama_index, sonraki_tarih, takvim_etkinlik_id)
  values (v_uid, v_konu, v_index, v_tarih, v_etkinlik_id)
  returning * into v_program;

  return v_program;
end;
$$;

create or replace function public.campuso_tekrar_tamamla(p_program_id uuid)
returns public.tekrar_programlari
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_program public.tekrar_programlari;
  v_gun_dizisi int[] := array[1, 3, 7, 16];
  v_sonraki_index int;
  v_yeni_tarih date;
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  select * into v_program from public.tekrar_programlari
  where id = p_program_id and kullanici_id = v_uid
  for update;

  if not found then
    raise exception 'Tekrar programı bulunamadı.';
  end if;
  if v_program.tamamlandi_mi then
    raise exception 'Bu tekrar zaten tamamlanmış.';
  end if;
  if current_date < v_program.sonraki_tarih then
    raise exception 'Bu tekrarın tarihi henüz gelmedi.';
  end if;

  v_sonraki_index := v_program.asama_index + 1;

  if v_sonraki_index <= 4 then
    v_yeni_tarih := current_date + v_gun_dizisi[v_sonraki_index];
    update public.tekrar_programlari
    set asama_index = v_sonraki_index, sonraki_tarih = v_yeni_tarih
    where id = p_program_id
    returning * into v_program;

    if v_program.takvim_etkinlik_id is not null then
      update public.kisisel_takvim_etkinlikleri
      set tarih = v_yeni_tarih, baslik = 'Tekrar: ' || v_program.konu || ' (' || v_sonraki_index || '. tekrar)'
      where id = v_program.takvim_etkinlik_id;
    end if;
  else
    update public.tekrar_programlari
    set tamamlandi_mi = true
    where id = p_program_id
    returning * into v_program;

    if v_program.takvim_etkinlik_id is not null then
      delete from public.kisisel_takvim_etkinlikleri where id = v_program.takvim_etkinlik_id;
      update public.tekrar_programlari set takvim_etkinlik_id = null where id = p_program_id
      returning * into v_program;
    end if;
  end if;

  return v_program;
end;
$$;

commit;
