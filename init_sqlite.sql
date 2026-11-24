PRAGMA foreign_keys = ON;

-- Entidades de catalogo --

CREATE TABLE departamentos_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) <= 16)
);
CREATE TABLE municipios_ec (
    id   SERIAL PRIMARY KEY,
    departamento INTEGER NOT NULL REFERENCES departamentos_ec(id),
    name VARCHAR(19) NOT NULL
);

CREATE TABLE roles_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) <= 16)
);

CREATE TABLE perioricidad_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) <= 20)
);

CREATE TABLE tipos_beneficios_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) <= 50)
);

CREATE TABLE estados_programa_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) <= 22)
);

CREATE TABLE estados_cuentas_empresas_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) <= 10)
);

CREATE TABLE estados_incripciones_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) = 8)
);

-- Entidades de datos --

CREATE TABLE personas_ed (
    documento_unico         TEXT NOT NULL PRIMARY KEY
        CHECK (length(documento_unico) BETWEEN 1 AND 9 AND documento_unico NOT GLOB '*[^A-Z0-9]*'),
    is_dui                  INTEGER NOT NULL CHECK (is_dui IN (0, 1)),

    nombre                  TEXT NOT NULL CHECK (length(nombre) <= 250),
    apellido                TEXT NOT NULL CHECK (length(apellido) <= 250),
    departamento_residencia INTEGER NOT NULL REFERENCES departamentos_ec(id),
    municipio_residencia    INTEGER NOT NULL REFERENCES municipios_ec(id),
    nacimiento              TEXT NOT NULL CHECK (date(nacimiento) = nacimiento),
);

CREATE TABLE empresas_ed (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL CHECK (length(nombre) <= 250),
    campo  TEXT CHECK (length(campo) <= 250),
    estado INTEGER NOT NULL REFERENCES estados_cuentas_empresas_ec(id)
);

CREATE TABLE programas_ed (
    id                           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre                       TEXT NOT NULL CHECK (length(nombre) <= 250),
    entidad_responsable          INTEGER NOT NULL REFERENCES empresas_ed(id),
    estado                       INTEGER NOT NULL REFERENCES estados_programa_ec(id),
    tipo_beneficio               INTEGER NOT NULL REFERENCES tipos_beneficios_ec(id),
    descripcion_beneficio        TEXT,
    fecha_inicio                       TEXT CHECK (date(fecha_inicio) = fecha_inicio),
    fecha_final                        TEXT CHECK (date(fecha_final) = fecha_final),
    documentos_registro_requiere TEXT,
    perioricidad                 INTEGER NOT NULL REFERENCES perioricidad_ec(id),
    datos                        TEXT CHECK (json_valid(datos))
);

CREATE TABLE programas_departamentos_ep (
    departamento_id INTEGER NOT NULL REFERENCES departamentos_ec(id),
    programa_id     INTEGER NOT NULL REFERENCES programas_ed(id),
    PRIMARY KEY (departamento_id, programa_id)
);

CREATE TABLE cuentas_beneficiarios_ed (
    id                TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
              substr(hex(randomblob(2)), 2) || '-' ||
              substr('89ab', abs(random()) % 4 + 1, 1) ||
              substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
    ),
    persona_documento TEXT NOT NULL REFERENCES personas_ed(documento_unico),
    contraseña_hash TEXT,
    telefono TEXT,
    email TEXT,
    estado            INTEGER NOT NULL REFERENCES estados_cuentas_empresas_ec(id),
    datos             TEXT CHECK (json_valid(datos))
);

CREATE TABLE cuentas_staff_ed (
    id                TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
              substr(hex(randomblob(2)), 2) || '-' ||
              substr('89ab', abs(random()) % 4 + 1, 1) ||
              substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
    ),
    persona_documento TEXT NOT NULL REFERENCES personas_ed(documento_unico),
    contraseña_hash TEXT,
    telefono TEXT,
    email TEXT,
    rol               INTEGER NOT NULL REFERENCES roles_ec(id),
    empresa           INTEGER NOT NULL REFERENCES empresas_ed(id),
    estado            INTEGER NOT NULL REFERENCES estados_cuentas_empresas_ec(id)
);

CREATE TABLE inscripciones_ed (
    usuario_id      TEXT NOT NULL REFERENCES cuentas_beneficiarios_ed(id),
    programa_id     INTEGER NOT NULL REFERENCES programas_ed(id),
    datos           TEXT CHECK (json_valid(datos)),
    fecha_solicitud TEXT CHECK (date(fecha_solicitud) = fecha_solicitud),
    estado          INTEGER NOT NULL REFERENCES estados_incripciones_ec(id),
    PRIMARY KEY (usuario_id, programa_id)
);

-- mini log --
CREATE TABLE tiny_log (
    is_staff            BOOLEAN, 
    staff_actor         TEXT REFERENCES cuentas_staff_ed(id),
    beneficiario_actor  TEXT REFERENCES cuentas_beneficiarios_ed(id),
    action_description  TEXT NOT NULL CHECK (length(name) <= 250),

    CONSTRAINT chk_actor_type CHECK (
        (is_staff = 1 AND staff_actor        IS NOT NULL AND beneficiario_actor IS NULL) OR
        (is_staff = 0 AND beneficiario_actor IS NOT NULL AND staff_actor        IS NULL)
    )
);

-- Inserts de catalogos --
INSERT INTO departamentos_ec (name) VALUES ('Ahuachapán'),('Cabañas'),('Chalatenango'),('Cuscatlán'),('La Libertad'),('Morazán'),('La Paz'),('Santa Ana'),('San Miguel'),('San Salvador'),('San Vicente'),('Sonsonate'),('La Unión'),('Usulután');
INSERT INTO municipios_ec (departamento, name) VALUES (1,'Ahuachapán Norte'),(1,'Ahuachapán Centro'),(1,'Ahuachapán Sur'),(2,'Cabañas Este'),(2,'Cabañas Oeste'),(3,'Chalatenango Norte'),(3,'Chalatenango Centro'),(3,'Chalatenango Sur'),(4,'Cuscatlán Norte'),(4,'Cuscatlán Sur'),(5,'La Libertad Norte'),(5,'La Libertad Centro'),(5,'La Libertad Oeste'),(5,'La Libertad Este'),(5,'La Libertad Costa'),(5,'La Libertad Sur'),(7,'La Paz Oeste'),(7,'La Paz Centro'),(7,'La Paz Este'),(13,'La Unión Norte'),(13,'La Unión Sur'),(6,'Morazán Norte'),(6,'Morazán Sur'),(9,'San Miguel Norte'),(9,'San Miguel Centro'),(9,'San Miguel Oeste'),(10,'San Salvador Norte'),(10,'San Salvador Oeste'),(10,'San Salvador Este'),(10,'San Salvador Centro'),(10,'San Salvador Sur'),(11,'San Vicente Norte'),(11,'San Vicente Sur'),(8,'Santa Ana Norte'),(8,'Santa Ana Centro'),(8,'Santa Ana Este'),(8,'Santa Ana Oeste'),(12,'Sonsonate Norte'),(12,'Sonsonate Centro'),(12,'Sonsonate Este'),(12,'Sonsonate Oeste'),(14,'Usulután Norte'),(14,'Usulután Este'),(14,'Usulután Oeste');
INSERT INTO estados_cuentas_empresas_ec (name) VALUES ('activa'),('inactivada'),('eliminada');
INSERT INTO estados_incripciones_ec (name) VALUES ('enespera'),('denegada'),('aprovada');
INSERT INTO estados_programa_ec (name) VALUES ('activo'),('cancelado_incompletado'),('finalizado'),('eliminado');
INSERT INTO perioricidad_ec (name) VALUES ('Una vez'),('Diaria'),('Semanal'),('Mensual'),('Trimestral'),('Anual');
INSERT INTO roles_ec (name) VALUES ('admin'),('empresa_admin'),('operador'),('empresa_operador');