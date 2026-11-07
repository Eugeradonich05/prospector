-- Permisos explícitos para la clave secreta (service_role), que es la que usa el panel desde el servidor.
-- En algunos proyectos nuevos de Supabase las tablas creadas desde el SQL Editor no quedan expuestas
-- a la Data API y el panel muestra «permission denied for table prospectos».
-- La clave pública (anon) sigue sin acceso: ver revoke en las migraciones anteriores.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.hoy_ar() to service_role;
