import { seo, data } from '../modules/config.js';

/**
 * Admin endpoint pulls a single kenning for editing and renders as text instead of HTML
 *
 * Send raw json or the admin handlebars page
 */
export default function (db) {
  return async function (request, reply) {
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
  }
}