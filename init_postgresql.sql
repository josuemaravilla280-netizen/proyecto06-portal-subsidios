-- Entidades de catalogo --
CREATE TABLE departamentos_ec (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(16) NOT NULL
);

CREATE TABLE roles_ec (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(16) NOT NULL
);

CREATE TABLE perioricidad_ec (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL
);

CREATE TABLE tipos_beneficios_ec (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE estados_programa_ec (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(22) NOT NULL
);

CREATE TABLE estados_cuentas_empresas_ec (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(10) NOT NULL
);

CREATE TABLE estados_incripciones_ec (
    id   SERIAL PRIMARY KEY,
    name CHAR(8) NOT NULL
);

-- Entidades de datos --

CREATE TABLE personas_ed (
    documento_unico         TEXT PRIMARY KEY CHECK (documento_unico ~ '^[A-Z0-9]{1,9}$'),
    is_dui                  BOOLEAN NOT NULL,

    nombre                  VARCHAR(250) NOT NULL,
    apellido                VARCHAR(250) NOT NULL,
    departamento_residencia INTEGER NOT NULL REFERENCES departamentos_ec(id),
    nacimiento              DATE NOT NULL
);

CREATE TABLE empresas_ed (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(250) NOT NULL,
    campo  VARCHAR(250),
    estado INTEGER NOT NULL REFERENCES estados_cuentas_empresas_ec(id)
);

CREATE TABLE programas_ed (
    id                           SERIAL PRIMARY KEY,
    nombre                       VARCHAR(250) NOT NULL,
    entidad_responsable          INTEGER NOT NULL REFERENCES empresas_ed(id),
    estado                       INTEGER NOT NULL REFERENCES estados_programa_ec(id),
    tipo_beneficio               INTEGER NOT NULL REFERENCES tipos_beneficios_ec(id),
    descripcion_beneficio        TEXT,
    fecha_inicio                 DATE,
    fecha_final                  DATE,
    documentos_registro_requiere TEXT,
    perioricidad                 INTEGER NOT NULL REFERENCES perioricidad_ec(id),
    datos                        JSONB
);

CREATE TABLE programas_departamentos_ep (
    departamento_id INTEGER NOT NULL REFERENCES departamentos_ec(id),
    programa_id     INTEGER NOT NULL REFERENCES programas_ed(id),
    PRIMARY KEY (departamento_id, programa_id)
);

CREATE TABLE cuentas_beneficiarios_ed (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_documento TEXT NOT NULL REFERENCES personas_ed(documento_unico),
    contraseña_hash TEXT,
    telefono TEXT,
    email TEXT,
    estado          INTEGER NOT NULL REFERENCES estados_cuentas_empresas_ec(id),
    datos           JSONB
);

CREATE TABLE cuentas_staff_ed (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_documento TEXT NOT NULL REFERENCES personas_ed(documento_unico)
    contraseña_hash TEXT,
    telefono TEXT,
    email TEXT,
    rol               INTEGER NOT NULL REFERENCES roles_ec(id),
    empresa           INTEGER NOT NULL REFERENCES empresas_ed(id),
    estado            INTEGER NOT NULL REFERENCES estados_cuentas_empresas_ec(id)
);

CREATE TABLE inscripciones_ed (
    usuario_id      UUID NOT NULL REFERENCES cuentas_beneficiarios_ed(id),
    programa_id     INTEGER NOT NULL REFERENCES programas_ed(id),
    datos           JSONB,
    fecha_solicitud DATE,
    estado          INTEGER NOT NULL REFERENCES estados_incripciones_ec(id),
    PRIMARY KEY (usuario_id, programa_id)
);

-- mini log --
CREATE TABLE tiny_log(
    is_staff           BOOLEAN,
    staff_actor        UUID REFERENCES cuentas_staff_ed(id),
    beneficiario_actor UUID REFERENCES cuentas_beneficiarios_ed(id),
	action_description NOT NULL VARCHAR(250)

    CONSTRAINT chk_actor_type CHECK (
        (is_staff = true AND staff_actor IS NOT NULL AND beneficiario_actor IS NULL) OR
        (is_staff = false  AND beneficiario_actor IS NOT NULL AND staff_actor IS NULL)
    )
);

-- Inserts de catalogos --
INSERT INTO departamentos_ec (name) VALUES ('Ahuachapán'),('Cabañas'),('Chalatenango'),('Cuscatlán'),('La Libertad'),('Morazán'),('La Paz'),('Santa Ana'),('San Miguel'),('San Salvador'),('San Vicente'),('Sonsonate'),('La Unión'),('Usulután');
INSERT INTO estados_cuentas_empresas_ec (name) VALUES ('activa'),('inactivada'),('eliminada');
INSERT INTO estados_incripciones_ec (name) VALUES ('enespera'),('denegada'),('aprovada');
INSERT INTO estados_programa_ec (name) VALUES ('activo'),('cancelado_incompletado'),('finalizado'),('eliminado');
INSERT INTO tipos_beneficios_ec (name) VALUES ('Insumos agrícolas'),('Becas'),('Apoyo para vivienda'),('Recursos humanitarios'),('Apoyo económico'),('Vales de transporte'),('Canasta básica');
INSERT INTO perioricidad_ec (name) VALUES ('Una vez'),('Diaria'),('Semanal'),('Mensual'),('Trimestral'),('Anual');
INSERT INTO roles_ec (name) VALUES ('admin'),('empresa_admin'),('operador'),('empresa_operador');
-- Usuario para el servidor --
CREATE ROLE server_user WITH LOGIN PASSWORD 'server_user';

GRANT CONNECT ON DATABASE test TO server_user;
GRANT USAGE ON SCHEMA public TO server_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO server_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO server_user;
    -- Para tablas y secuencias creadas después --
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO server_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO server_user;


--Test--
INSERT INTO empresas_ed (nombre,campo,estado) VALUES ('gob','Estado',1)
INSERT INTO personas_ed
    (documento_unico, is_dui, nombre, apellido, departamento_residencia, nacimiento)
VALUES
    ('000000000', true, 'Administrador', 'PENDIENTE', 1, '1900-01-01'),
    ('111111111', true, 'Operador',      'PENDIENTE', 1, '1900-01-01'),
    ('222222222', true, 'Beneficiario',  'PENDIENTE', 1, '1900-01-01');
	
INSERT INTO cuentas_staff_ed
    (persona_documento, contraseña_hash, rol, empresa, estado)
VALUES
    ('000000000', '$2b$12$Mb5PjwALepi678TUXXcD0eBPUv.TE09155wkSoazTAPWpg7xBEoxG', 1, 1, 1),  -- Administrador
    ('111111111', '$2b$12$uOxl2VbBdjhH6EroHsMlh.c0HxVLgJJfRLJxyxCuPd7koygbbiJDq', 3, 1, 1);  -- Operador

	INSERT INTO cuentas_beneficiarios_ed
    (persona_documento, contraseña_hash, estado)
VALUES
    ('222222222',
     '$2b$12$kQICOKRmZQtA/aYUGIeTv.W3RNv.S4MqOUGrd.4yg1B8YifnakVky',
     1);

INSERT INTO tipos_beneficios_ec (name) VALUES
  ('Insumos agrícolas'),
  ('Becas'),
  ('Apoyo para vivienda'),
  ('Recursos humanitarios'),
  ('Apoyo económico'),
  ('Vales de transporte'),
  ('Canasta básica');

WITH nuevo AS (
  INSERT INTO programas_ed
    (nombre, entidad_responsable, estado, tipo_beneficio, descripcion_beneficio,
     fecha_inicio, fecha_final, perioricidad, documentos_registro_requiere, datos)
  VALUES (
    'programa test',
	1,
	1,
    (SELECT id FROM tipos_beneficios_ec WHERE name   = 'Insumos agrícolas'),
    'test insumos agricolas',
    '2026-01-15',
    '2026-12-15',
    1,
    'TEST DOCUMENTOS REQUERIDOS',
    '{
      "cantidad": 1,
      "unidad": "Paquete / kit",
      "cupos": 250,
      "monto": 0,
      "clave_correlativa": "PRG-AGR-02-001",
      "composicion": "Semillas, fertilizante y herramientas básicas.",
      "periodo": "Campaña 2026",
      "criterios": ["unidad", "residencia", "declaracion", "consentimiento"]
    }'::jsonb
  )
  RETURNING id
)
INSERT INTO programas_departamentos_ep (programa_id, departamento_id)
SELECT nuevo.id, d.id
FROM nuevo
JOIN departamentos_ec d ON d.name IN ('San Miguel', 'Usulután', 'La Paz');
