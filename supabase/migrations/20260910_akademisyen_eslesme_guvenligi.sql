-- CampusO Vol 1-8 devamı: Akademisyen <-> ders eşleştirmesinde güvenlik açığı kapatılıyor.
--
-- SORUN: campuso_profil_ders_geri_doldur / campuso_ders_akademisyen_esle
-- fonksiyonları şimdiye kadar SADECE isim benzerliğine bakarak akademisyen_id
-- atıyordu. full_name serbestçe girilebildiği için, "academician" rolündeki
-- herhangi bir hesap profilindeki adı değiştirip başka bir hocanın adını
-- yazarsa, o hocanın TÜM ders programına ve (yoklama modülü akademisyen_id
-- üzerinden çalıştığı için) yoklama ekranına otomatik olarak erişebiliyordu.
--
-- ÇÖZÜM (hibrit):
--   1) E-POSTA ile eşleşme GÜVENİLİR kabul edilir ve OTOMATİK bağlanır
--      (e-posta Supabase Auth ile doğrulanmış olduğundan taklit edilemez).
--      Bunun çalışması için admin, ders_programi satırlarına o dersi veren
--      hocanın e-postasını (hoca_email) girmelidir — girilmezse bu adım
--      atlanır, sistem otomatik bağlamaz.
--   2) İSİM benzerliği artık DOĞRUDAN akademisyen_id atamaz. Bunun yerine
--      admin panelinde onay bekleyen bir "eşleşme önerisi" oluşturur.
--      Admin "Onayla" demeden hiçbir hesap sadece isim yazarak bir hocanın
--      derslerine bağlanamaz.
--   3) Admin'in "ata" (manuel atama) işlemi öncekiyle aynı şekilde anında ve
--      güvenilir kabul edilmeye devam eder (akademisyen_id_manuel = true).
--   4) Bu migration ÇALIŞTIĞINDA hâlihazırda isimle otomatik bağlanmış olan
--      satırlar (örn. test için kullanılan Ali İhsan Çetin) BOZULMAZ; sadece
--      kaynağı ("admin_onay") olarak işaretlenir ve şeffaflık için onaylanmış
--      bir öneri kaydı oluşturulur. Yalnızca BUNDAN SONRAKİ yeni isim
--      eşleşmeleri admin onayına düşecektir.

begin;

alter table public.ders_programi
  add column if not exists hoca_email text,
  add column if not exists eslesme_kaynagi text not null default 'yok'
    check (eslesme_kaynagi in ('yok', 'email', 'admin_onay', 'admin_manuel'));

create table if not exists public.akademisyen_eslesme_onerileri (
  id uuid primary key default gen_random_uuid(),
  ders_id uuid not null references public.ders_programi(id) on delete cascade,
  onerilen_akademisyen_id uuid not null references public.profiles(id) on delete cascade,
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'onaylandi', 'reddedildi')),
  olusturulma_zamani timestamptz not null default now(),
  karar_zamani timestamptz,
  karar_veren_id uuid references public.profiles(id),
  unique (ders_id)
);

create index if not exists akademisyen_eslesme_onerileri_durum_idx on public.akademisyen_eslesme_onerileri(durum);

alter table public.akademisyen_eslesme_onerileri enable row level security;

drop policy if exists akademisyen_eslesme_onerileri_admin on public.akademisyen_eslesme_onerileri;
create policy akademisyen_eslesme_onerileri_admin on public.akademisyen_eslesme_onerileri
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

-- BEFORE trigger: SADECE e-posta ile güvenilir otomatik eşleşme.
create or replace function public.campuso_ders_akademisyen_esle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_eslesen_id uuid;
begin
  if coalesce(new.akademisyen_id_manuel, false) or new.akademisyen_id is not null then
    return new;
  end if;

  if new.hoca_email is not null and trim(new.hoca_email) <> '' then
    select p.id into v_eslesen_id from public.profiles p
      where p.role = 'academician' and lower(trim(p.email)) = lower(trim(new.hoca_email))
      limit 1;
    if v_eslesen_id is not null then
      new.akademisyen_id := v_eslesen_id;
      new.eslesme_kaynagi := 'email';
    end if;
  end if;

  return new;
end;
$$;

-- AFTER trigger: isim benzerliği artık akademisyen_id atamaz, sadece admin
-- onayı bekleyen bir öneri satırı oluşturur.
create or replace function public.campuso_ders_akademisyen_oner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_norm_hoca text; v_eslesen_id uuid;
begin
  if coalesce(new.akademisyen_id_manuel, false) or new.akademisyen_id is not null then
    return new;
  end if;
  if new.hoca_adi is null or trim(new.hoca_adi) = '' then
    return new;
  end if;

  v_norm_hoca := public.campuso_normalize_ad(new.hoca_adi);
  select p.id into v_eslesen_id from public.profiles p
    where p.role = 'academician'
      and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(p.full_name), v_norm_hoca)
    order by (public.campuso_normalize_ad(p.full_name) = v_norm_hoca) desc, p.full_name
    limit 1;

  if v_eslesen_id is not null then
    insert into public.akademisyen_eslesme_onerileri (ders_id, onerilen_akademisyen_id)
    values (new.id, v_eslesen_id)
    on conflict (ders_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists ders_programi_akademisyen_esle on public.ders_programi;
create trigger ders_programi_akademisyen_esle
  before insert or update on public.ders_programi
  for each row execute function public.campuso_ders_akademisyen_esle();

drop trigger if exists ders_programi_akademisyen_oner on public.ders_programi;
create trigger ders_programi_akademisyen_oner
  after insert or update on public.ders_programi
  for each row execute function public.campuso_ders_akademisyen_oner();

-- profiles: e-posta ile otomatik ve güvenilir; isimle sadece admin onay
-- kuyruğuna öneri.
create or replace function public.campuso_profil_ders_geri_doldur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> 'academician' then
    return new;
  end if;

  if new.email is not null and trim(new.email) <> '' then
    update public.ders_programi d
      set akademisyen_id = new.id, eslesme_kaynagi = 'email'
    where d.akademisyen_id is null and not coalesce(d.akademisyen_id_manuel, false)
      and d.hoca_email is not null and lower(trim(d.hoca_email)) = lower(trim(new.email));
  end if;

  if new.full_name is not null and trim(new.full_name) <> '' then
    insert into public.akademisyen_eslesme_onerileri (ders_id, onerilen_akademisyen_id)
    select d.id, new.id from public.ders_programi d
      where d.akademisyen_id is null and not coalesce(d.akademisyen_id_manuel, false)
        and d.hoca_adi is not null
        and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(d.hoca_adi), public.campuso_normalize_ad(new.full_name))
    on conflict (ders_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_ders_geri_doldur on public.profiles;
create trigger profiles_ders_geri_doldur
  after insert or update of role, full_name, email on public.profiles
  for each row execute function public.campuso_profil_ders_geri_doldur();

-- Geriye dönük uyum: hâlihazırda isimle otomatik bağlanmış (manuel olmayan)
-- satırlar BOZULMAZ, sadece kaynağı işaretlenir ve şeffaflık için zaten
-- "onaylanmış" bir öneri kaydı oluşturulur. Yalnızca bundan sonraki YENİ isim
-- eşleşmeleri admin onayına düşecektir.
update public.ders_programi d
set eslesme_kaynagi = case when coalesce(d.akademisyen_id_manuel, false) then 'admin_manuel' else 'admin_onay' end
where d.akademisyen_id is not null and d.eslesme_kaynagi = 'yok';

insert into public.akademisyen_eslesme_onerileri (ders_id, onerilen_akademisyen_id, durum, karar_zamani)
select d.id, d.akademisyen_id, 'onaylandi', now()
from public.ders_programi d
where d.akademisyen_id is not null
on conflict (ders_id) do nothing;

commit;
