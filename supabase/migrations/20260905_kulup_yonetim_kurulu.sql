-- CampusO Vol 1-6 devamı: Kulüp Yönetim Kurulu
-- Kulüp oluşturma/yönetim akışına: başkan atama, yönetim kurulu unvanları
-- (Başkan Yardımcısı, Genel Sekreter, Sayman vb.), başvuru formuna "hangi
-- alanda katkı sağlamak istersin" alanı ve kurulun herkese güvenli biçimde
-- tanıtılabilmesi için bir RPC ekleniyor.
-- Ön koşul: 20260825_add_kulupler_module.sql bu projede çalıştırılmış olmalı.

begin;

-- 1) Yeni kolonlar --------------------------------------------------------

alter table public.kulupler
  add column if not exists baskan_id uuid references auth.users(id) on delete set null;

create index if not exists kulupler_baskan_id_idx on public.kulupler(baskan_id);

alter table public.kulup_uyelikleri
  add column if not exists unvan text,
  add column if not exists ilgi_alani text;

-- 2) Başkan yalnızca aktif bir üye olabilir --------------------------------

create or replace function public.campuso_kulupler_baskan_kontrol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.baskan_id is not null and NEW.baskan_id is distinct from OLD.baskan_id then
    if not exists (
      select 1 from public.kulup_uyelikleri
      where kulup_id = NEW.id and student_id = NEW.baskan_id and durum = 'aktif'
    ) then
      raise exception 'Başkan yalnızca kulübün aktif bir üyesi olabilir.';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists campuso_kulupler_baskan_kontrol_trg on public.kulupler;
create trigger campuso_kulupler_baskan_kontrol_trg
  before update on public.kulupler
  for each row execute function public.campuso_kulupler_baskan_kontrol();

-- 3) Üyelik tetikleyicisini unvan/ilgi_alani alanlarını da koruyacak
--    şekilde güncelliyoruz: unvanı yalnız kulüp yetkilisi/danışman
--    atayabilir, ilgi_alani (başvuru formunun bir parçası) motivasyon
--    gibi başvurudan sonra değiştirilemez.

create or replace function public.campuso_enforce_kulup_uyelik_islem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.campuso_current_role();
  v_danisman uuid;
  v_is_manager boolean;
begin
  select danisman_id into v_danisman from public.kulupler where id = coalesce(NEW.kulup_id, OLD.kulup_id);

  if TG_OP = 'INSERT' then
    v_is_manager := public.campuso_kulup_yetkilisi_mi(NEW.kulup_id);
    if NEW.rol = 'yonetici' and v_role <> 'admin' and (v_danisman is null or auth.uid() <> v_danisman) then
      raise exception 'Yönetici yetkisi yalnızca kulüp danışmanı veya admin tarafından verilebilir.';
    end if;
    if NEW.student_id = auth.uid() and not v_is_manager and v_role <> 'admin' then
      if NEW.rol <> 'uye' or NEW.durum <> 'beklemede' or NEW.unvan is not null then
        raise exception 'Kendi başvurunuzu yalnızca "beklemede" durumunda, "uye" rolüyle ve unvansız oluşturabilirsiniz.';
      end if;
    end if;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if NEW.kulup_id <> OLD.kulup_id or NEW.student_id <> OLD.student_id then
      raise exception 'Üyelik kaydında kulüp veya öğrenci bilgisi değiştirilemez.';
    end if;

    if v_role = 'admin' then
      return NEW;
    end if;

    v_is_manager := public.campuso_kulup_yetkilisi_mi(OLD.kulup_id);

    if v_is_manager then
      if NEW.rol is distinct from OLD.rol and (v_danisman is null or auth.uid() <> v_danisman) then
        raise exception 'Yalnızca kulüp danışmanı yönetici rolü atayabilir veya kaldırabilir.';
      end if;
      if NEW.motivasyon is distinct from OLD.motivasyon then
        raise exception 'Başvuru içeriği değiştirilemez.';
      end if;
      if NEW.ilgi_alani is distinct from OLD.ilgi_alani then
        raise exception 'Başvuru içeriği değiştirilemez.';
      end if;
      if not (
        (OLD.durum = 'beklemede' and NEW.durum in ('aktif', 'reddedildi'))
        or (OLD.durum = 'aktif' and NEW.durum = 'ayrildi')
        or (NEW.durum = OLD.durum)
      ) then
        raise exception 'Geçersiz üyelik durumu geçişi.';
      end if;
      return NEW;
    end if;

    if auth.uid() <> OLD.student_id then
      raise exception 'Bu üyelik kaydını değiştirme yetkiniz yok.';
    end if;
    if NEW.rol is distinct from OLD.rol then
      raise exception 'Kendi rolünüzü değiştiremezsiniz.';
    end if;
    if NEW.motivasyon is distinct from OLD.motivasyon then
      raise exception 'Başvuru içeriği değiştirilemez.';
    end if;
    if NEW.ilgi_alani is distinct from OLD.ilgi_alani then
      raise exception 'Başvuru içeriği değiştirilemez.';
    end if;
    if NEW.unvan is distinct from OLD.unvan then
      raise exception 'Unvanınızı yalnızca kulüp yöneticisi veya danışmanı değiştirebilir.';
    end if;
    if not (OLD.durum = 'aktif' and NEW.durum = 'ayrildi') then
      raise exception 'Yalnızca aktif bir üyelikten ayrılabilirsiniz.';
    end if;
    return NEW;
  end if;

  return NEW;
end;
$$;

-- 4) Yönetim kurulunu herkese güvenli biçimde tanıtma ----------------------
-- kulup_uyelikleri tablosunun tam satırları (motivasyon, ilgi_alani gibi
-- kişisel başvuru bilgisi içerdiği için) herkese açık değil; bu fonksiyon
-- yalnızca aktif ve unvanlı/yönetici üyelerin adını, unvanını ve rolünü
-- döndürür — kulüp kartlarında "Yönetim Kurulu" tanıtımı için kullanılır.

create or replace function public.campuso_kulup_kurulu(p_kulup_id uuid default null)
returns table (kulup_id uuid, student_id uuid, full_name text, avatar_url text, unvan text, rol text)
language sql
security definer
set search_path = public
stable
as $$
  select m.kulup_id, m.student_id, p.full_name, p.avatar_url, m.unvan, m.rol
  from public.kulup_uyelikleri m
  join public.profiles p on p.id = m.student_id
  where m.durum = 'aktif'
    and (m.rol = 'yonetici' or m.unvan is not null)
    and (p_kulup_id is null or m.kulup_id = p_kulup_id)
    and auth.uid() is not null
  order by (m.unvan = 'Başkan') desc, m.created_at asc;
$$;

commit;
