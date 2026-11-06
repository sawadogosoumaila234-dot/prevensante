-- migration 0010 — fonctions helper RLS — <source: section 7.1>
create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.current_site_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select site_id from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.current_organization_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select organization_id from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

create or replace function public.is_hse()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.current_role() in ('hse_officer','supervisor','site_director'), false);
$$;

create or replace function public.can_access_site(p_site uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_admin()
      or exists (
        select 1
        from public.profiles p
        join public.sites s on s.id = p_site
        where p.id = auth.uid() and p.is_active
          and (
            p.site_id = p_site
            or (p.organization_id = s.organization_id
                and p.role in ('hse_officer','site_director','occupational_physician'))
          )
      );
$$;

create or replace function public.can_manage_site(p_site uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_admin()
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid() and p.is_active
          and p.site_id = p_site
          and p.role in ('hse_officer','supervisor')
      );
$$;

create or replace function public.can_view_medical(p_event uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_admin()
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid() and p.is_active
          and (
            p.role = 'occupational_physician'
            or (p.role = 'hse_officer'
                and p.is_medical_authorized
                and exists (select 1 from public.safety_events e
                            where e.id = p_event and e.site_id = p.site_id))
          )
      );
$$;

create or replace function public.can_verify_action(p_action uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_admin()
      or exists (
        select 1
        from public.corrective_actions a
        join public.safety_events e on e.id = a.event_id
        where a.id = p_action
          and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.is_active
              and p.role in ('hse_officer','site_director')
              and (p.site_id = e.site_id or p.organization_id = (
                    select organization_id from public.sites where id = e.site_id))
          )
      );
$$;

create or replace function public.is_action_owner(p_action uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.corrective_actions a
    where a.id = p_action and a.owner_id = auth.uid()
  );
$$;
