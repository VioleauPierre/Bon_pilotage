-- En lecture seule. Vérifier les résultats avant toute migration.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('bon_pilotage_submissions', 'bon_pilotage_memory_values', 'bon_pilotage_pilot_profiles')
order by table_name, ordinal_position;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename like 'bon_pilotage_%';

select relname, relrowsecurity as rls_active
from pg_class
where relnamespace = 'public'::regnamespace and relname like 'bon_pilotage_%'
  and relkind = 'r';

select count(*) as groupes_de_numeros_reutilises, coalesce(sum(occurrences), 0) as bons_concernes
from (
  select count(*) as occurrences
  from public.bon_pilotage_submissions
  group by bon_number
  having count(*) > 1
) duplicates;
