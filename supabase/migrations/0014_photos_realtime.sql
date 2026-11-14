-- ============================================================================
-- 0014_photos_realtime.sql
--
-- Extend the owner realtime invalidation broadcast (from 0011) to the private
-- photo album tables. When the owner uploads, deletes or renames a photo, or
-- toggles the album on/off / rotates the album password, the dashboard's
-- live-sync channel receives a metadata-only invalidation so other open tabs
-- refresh. Row contents never enter Realtime.
--
-- The visitor album does NOT rely on this broadcast (visitors are anonymous and
-- cannot subscribe to the private owner channel); it uses its own SSE stream
-- that polls get_granted_photos(). This migration only covers the dashboard.
-- ============================================================================

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'private_photos',
    'owner_secrets'
  ]
  loop
    execute format(
      'drop trigger if exists owner_realtime_invalidation on public.%I',
      table_name
    );
    execute format(
      'create trigger owner_realtime_invalidation ' ||
      'after insert or update or delete on public.%I ' ||
      'for each row execute function public.broadcast_owner_invalidation()',
      table_name
    );
  end loop;
end;
$$;
