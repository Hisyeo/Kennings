CREATE TABLE Kenning (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  concept       TEXT NOT NULL,
  type          INT NOT NULL,
  definition    TEXT NOT NULL,
  isDeleted     INTEGER NOT NULL,
  createdOn     TEXT NOT NULL,
  deletedOn     TEXT,
  restoredOn    TEXT,
  lastUpdatedOn TEXT,
                FOREIGN KEY(type) REFERENCES DatabaseType(id)
);

CREATE TABLE KenningWord (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  kenning INTEGER NOT NULL,
  pos     INTEGER NOT NULL,
  word    INTEGER NOT NULL,
          FOREIGN KEY(kenning) REFERENCES Kenning(id)
);


CREATE TABLE HisyeoWord (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  latin         TEXT NOT NULL,
  abugida       TEXT NOT NULL,
  syllabary     TEXT NOT NULL,
  type          INTEGER NOT NULL,
                FOREIGN KEY(type) REFERENCES DatabaseType(id)
);

CREATE TABLE UserVote (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user    TEXT NOT NULL,
  kenning INTEGER NOT NULL,
  type    INTEGER NOT NULL,
  weight  INTEGER NOT NULL,
          FOREIGN KEY(kenning)  REFERENCES Kenning(id),
          FOREIGN KEY(type)     REFERENCES DatabaseType(id),
          UNIQUE(user, kenning) ON CONFLICT REPLACE
);

CREATE TABLE DatabaseType (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name  TEXT NOT NULL,
  name        TEXT NOT NULL,
  emoji       TEXT,
  description TEXT NOT NULL,
              UNIQUE(table_name, name) ON CONFLICT REPLACE
);