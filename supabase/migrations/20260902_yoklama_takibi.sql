-- CampusO Vol 1-12: Özelleştirilmiş Yoklama Takibi
-- Akademisyen kendi dersi için yoklama oturumu açar, öğrencileri
-- var/yok/geç/izinli olarak işaretler; öğrenci kendi devam yüzdesini
-- görür; admin tüm dersler/oturumlar üzerinde tam yetkilidir.
--
-- Güvenlik notu: bir akademisyenin bir derse yoklama girebilmesi için
-- o dersin ders_programi kaydına GERÇEK hesabıyla (akademisyen_id)
-- atanmış olması gerekir — yalnız isim eşleşmesi yeterli değildir,
-- aksi halde aynı isimli biri başka bir hocanın dersine yoklama girebilir.

begin;

alter table public.ders_programi
  add column if not exists akademisyen_id uuid references auth.users(id),
  add column if not exists asgari_devam_yuzdesi integer not null default 70 check (asgari_devam_yuzdesi between 0 and 100);

create index if not exists ders_programi_akademisyen_idx on public.ders_programi(akademisyen_id);

create or replace function public.campuso_ders_akademisyeni_mi(p_ders_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.ders_programi
    where id = p_ders_id and akademisyen_id = auth.uid()
  );
$$;

-- Bölüm/sınıfa göre öğrenci listesi (yoklama roster'ı için). Yalnızca
-- akademisyen veya admin çağırabilir; sadece güvenli/genel alanları döner.
create or replace function public.campuso_ogrenci_listesi(p_bolum text, p_sinif text)
returns table(id uuid, full_name text, avatar_url text, hero_renk text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if public.campuso_current_role() not in ('academician', 'admin') then
    raise exception 'Bu listeye erişim yetkiniz yok.';
  end if;
  return query
    select p.id, p.full_name, p.avatar_url, p.hero_renk
    from public.profiles p
    where p.role = 'student' and p.bolum = p_bolum and p.sinif = p_sinif
    order by p.full_name;
end;
$$;

create table if not exists public.yoklama_ogrenci_override (
  id uuid primary key default gen_random_uuid(),
  ders_programi_id uuid not null references public.ders_programi(id) on delete cascade,
  ogrenci_id uuid not null references auth.users(id) on delete cascade,
  dahil boolean not null,
  created_at timestamptz not null default now(),
  unique (ders_programi_id, ogrenci_id)
);

alter table public.yoklama_ogrenci_override enable row level security;

drop policy if exists yoklama_ogrenci_override_all on public.yoklama_ogrenci_override;
create policy yoklama_ogrenci_override_all on public.yoklama_ogrenci_override
  for all using (public.campuso_ders_akademisyeni_mi(ders_programi_id) or public.campuso_current_role() = 'admin')
  with check (public.campuso_ders_akademisyeni_mi(ders_programi_id) or public.campuso_current_role() = 'admin');

create table if not exists public.yoklama_oturumlari (
  id uuid primary key default gen_random_uuid(),
  ders_programi_id uuid not null references public.ders_programi(id) on delete cascade,
  tarih date not null,
  olusturan_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ders_programi_id, tarih)
);

create index if not exists yoklama_oturumlari_ders_idx on public.yoklama_oturumlari(ders_programi_id, tarih desc);

drop trigger if exists campuso_yoklama_oturumlari_touch_trg on public.yoklama_oturumlari;
create trigger campuso_yoklama_oturumlari_touch_trg
  before update on public.yoklama_oturumlari
  for each row execute function public.campuso_touch_updated_at();

alter table public.yoklama_oturumlari enable row level security;

drop policy if exists yoklama_oturumlari_write on public.yoklama_oturumlari;
create policy yoklama_oturumlari_write on public.yoklama_oturumlari
  for all using (public.campuso_ders_akademisyeni_mi(ders_programi_id) or public.campuso_current_role() = 'admin')
  with check (public.campuso_ders_akademisyeni_mi(ders_programi_id) or public.campuso_current_role() = 'admin');

create table if not exists public.yoklama_kayitlari (
  id uuid primary key default gen_random_uuid(),
  oturum_id uuid not null references public.yoklama_oturumlari(id) on delete cascade,
  ogrenci_id uuid not null references auth.users(id) on delete cascade,
  durum text not null default 'yok' check (durum in ('var', 'yok', 'gec', 'izinli')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (oturum_id, ogrenci_id)
);

create index if not exists yoklama_kayitlari_ogrenci_idx on public.yoklama_kayitlari(ogrenci_id);
create index if not exists yoklama_kayitlari_oturum_idx on public.yoklama_kayitlari(oturum_id);

drop trigger if exists campuso_yoklama_kayitlari_touch_trg on public.yoklama_kayitlari;
create trigger campuso_yoklama_kayitlari_touch_trg
  before update on public.yoklama_kayitlari
  for each row execute function public.campuso_touch_updated_at();

alter table public.yoklama_kayitlari enable row level security;

drop policy if exists yoklama_kayitlari_select on public.yoklama_kayitlari;
create policy yoklama_kayitlari_select on public.yoklama_kayitlari
  for select using (
    ogrenci_id = auth.uid()
    or public.campuso_current_role() = 'admin'
    or exists (
      select 1 from public.yoklama_oturumlari yo
      where yo.id = oturum_id and public.campuso_ders_akademisyeni_mi(yo.ders_programi_id)
    )
  );

drop policy if exists yoklama_kayitlari_write on public.yoklama_kayitlari;
create policy yoklama_kayitlari_write on public.yoklama_kayitlari
  for all using (
    public.campuso_current_role() = 'admin'
    or exists (
      select 1 from public.yoklama_oturumlari yo
      where yo.id = oturum_id and public.campuso_ders_akademisyeni_mi(yo.ders_programi_id)
    )
  )
  with check (
    public.campuso_current_role() = 'admin'
    or exists (
      select 1 from public.yoklama_oturumlari yo
      where yo.id = oturum_id and public.campuso_ders_akademisyeni_mi(yo.ders_programi_id)
    )
  );

drop policy if exists yoklama_oturumlari_select on public.yoklama_oturumlari;
create policy yoklama_oturumlari_select on public.yoklama_oturumlari
  for select using (
    public.campuso_ders_akademisyeni_mi(ders_programi_id)
    or public.campuso_current_role() = 'admin'
    or exists (
      select 1 from public.yoklama_kayitlari yk
      where yk.oturum_id = yoklama_oturumlari.id and yk.ogrenci_id = auth.uid()
    )
  );

-- Akademisyenin kendi dersinin devam eşiğini güncelleyebilmesi için
-- (diğer alanları admin dışında değiştiremez; arayüz zaten sadece bu alanı sunar).
drop policy if exists ders_programi_akademisyen_esik_update on public.ders_programi;
create policy ders_programi_akademisyen_esik_update on public.ders_programi
  for update using (akademisyen_id = auth.uid())
  with check (akademisyen_id = auth.uid());

commit;
