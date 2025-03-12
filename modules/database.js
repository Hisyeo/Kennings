import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import sqlite3 from 'sqlite3';
import { open as dbWrapper } from 'sqlite';

// Enable verbose / debug mode
sqlite3.verbose();

const DB_FILE = "./.data/kennings-v05.db";

export default class Database {
  sqlite;
  
  constructor() {
    
  }
  
  async initialize() {
    
    const exists = fs.existsSync(DB_FILE);
    console.log(`Database file "${DB_FILE}"`, "exists?", exists);
    
    this.sqlite = await dbWrapper({
      filename: DB_FILE,
      driver: sqlite3.Database,
    })
  
    try {
      
      await this.sqlite.exec(
          `PRAGMA journal_mode = wal; -- different implementation of the atomicity properties
           PRAGMA synchronous = normal; -- synchronise less often to the filesystem
           PRAGMA foreign_keys = on; -- check foreign key reference, slightly worst performance`
      )

      
      if (!exists) {
        console.log(`Applying initial migration...`);
        await this.sqlite.exec('BEGIN TRANSACTION');
        try {
          const script = await readFile('./migrations/0001-init.sql', { encoding: 'utf8' });
          await this.sqlite.exec(script);
          await this.sqlite.exec('COMMIT');
          await this.sqlite.exec('PRAGMA user_version = 1;');
          console.log(`Applied initial migration successfully`)
        } catch (err) {
          await this.sqlite.exec('ROLLBACK');
          await this.sqlite.exec('PRAGMA user_version = 0;');
          throw err;
        }
        
      }
      
      const currentVersion = (await this.sqlite.get('PRAGMA user_version;')).user_version;
      console.log(`Database User Version: ${currentVersion}`)

    } catch (dbError) {
      console.error(dbError);
    }
    
    return this.sqlite;
  }
  
  /*
   * Return everything in the Kennings table
   * Throw an error in case of db connection issues
   */
  async getRecentPublishedKennings() {
    console.debug(`getRecentPublishedKennings ()`);
    try { return await this.sqlite.all(
      `SELECT
        k.id,
        k.concept,
        k.definition,
        k.createdOn,
        w.abugida,
        w.latin,
        w.syllabary,
        dt.name AS kind
      FROM KenningWord                           kw
      INNER JOIN HisyeoWord                       w ON w.id = kw.word
      INNER JOIN (SELECT * FROM Kenning LIMIT 5)  k ON kw.kenning = k.id
      INNER JOIN DatabaseType                    dt ON w.type = dt.id
      WHERE k.type = 17
      AND   kw.version = (SELECT MAX(version) FROM KenningWord WHERE kenning = k.id)
      ORDER BY k.concept, kw.id ASC`
    ) }
    catch (dbError) { console.error(dbError) }
  }
  
  /**
   * Get all kennings for a matching concept
   * 
   * concept {string} A panlexia concept id
   *
   * Return a joined list of kennings and time fields from all records in the Kennings and Actions tables
   */
  async getKennings(concepts) {
    console.debug(`getKennings concepts: ${concepts}`);
    try { return await this.sqlite.all(
      `SELECT
        k.id,
        k.concept,
        k.definition,
        k.createdOn,
        k.createdBy,
        w.abugida,
        w.latin,
        w.syllabary,
        dt.name AS kind
       FROM Kenning     k
       JOIN KenningWord kw ON k.id = kw.kenning
       JOIN HisyeoWord  w  ON w.id = kw.word
       INNER JOIN DatabaseType dt ON w.type = dt.id
       WHERE k.concept IN (${concepts.map(c => `'${c}'`)})
       AND   k.type = 17 -- published
       AND   kw.version = (
         SELECT MAX(version) FROM KenningWord WHERE kenning = k.id
       )`
    ) } catch (dbError) { console.error(dbError) }
  }
  
 /**
   * Get sums of all votes for a kenning id by type
   * 
   * id {string} A kenning key
   *
   * Return a list of all vote sums by type
   */
  async getKenningsVotes(ids) {
    console.debug(`getKenningVotes ids: ${ids}`);
    try { return await this.sqlite.all(
      `SELECT kenning, dt.emoji, dt.name, dt.description, SUM(weight) as total
       FROM UserVote
       JOIN DatabaseType dt ON type = dt.id
       WHERE kenning IN (${ids.join(', ')})
       GROUP BY kenning, type;`);
    } catch (dbError) { console.error(dbError) }
  }
  
  /**
   * Grab a single kenning from the database for editing
   *
   * Return whether op was successful or not
   * Loh an error in case of db connection issues
   */
  async editKenning(id) {
    try {
      return await this.sqlite.all("SELECT * FROM Kennings WHERE id = ?", id);
    } catch (dbError) { console.error(dbError) }
  }
  
  /**
   * Save a kenning edit to the database
   *
   * Return whether op was successful or not
   * Loh an error in case of db connection issues
   */
  async saveKenning(id, english, hisyeo, html) {
    const now = new Date().toISOString();
    try {
      console.debug(`Updating id ${id} in Kennings table...`);
      await this.sqlite.all("UPDATE Kennings SET english = ?, hisyeo = ?, html = ?, lastUpdatedOn = ? WHERE id = ?", english, hisyeo, html, now, id);
      return true
    } catch (dbError) {
      // Database connection error
      console.error(dbError);
      return false
    }
  }
  
  
  /**
   * Unpublish a kenning from the database
   *
   * Return whether op was successful or not
   * Loh an error in case of db connection issues
   */
  async unpublishKenning(id) {
    const now = new Date().toISOString();
    try {
      await this.sqlite.all("UPDATE Kenning SET type = 16, modifiedOn = ? WHERE id = ?", now, id);
      return true
    } catch (dbError) {
      console.error(dbError);
      return false
    }
  }

  /**
   * Delete a kenning from the database
   *
   * Return whether op was successful or not
   * Loh an error in case of db connection issues
   */
  async restoreKenning(id) {
    const now = new Date().toISOString();
    try {
      await this.sqlite.all("UPDATE Kennings SET isDeleted = FALSE, restoredOn = ?, lastUpdatedOn = ? WHERE id = ?", now, now, id);
      return true
    } catch (dbError) {
      console.error(dbError);
      return false
    }
  }
  
  /**
   * Get all Hîsyêô words from a text
   * 
   * text {string} A Hîsyêô text that needs to be parsed and converted to word IDs
   *
   * Return a list of ids and text (if no word is found, the text value is provided instead)
   */
  async getWords(text) {
    console.debug(`getWords text: ${text}`);
    const tokens = [...text.matchAll(/[a-zôêîû]+|[^a-zôêîû]/gi)]
      .filter(t => !(t == undefined || t == null || t == ' '))
      .map((t, i) => `(${i}, '${t}')`);
    console.debug('getWords> tokens =', tokens);
    try { return await this.sqlite.all(
      `WITH ParsedWord (id, value) AS (VALUES ${tokens.join(', ')})
       SELECT w.id, pw.value
       FROM HisyeoWord  w
       RIGHT JOIN ParsedWord pw ON w.latin = pw.value
       ORDER BY pw.id ASC`
    ) } catch (dbError) { console.error(dbError) }
  }
  
  // CREATE TABLE Kenning (
  //   id         INTEGER PRIMARY KEY AUTOINCREMENT,
  //   concept    TEXT NOT NULL,
  //   type       INT  NOT NULL DEFAULT 15,
  //   definition TEXT NOT NULL,
  //   createdBy  TEXT NOT NULL,
  //   createdOn  DATETIME NOT NULL DEFAULT (datetime(CURRENT_TIMESTAMP, 'localtime')),
  //   modifiedOn DATETIME NOT NULL DEFAULT (datetime(CURRENT_TIMESTAMP, 'localtime')),
  //              FOREIGN KEY(type) REFERENCES DatabaseType(id)
  // );
  
  /**
   * Add a kenning entry
   *
   * Receive the user kenning strings from server
   * Insert the kenning
   * Return whether the insertion was successful
   */
  async addKenning(username, concept, definition, words) {
    const d = new Date(); 
    const mo = d.getMonth()+1 < 10 ? `0${d.getMonth()+1}` : d.getMonth()+1;
    const day = d.getDate() < 10 ? `0${d.getDate()}` : d.getDate();
    const now = `${d.getFullYear()}-${mo}-${day} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`
    try {
      const k = await this.sqlite.run(
        `INSERT INTO
         Kenning (concept, definition, createdBy, createdOn, modifiedOn)
          VALUES (?,       ?,          ?,         ?,         ?)`,
                  concept, definition, username,  now,       now);
      console.log(k);
      const kw = await this.sqlite.exec(
        `INSERT INTO
         KenningWord (kenning, version, word)
         VALUES      ${words.map(w => `(${k.lastID}, 1, ${w})`).join(', ')};`
      )
      return true
    } catch (dbError) {
      console.error(dbError);
      return false
    }
  }

  /**
   * Get kennings for the admin page
   *
   * Return a list of kennings and time fields from recently updated records
   */
  async getAdminKennings() {
    // Return most recent 20
    try {
      return await this.sqlite.all("SELECT * FROM Kennings ORDER BY lastUpdatedOn DESC LIMIT 5");
    } catch (dbError) { console.error(dbError) }
  }

  /**
   * Clear actions and reset kennings
   *
   * Destroy everything in Actions table
   * Destroy everything in Kennings table
   */
  async clearHistory() {
    try {

      // Delete the kennings
      await this.sqlite.run("DELETE from Kennings");

      // Return empty array
      return [];
    } catch (dbError) { console.error(dbError) }
  }
}