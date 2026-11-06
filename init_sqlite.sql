PRAGMA foreign_keys = ON;

CREATE TABLE departamentos_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(16) NOT NULL CHECK (length(name) <= 16)
);

CREATE TABLE roles_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(16) NOT NULL CHECK (length(name) <= 16)
);

CREATE TABLE perioricidad_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(20) NOT NULL CHECK (length(name) <= 20)
);

CREATE TABLE estados_programa_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(22) NOT NULL CHECK (length(name) <= 22)
);

CREATE TABLE estados_cuentas_empresas_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(10) NOT NULL CHECK (length(name) <= 10)
);

CREATE TABLE estados_incripciones_ec (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name CHAR(8) NOT NULL CHECK (length(name) = 8)
);

CREATE TABLE personas_ed (
    documento_unico         TEXT NOT NULL PRIMARY KEY
        CHECK (length(documento_unico) BETWEEN 1 AND 9 AND documento_unico NOT GLOB '*[^A-Z0-9]*'),
    is_dui                  INTEGER NOT NULL CHECK (is_dui IN (0, 1)),

    nombre                  VARCHAR(250) NOT NULL CHECK (length(nombre) <= 250),
    apellido                VARCHAR(250) NOT NULL CHECK (length(apellido) <= 250),
    departamento_residencia INTEGER NOT NULL REFERENCES departamentos_ec(id),
    nacimiento              TEXT NOT NULL CHECK (date(nacimiento) = nacimiento),
);

CREATE TABLE empresas_ed (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(250) NOT NULL CHECK (length(nombre) <= 250),
    campo  VARCHAR(250) CHECK (length(campo) <= 250),
    estado INTEGER NOT NULL REFERENCES estados_cuentas_empresas_ec(id)
);

CREATE TABLE programas_ed (
    id                           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre                       VARCHAR(250) NOT NULL CHECK (length(nombre) <= 250),
    entidad_responsable          INTEGER NOT NULL REFERENCES empresas_ed(id),
    estado                       INTEGER NOT NULL REFERENCES estados_programa_ec(id),
    tipo_beneficio               TEXT,
    descripcion_beneficio        TEXT,
    inicio                       TEXT CHECK (date(inicio) = inicio),
    "final"                      TEXT CHECK (date("final") = "final"),
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
