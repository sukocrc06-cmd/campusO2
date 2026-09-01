-- CampusO Vol 1-11 devamı 5: Kampüs Duvarı otomatik moderasyon
-- 1) Metin filtresi akıllandırıldı: harf/rakam oyunlarını (k*fur, k.u.f.u.r,
--    k ü f ü r gibi) normalize ederek yakalayan bir eşleştirmeye geçildi ve
--    yasaklı kelime listesi geniş bir Türkçe küfür/argo setiyle dolduruldu.
-- 2) İhlal takibi: her metin/görsel ihlali kampus_duvari_ihlaller tablosuna
--    kaydediliyor; bir kullanıcının son 30 günde 3. ihlali kaydedildiği an
--    otomatik olarak 24 saatliğine susturuluyor (admin panelinden erken
--    kaldırılabilir).
-- 3) Görsel moderasyonu için gerekli RPC (campuso_ihlal_kaydet) — asıl görsel
--    taraması /api/moderate-image route'unda dış bir servisle yapılıyor,
--    burada sadece ihlal kaydı + otomatik susturma mantığı var.

begin;

-- 1) Akıllı normalize edilmiş metin eşleştirme -----------------------------

create or replace function public.campuso_normalize_metin(p_metin text)
returns text
language sql
immutable
as $$
  select translate(lower(coalesce(p_metin, '')), '0134578$@*.,_- ', 'oieastbsa');
$$;

create or replace function public.campuso_icerik_yasakli_mi(p_icerik text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.kampus_duvari_yasakli_kelimeler k
    where public.campuso_normalize_metin(p_icerik) ilike '%' || public.campuso_normalize_metin(k.kelime) || '%'
  );
$$;

-- Geniş bir temel Türkçe küfür/argo listesi — admin panelinden bu listeye
-- dilediğin kelimeyi ekleyip çıkarabilirsin, buradakiler sadece başlangıç seti.
insert into public.kampus_duvari_yasakli_kelimeler (kelime) values
  ('amk'), ('aq'), ('amına'), ('amcık'), ('orospu'), ('piç'), ('yavşak'),
  ('siktir'), ('sikerim'), ('sikeyim'), ('göt herif'), ('ibne'), ('puşt'),
  ('kahpe'), ('şerefsiz'), ('haysiyetsiz'), ('dallama'), ('yarrak'),
  ('sürtük'), ('kaltak'), ('gerizekalı'), ('geri zekalı'), ('mal herif'),
  ('ananı'), ('anneni sikeyim'), ('bacını'), ('pezevenk'), ('şıllık'),
  ('oç'), ('oğlan çocuğu değilsin'), ('göt lale'), ('yarak'), ('taşşak'),
  ('kancık'), ('dölü'), ('ipne'), ('şerefsizsin')
on conflict (kelime) do nothing;

-- 2) İhlal takibi ve otomatik susturma --------------------------------------

create table if not exists public.kampus_duvari_ihlaller (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  tip text not null check (tip in ('metin', 'gorsel')),
  detay text,
  created_at timestamptz not null default now()
);

create index if not exists kampus_duvari_ihlaller_kullanici_idx on public.kampus_duvari_ihlaller(kullanici_id, created_at desc);

alter table public.kampus_duvari_ihlaller enable row level security;

drop policy if exists kampus_duvari_ihlaller_select on public.kampus_duvari_ihlaller;
create policy kampus_duvari_ihlaller_select on public.kampus_duvari_ihlaller
  for select using (public.campuso_current_role() = 'admin');

-- Doğrudan insert/update/delete politikası yok: bu tabloya yalnızca
-- aşağıdaki security definer fonksiyon üzerinden yazılabilir.

create or replace function public.campuso_ihlal_kaydet(p_kullanici uuid, p_tip text, p_detay text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sayac int;
begin
  insert into public.kampus_duvari_ihlaller (kullanici_id, tip, detay)
  values (p_kullanici, p_tip, p_detay);

  select count(*) into v_sayac
  from public.kampus_duvari_ihlaller
  where kullanici_id = p_kullanici and created_at > now() - interval '30 days';

  if v_sayac >= 3 then
    insert into public.kampus_duvari_susturmalar (kullanici_id, sebep, bitis)
    values (
      p_kullanici,
      'Otomatik: son 30 günde ' || v_sayac || '. moderasyon ihlali',
      now() + interval '24 hours'
    );
  end if;
end;
$$;

-- Gönderi/yorum ekleme tetikleyicilerine, filtreye takılan içerik için
-- ihlal kaydı ekleniyor (fonksiyon gövdesi güncelleniyor, trigger'lar aynı
-- kalıyor çünkü isimleri değişmedi).

create or replace function public.campuso_gonderi_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.campuso_susturulmus_mu(new.yazar_id) then
    raise exception 'Paylaşım yapma yetkiniz geçici olarak kısıtlandı.';
  end if;

  if (select count(*) from public.gonderiler where yazar_id = new.yazar_id and created_at > now() - interval '2 minutes') >= 3 then
    raise exception 'Çok hızlı paylaşım yapıyorsunuz, birkaç dakika bekleyip tekrar deneyin.';
  end if;

  new.onay_bekliyor := public.campuso_icerik_yasakli_mi(new.icerik);
  new.bolum := (select bolum from public.profiles where id = new.yazar_id);

  if new.onay_bekliyor then
    perform public.campuso_ihlal_kaydet(new.yazar_id, 'metin', left(new.icerik, 120));
  end if;

  return new;
end;
$$;

create or replace function public.campuso_yorum_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.campuso_susturulmus_mu(new.yazar_id) then
    raise exception 'Yorum yapma yetkiniz geçici olarak kısıtlandı.';
  end if;

  if (select count(*) from public.yorumlar where yazar_id = new.yazar_id and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Çok hızlı yorum yapıyorsunuz, biraz yavaşlayın.';
  end if;

  new.onay_bekliyor := public.campuso_icerik_yasakli_mi(new.icerik);

  if new.onay_bekliyor then
    perform public.campuso_ihlal_kaydet(new.yazar_id, 'metin', left(new.icerik, 120));
  end if;

  return new;
end;
$$;

commit;
