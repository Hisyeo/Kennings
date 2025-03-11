import { seo, data } from '../modules/config.js';

/**
 * Home route for the app
 *
 * Return the poll options from the database helper script
 * The home route may be called on remix in which case the db needs setup
 *
 * Client can request raw data using a query parameter
 */
export default function (db) {
  return async function (request, reply) {
    console.log('Executing "/" path...')
    /* 
     * Params is the data we pass to the client
     * - SEO values for front-end UI but not for raw data
     */
    let params = request.query.raw ? {} : { seo };

    // Get the kennings from the database
    const kennings = await db.getRecentPublishedKennings();
    
    const groupedByConcept = kennings.reduce(
      (accum, kenning, idx, arr, key = kenning.concept) =>
        ((accum[key] || (accum[key] = [])).push(kenning), accum),
      {}
    )
    
    const kenningIds = new Set();
    for (let concept in groupedByConcept) {
      groupedByConcept[concept] = groupedByConcept[concept].reduce(
        (accum, kenning, idx, arr, key = kenning.id) => {
          (accum[key] || (accum[key] = [])).push(kenning);
          kenningIds.add(kenning.id);
          return accum
        },
        []
      ).filter(kennings => kennings.length > 0)      
    }
    
    const kenningVotes = await db.getKenningsVotes([...kenningIds]);
    for (let vote of kenningVotes) {
      for (let concept in groupedByConcept) {
        if (vote.kenning in groupedByConcept[concept])
          for (let kenningWord of groupedByConcept[concept][vote.kenning]) {
            if ('votes' in kenningWord) {
              kenningWord.votes.push(vote)
            } else {
              kenningWord.votes = [vote]
            }

          }
      }
    }
    
    if (groupedByConcept) { params.concepts = groupedByConcept }
    // Let the user know if there was a db error
    else { params.error = data.errorMessage }

    // Check in case the data is empty or not setup yet
    if (kennings && params.concepts.length < 1)
      params.setup = data.setupMessage;
    // Send the page options or raw JSON data if the client requested it
    return request.query.raw
      ? reply.send(params)
      : reply.view("/templates/index.hbs", params);
  }
}