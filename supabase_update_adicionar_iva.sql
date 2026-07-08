-- SCRIPT DE ACTUALIZACIÓN DE BASE DE DATOS PARA SUPABASE
-- Este script agrega de forma segura la columna "adicionar_iva" a la tabla de "rooms" si aún no existe.
-- Ejecute este script directamente en el SQL Editor de su panel de Supabase.

DO $$
BEGIN
    -- Verificar si la columna ya existe en la tabla "rooms" de la base de datos pública o por defecto
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'rooms' 
          AND column_name = 'adicionar_iva'
    ) THEN
        -- Agregar la columna con valor por defecto "true"
        ALTER TABLE public.rooms ADD COLUMN adicionar_iva BOOLEAN NOT NULL DEFAULT TRUE;
        
        -- Emitir mensaje informativo
        RAISE NOTICE 'Columna "adicionar_iva" agregada con éxito a la tabla rooms.';
    ELSE
        RAISE NOTICE 'La columna "adicionar_iva" ya existe en la tabla rooms. No se requiere acción.';
    END IF;
END $$;
