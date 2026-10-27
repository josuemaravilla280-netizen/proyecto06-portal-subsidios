CREATE TABLE 







CREATE TABLE persona (
    id UUID UNIQUE PRIMARY KEY DEFAULT gen_random_uuid(),
    dui NUM()  UNIQUE,
    pasaporte TEXT UNIQUE,
    CONSTRAINT documento_requerido CHECK (dui IS NOT NULL OR pasaporte IS NOT NULL)
);
-- añadir
-- INSERT INTO persona VALUES ()

CREATE TABLE usr_beneficiario (
    id UUID UNIQUE PRIMARY KEY DEFAULT gen_random_uuid(),
    FOREIGN KEY (id_persona) REFERENCES persona(id)
);
CREATE TABLE usr_operador (
    id UUID UNIQUE PRIMARY KEY DEFAULT gen_random_uuid(),
    FOREIGN KEY (id_persona) REFERENCES persona(id)
);


CREATE TABLE registro_en_programa(

)