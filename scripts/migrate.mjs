import 'zx/globals'
import Database from '../modules/database.js'

const scriptVersion = (p) => Number(path.basename(p).split('-')[0]);

(async () => {

  const db = await (new Database()).initialize()

  let currentVersion = (await db.get('PRAGMA user_version;')).user_version
  console.log(`Version before migration: ${currentVersion}`)

  cd('./migrations')
  try {
    for (let file of (await $`ls`).stdout.split('\n')) {
      if (file.length == 0) continue;
      let migrationVersion = scriptVersion(file)
      if (migrationVersion > currentVersion) {
        console.log(`Applying migration "${file}"...`);
        await db.exec('BEGIN TRANSACTION');
        try {
          await db.exec(await fs.readFile(file, { encoding: 'utf8' }));  
          await db.exec(`COMMIT`);
          await db.exec(`PRAGMA user_version = ${migrationVersion};`)
        } catch (transactionError) {
          await db.exec('ROLLBACK');
          throw transactionError
        }
      } else {
        console.log(`Migration "${file}" already applied`)
      }
    }
  } catch (databaseError) {
    throw databaseError
  }

  currentVersion = (await db.get('PRAGMA user_version;')).user_version
  console.log(`Version after migration: ${currentVersion}`)
  
})().catch(e => { console.error(e) })

