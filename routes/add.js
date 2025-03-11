import { seo, data } from '../modules/config.js';

/**
 * Post route to add new kenning entry
 *
 * - Retrieve kenning from body data
 * - Send kenning to database helper
 * - Return updated list of kennings
 */
export default function (db) {
  return async function (request, reply) {
    let params = {}

    /**
     * Authenticate the user request by checking against the env key
     * variable make sure we have a key in the env and body, and that
     * they match
     */
    if ( !request.body.key
      || request.body.key.length < 1
      || !process.env.CONTRIBUTOR_KEY
      || request.body.key !== process.env.CONTRIBUTOR_KEY
    ) {
      console.error("Auth fail");

      params.failed = "You provided invalid credentials!";

    } else {
      
      let result;
      if (request.body.concept && request.body.createdBy && request.body.hisyeo) {
        console.debug('Parsing Hîsyêô text...');
        const words = await db.getWords(request.body.hisyeo)
        console.debug(words);
        // let html = renderHisyeo(request.body.hisyeo, reply.locals.words)
        // console.debug('Inserting new KenningWord rows...');
        // result = await db.addKenning(
        //   request.body.createdBy,
        //   request.body.concept,
        //   words);
        if (!result) {
          data.errorMessage = 'Problem adding entry.'
        }  
      } else {
        data.errorMessage = 'All fileds must be provided.'
      }
      params.error = result ? null : data.errorMessage;
    }

    return reply.send(params)
  }
}