CREATE TABLE Kenning (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  concept    TEXT NOT NULL,
  type       INT  NOT NULL DEFAULT 15,
  definition TEXT NOT NULL,
  createdBy  TEXT NOT NULL,
  createdOn  DATETIME NOT NULL DEFAULT (datetime(CURRENT_TIMESTAMP, 'localtime')),
  modifiedOn DATETIME NOT NULL DEFAULT (datetime(CURRENT_TIMESTAMP, 'localtime')),
             FOREIGN KEY(type) REFERENCES DatabaseType(id)
);

CREATE TABLE KenningWord (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  kenning INTEGER NOT NULL,
  version INTEGER NOT NULL,
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
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kenning    INTEGER NOT NULL,
  type       INTEGER NOT NULL DEFAULT 18, -- std
  weight     INTEGER NOT NULL,
  createdBy  TEXT NOT NULL,
  createdOn  DATETIME NOT NULL DEFAULT (datetime(CURRENT_TIMESTAMP, 'localtime')),
  modifiedOn DATETIME NOT NULL DEFAULT (datetime(CURRENT_TIMESTAMP, 'localtime')),
             FOREIGN KEY(kenning)  REFERENCES Kenning(id),
             FOREIGN KEY(type)     REFERENCES DatabaseType(id),
             UNIQUE(createdBy, kenning) ON CONFLICT REPLACE
);

CREATE TABLE DatabaseType (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name  TEXT NOT NULL,
  name        TEXT NOT NULL,
  emoji       TEXT,
  description TEXT NOT NULL,
              UNIQUE(table_name, name) ON CONFLICT REPLACE
);