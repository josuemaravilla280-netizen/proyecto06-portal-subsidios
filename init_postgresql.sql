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
    estado          INTEGER NOT NULL REFERENCES estados_cuentas_empresas_ec(id),
    datos           JSONB
);

CREATE TABLE cuentas_staff_ed (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_documento TEXT NOT NULL REFERENCES personas_ed(documento_unico)
    contraseña_hash TEXT,
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

-- Inserts de catalogos --
INSERT INTO departamentos_ec (name) VALUES ('Ahuachapán'),('Cabañas'),('Chalatenango'),('Cuscatlán'),('La Libertad'),('Morazán'),('La Paz'),('Santa Ana'),('San Miguel'),('San Salvador'),('San Vicente'),('Sonsonate'),('La Unión'),('Usulután');
INSERT INTO estados_cuentas_empresas_ec (name) VALUES ('activa'),('inactivada'),('eliminada');
INSERT INTO estados_incripciones_ec (name) VALUES ('enespera'),('denegada'),('aprovada');
INSERT INTO estados_programa_ec (name) VALUES ('activo'),('cancelado_incompletado'),('finalizado'),('eliminado');
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