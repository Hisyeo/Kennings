import { seo, data } from '../modules/config.js';

/**
 * Admin endpoint to review kennings waiting to be published
 *
 * Send raw json or the admin handlebars page
 */
export default function (db) {
  return async function (request, reply) {
    let params = request.query.raw ? {} : { seo: seo };

    // Get the log history from the db
    params.actions = await db.getAdminKennings();

    // Let the user know if there's an error
    params.error = params.actions ? null : data.errorMessage;

    // Send the log list
    return request.query.raw
      ? reply.send(params)
      : reply.view("/templates/admin.hbs", params);
  }
}