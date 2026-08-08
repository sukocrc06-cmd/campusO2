-- CampusO Staj Takip: akademik dönem alanları
-- Bu migration mevcut başvuruları silmez; tarihine göre dönem bilgisi ekler.

alter table public.stajlar
  add column if not exists period_id text,
  add column if not exists academic_year text,
  add column if not exists academic_term text;

update public.stajlar
set
  academic_year = case
    when extract(month from baslangic_tarihi::date) >= 9
      then extract(year from baslangic_tarihi::date)::int || '-' || (extract(year from baslangic_tarihi::date)::int + 1)
    else (extract(year from baslangic_tarihi::date)::int - 1) || '-' || extract(year from baslangic_tarihi::date)::int
  end,
  academic_term = case
    when extract(month from baslangic_tarihi::date) >= 9 then 'guz'
    when extract(month from baslangic_tarihi::date) <= 5 then 'bahar'
    else 'yaz'
  end
where baslangic_tarihi is not null
  and (academic_year is null or academic_term is null);

create index if not exists stajlar_period_id_idx on public.stajlar(period_id);
create index if not exists stajlar_academic_period_idx on public.stajlar(academic_year, academic_term);
