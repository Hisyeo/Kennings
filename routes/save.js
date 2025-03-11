import { seo, data } from '../modules/config.js';

/**
 * Admin endpoint saves a kenning change
 *
 * Send raw json or the admin handlebars page
 */
export default function (db) {
  return async function (request, reply) {
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
  }
}