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
import { seo, data } from './config.js';

import indexHandler from '../routes/index.js';
import searchHandler from '../routes/search.js';
import deleteHandler from '../routes/delete.js';
import reviewHandler from '../routes/review.js';
import addHandler from '../routes/add.js';
import editHandler from '../routes/edit.js';
import saveHandler from '../routes/save.js';
import approveHandler from '../routes/approve.js';
import denyHandler from '../routes/deny.js';
import voteHandler from '../routes/vote.js';

import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en'
TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')
handlebars.registerHelper('formatDate', (datetime) => {
  const t = datetime.split(/[- :]/);
  const d = new Date(Date.UTC(t[0], t[1]-1, t[2], t[3], t[4], t[5]));
  return timeAgo.format(d)
})

let openState = false;
const renderGroupingMark = (mark) => {
  openState = !openState;
  switch (openState) {
    case true:  return ` ${mark[0]}`
    case false: return `${mark[1]} `;
  }
}
const renderKenning = (script, word) => {
  switch (word.kind) {
    case 'grp': return renderGroupingMark(word[script]);
    case 'punct': return `${word[script]} `;
    default: return `<span class='word-${word.latin} word-kind-${word.kind}'>${word[script]}</span> `
  }
}
handlebars.registerHelper('kenning', (script, words) => {
  const rendered = words.map(word => renderKenning(script, word)).join('');
  return rendered
})

handlebars.registerHelper('hasConcepts', (ks) =>
  Object.keys(ks).length > 0 && Object.keys(ks).some(k => k.length > 0))

handlebars.registerHelper('hasKennings', kws => kws.some(k => k.createdOn != undefined))

const renderHisyeo = (t, words) =>
  t.split(' ').map(i => words[i] ? `<span class='word-${i}'>${i}</span>` : `<span class='word-not-found'>${i}</span>`);

// Require the fastify framework and instantiate it
const fastify = fastifyFramework({
  // Set this to true for detailed logging:
  logger: true,
});

// Setup our static files
fastify.register(import("@fastify/static"), {
  root: path.join(__dirname, '..', "public"),
  prefix: "/", // optional: default '/'
});
console.debug('Static path:', path.join(__dirname, "public"));
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


const db = new Database()
await db.initialize()

fastify.get( "/",        indexHandler(db)  ); // sent from site
fastify.post("/add",                          // sent from discord
             { queryString: { raw: 'boolean' } }, addHandler(db));
fastify.get( "/review",  reviewHandler(db) ); // sent from discord
fastify.get("/search",                        // sent from both
            { queryString: { raw: 'boolean', value: 'string' } }, searchHandler(db));
fastify.post("/edit",                          // sent from discord
             { queryString: { raw: 'boolean' } }, editHandler(db));
fastify.post("/save",                          // sent from discord
             { queryString: { raw: 'boolean' } }, saveHandler(db));
fastify.post("/delete",  deleteHandler(db) ); // sent from site w/ admin key
fastify.post("/approve", approveHandler(db)); // sent from discord
fastify.post("/deny",    denyHandler(db)   ); // sent from discord
fastify.post("/vote",    voteHandler(db)   ); // sent from discord

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
