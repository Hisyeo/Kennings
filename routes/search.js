import { seo, data } from '../modules/config.js';

import { searchEnglish } from '../modules/panlexia.js';

/**
 * Admin endpoint searches kenning entries
 *
 * Send raw json or the admin handlebars page
 */
export default function (db) {
  return async function (request, reply) {
    let params = request.query.raw ? {} : { seo: seo };

    params.searchValue = request.query.value.trim();
    if (!params.searchValue) { params.error = 'No search value was provided.' }
    else {
      params.searchResults = searchEnglish(params.searchValue);
      let remainingConcepts = [...params.searchResults];
      if (!params.searchResults) { params.error = 'No English word was found that matches that search value.' }
      else {
        const kennings = await db.getKennings(
          params.searchResults.map(k => k.concept).filter((id, idx, ids) => ids.indexOf(id) === idx)
        );
        
        const groupedByConcept = kennings.reduce(
          (accum, kenning, idx, arr, key = kenning.concept) => {
            (accum[key] || (accum[key] = [])).push(kenning);
            
            // remove this concept from the list of matching concepts
            let conceptIdx = -1;
            while ((conceptIdx = remainingConcepts.map(c => c.concept).indexOf(key)) > -1)
              remainingConcepts.splice(conceptIdx, 1);
            
            return accum
          },
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
            const kenningIndex = groupedByConcept[concept].map(k => k[0].id).indexOf(vote.kenning) 
            if (kenningIndex > -1)
              for (let kenningWord of groupedByConcept[concept][kenningIndex]) {
                if ('votes' in kenningWord) {
                  kenningWord.votes.push(vote)
                } else {
                  kenningWord.votes = [vote]
                }

              }
          }
        }
        
        for (let concept of remainingConcepts) { groupedByConcept[concept.concept] = [[concept]] }
        
        if (groupedByConcept) { params.concepts = groupedByConcept }
        // Let the user know if there was a db error
        else { params.error = data.errorMessage }
      }
    }

    // Send the page options or raw JSON data if the client requested it
    return request.query.raw
      ? reply.send(params)
      : reply.view("/templates/index.hbs", params);
  }
}