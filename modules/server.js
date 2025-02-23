/**
 * This is the main server script that provides the API endpoints
 * The script uses the database helper in /src
 * The endpoints retrieve, update, and return data to the page handlebars files
 *
 * The API returns the front-end UI handlebars pages, or
 * Raw json if the client requests it with a query parameter ?raw=json
 */

// Utilities we need
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import handlebars from 'handlebars';
import fastifyFramework from 'fastify';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import Database from './database.js';

import { searchEnglish } from './panlexia.js';

handlebars.registerHelper('formatDate', (datetime) => {
  const date = new Date(datetime);
  return date.toLocaleString("en-US", { timeZone: 'America/Chicago' });
})

const renderHisyeo = (t, words) =>
  t.split(' ').map(i => words[i] ? `<span class='word-${i}'>${i}</span>` : `<span class='word-not-found'>${i}</span>`);

// Require the fastify framework and instantiate it
const fastify = fastifyFramework({
  // Set this to true for detailed logging:
  logger: false,
});

// Setup our static files
fastify.register(import("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

fastify.addHook("preHandler", async (request, reply) => {
  reply.locals = {
    words: (await axios.get("https://hisyeo.github.io/words.json")).data
  }
});

// Formbody lets us parse incoming forms
fastify.register(import("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(import("@fastify/view"), {
  engine: {
    handlebars: handlebars,
  },
  layout: '/templates/layout.hbs'
});

// Load and parse SEO data
const seo = {
  "glitch-help-instructions": "For a custom domain, change the 'url' parameter from 'glitch-default' to your domain _without_ a traling slash, like 'https://www.example.com'",
  "title": "Hîsyêô Kennings",
  "description": "A simple CRUD app dictionary of kennings (definitions) in the constructed language Hisyëö.",
  "url": `https://${process.env.PROJECT_DOMAIN}.glitch.me`,
  "image": "https://cdn.glitch.com/605e2a51-d45f-4d87-a285-9410ad350515%2Fhello-node-social.png?v=1618161394375",
  "db": "SQLite"
}

const data = {
  "errorMessage": "Whoops! Error connecting to the database–please try again!",
  "setupMessage": "🚧 Whoops! Looks like the database isn't setup yet! 🚧"
}

const db = await (new Database()).initialize()

/**
 * Home route for the app
 *
 * Return the poll options from the database helper script
 * The home route may be called on remix in which case the db needs setup
 *
 * Client can request raw data using a query parameter
 */
fastify.get("/", async (request, reply) => {
  console.log('Executing "/" path...')
  /* 
   * Params is the data we pass to the client
   * - SEO values for front-end UI but not for raw data
   */
  let params = request.query.raw ? {} : { seo: seo };

  // Get the kennings from the database
  const kennings = await db.getKennings();

  if (kennings) { params.kennings = kennings }
  // Let the user know if there was a db error
  else params.error = data.errorMessage;

  // Check in case the data is empty or not setup yet
  if (kennings && params.kennings.length < 1)
    params.setup = data.setupMessage;

  // Send the page options or raw JSON data if the client requested it
  return request.query.raw
    ? reply.send(params)
    : reply.view("/templates/index.hbs", params);
});

/**
 * Post route to add new kenning entry
 *
 * Retrieve kenning from body data
 * Send kenning to database helper
 * Return updated list of kennings
 */
fastify.post("/add", async (request, reply) => {
  // We only send seo if the client is requesting the front-end ui
  let params = request.query.raw ? {} : { seo: seo };
  
  /**
   * Authenticate the user request by checking against the env key
   * variable make sure we have a key in the env and body, and that
   * they match
   */
  if (
    !request.body.key ||
    request.body.key.length < 1 ||
    !process.env.CONTRIBUTOR_KEY ||
    request.body.key !== process.env.CONTRIBUTOR_KEY
  ) {
    console.error("Auth fail");

    // Auth failed, return the log data plus a failed flag
    params.failed = "You entered invalid credentials!";

    // Get the log list
    params.actions = await db.getAdminKennings();
  } else {

    let kennings;
    // We have an entry - send to the db helper to process and return results
    if (request.body.english && request.body.hisyeo) {
      console.debug('Rendering html...');
      let html = renderHisyeo(request.body.hisyeo, reply.locals.words)
      console.debug('Writing to sqlite server...');
      kennings = await db.addKenning(request.body.english, request.body.hisyeo, html.join(' '));
      if (kennings) {
        params.actions = await db.getAdminKennings()
      } else {
        data.errorMessage = 'Problem adding entry.'
      }  
    } else {
      data.errorMessage = 'Both fields must be provided.'
    }
    params.error = (kennings && params.actions) ? null : data.errorMessage;
    
  }
  
  // Return the info to the client
  return request.query.raw
    ? reply.send(params)
    : reply.view("/templates/admin.hbs", params);
});

/**
 * Admin endpoint returns log of votes
 *
 * Send raw json or the admin handlebars page
 */
fastify.get("/actions", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };

  // Get the log history from the db
  params.actions = await db.getAdminKennings();

  // Let the user know if there's an error
  params.error = params.actions ? null : data.errorMessage;

  // Send the log list
  return request.query.raw
    ? reply.send(params)
    : reply.view("/templates/admin.hbs", params);
});

/**
 * Admin endpoint searches kenning entries
 *
 * Send raw json or the admin handlebars page
 */
fastify.post("/search", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };
  params.searchValue = request.body['search-value'].trim();
  if (!params.searchValue) { params.error = 'No search value was provided.'}
  else {
    params.actions = await db.searchActions(params.searchValue, !!reply.locals.words[params.searchValue]);
    if (!params.actions) params.error = data.errorMessage;
  }

  return request.query.raw
    ? reply.send(params)
    : reply.view("/templates/admin.hbs", params);
});

/**
 * Admin endpoint pulls a single kenning for editing
 *
 * Send raw json or the admin handlebars page
 */
fastify.post("/edit", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };
  
  params.editIdentifier = request.body['edit-id'];
  if (!params.editIdentifier) {
    params.error = 'No edit id was provided.'
  } else {
    params.actions = await db.editKenning(params.editIdentifier);
    if (!params.actions) params.error = data.errorMessage;
    else {
      params.actions[0].isEditing = true
    }
  }

  return request.query.raw
    ? reply.send(params)
    : reply.view("/templates/admin.hbs", params);
});

/**
 * Admin endpoint saves a kenning change
 *
 * Send raw json or the admin handlebars page
 */
fastify.post("/save", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };
  
  // Save operation
  let id      = request.body['save-id'];
  let english = request.body['kenning-english'];
  let hisyeo  = request.body['kenning-hisyeo'];
  if (!(english && hisyeo)) { params.error = 'Both English and Hisyeo text must be provided.'}
  else {
    let html = renderHisyeo(hisyeo, reply.locals.words)
    if (!(await db.saveKenning(id, english, hisyeo, html.join(' '))))
      params.error = 'Save request was unsuccessful.'
  }
  
  // Get the log history from the db
  params.actions = await db.getAdminKennings();

  // Let the user know if there's an error
  if (!params.error) params.error = params.actions ? null : data.errorMessage;

  // Send the log list
  return request.query.raw
    ? reply.send(params)
    : reply.view("/templates/admin.hbs", params);
});

/**
 * Admin endpoint deletes kenning entries
 *
 * Send raw json or the admin handlebars page
 */
fastify.post("/delete", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };
  
  // Delete operation
  let deleteId = request.body['delete-id']
  if (!deleteId) { params.error = 'No delete ID was provided.'}
  else { if (!(await db.deleteKenning(deleteId))) params.error = 'Delete request was unsuccessful.' }

  
  // Get the log history from the db
  params.actions = await db.getAdminKennings();

  // Let the user know if there's an error
  params.error = params.actions ? null : data.errorMessage;

  // Send the log list
  return request.query.raw
    ? reply.send(params)
    : reply.view("/templates/admin.hbs", params);
});

/**
 * Admin endpoint restores kenning entries
 *
 * Send raw json or the admin handlebars page
 */
fastify.post("/restore", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };
  
  // Restore operation
  let restoreId = request.body['restore-id']
  if (!restoreId) { params.error = 'No restore ID was provided.'}
  else { if (!(await db.restoreKenning(restoreId))) params.error = 'Restore request was unsuccessful.' }

  
  // Get the log history from the db
  params.actions = await db.getAdminKennings();

  // Let the user know if there's an error
  params.error = params.actions ? null : data.errorMessage;

  // Send the log list
  return request.query.raw
    ? reply.send(params)
    : reply.view("/templates/admin.hbs", params);
});

/**
 * Admin endpoint to empty all logs
 *
 * Requires authorization (see setup instructions in README)
 * If auth fails, return a 401 and the log list
 * If auth is successful, empty the history
 */
fastify.post("/reset", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };

  /* 
  Authenticate the user request by checking against the env key variable
  - make sure we have a key in the env and body, and that they match
  */
  if (
    !request.body.key ||
    request.body.key.length < 1 ||
    !process.env.ADMIN_KEY ||
    request.body.key !== process.env.ADMIN_KEY
  ) {
    console.error("Auth fail");

    // Auth failed, return the log data plus a failed flag
    params.failed = "You entered invalid credentials!";

    // Get the log list
    params.actions = await db.getAdminKennings();
  } else {
    // We have a valid key and can clear the log
    params.actions = await db.clearHistory();

    // Check for errors - method would return false value
    params.error = params.actions ? null : data.errorMessage;
  }

  // Send a 401 if auth failed, 200 otherwise
  const status = params.failed ? 401 : 200;
  // Send an unauthorized status code if the user credentials failed
  return request.query.raw
    ? reply.status(status).send(params)
    : reply.status(status).view("/templates/admin.hbs", params);
});

// Run the server and report out to the logs
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
