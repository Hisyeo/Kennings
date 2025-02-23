import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import sqlite3 from 'sqlite3';
import { open as dbWrapper } from 'sqlite';

// Enable verbose / debug mode
sqlite3.verbose();

const DB_FILE = "./.data/kennings-v02.db";

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
  async getPublishedKennings() {
    try { return await this.sqlite.all(
     `SELECT k.concept, k.definition, kw.pos, w.abugida, w.latin, w.syllabary
      FROM Kenning k
      JOIN KenningWord kw ON k.id = kw.kenning
      JOIN HisyeoWord  w  ON w.id = kw.word
      WHERE k.isDeleted = FALSE AND k.type = 17 ORDER BY k.concept DESC`
    ) }
    catch (dbError) { console.error(dbError) }
  }
  
  /**
   * Get specific actions for a matching set of kennings
   * 
   * searchString {string}
   * hisyeo {boolean} locate by searching Hisyëö text or English text
   *
   * Return a joined list of kennings and time fields from all records in the Kennings and Actions tables
   */
  async searchActions(searchString, hisyeo) {
    console.debug(`Search String: ${searchString}\tHisyëö: ${hisyeo}`);
    if (hisyeo) {
      try {
        return await this.sqlite.all(`SELECT * FROM Kennings WHERE hisyeo like '%${searchString}%'`);
      } catch (dbError) { console.error(dbError) }
    } else {
      try {
        return await this.sqlite.all(`SELECT * FROM Kennings WHERE english like '%${searchString}%'`);;
      } catch (dbError) { console.error(dbError) }
    }
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
   * Delete a kenning from the database
   *
   * Return whether op was successful or not
   * Loh an error in case of db connection issues
   */
  async deleteKenning(id) {
    const now = new Date().toISOString();
    try {
      await this.sqlite.all("UPDATE Kennings SET isDeleted = TRUE, deletedOn = ?, lastUpdatedOn = ? WHERE id = ?", now, now, id);
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
   * Add a kenning entry
   *
   * Receive the user kenning strings from server
   * Insert the kenning
   * Return whether the insertion was successful
   */
  async addKenning(english, hisyeo, html) {
    const now = new Date().toISOString();
    try {
      const kenning = await this.sqlite.run(
        "INSERT INTO Kennings (english, hisyeo, html, isDeleted, createdOn, lastUpdatedOn) VALUES (?, ?, ?, FALSE, ?, ?)",
        english,
        hisyeo,
        html,
        now,
        now);
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