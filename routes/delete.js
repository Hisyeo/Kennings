import { seo, data } from '../modules/config.js';

/**
 * Admin endpoint to unpublish kenning entries
 *
 * Send raw json or the admin handlebars page
 */
export default function (db) {
  return async function (request, reply) {
    let params = request.query.raw ? {} : { seo: seo };

    /* 
    Authenticate the user request by checking against the env key variable
    - make sure we have a key in the env and body, and that they match
    */
    if (
      !request.body.key ||
      request.body.key.length < 1 ||
      !process.env.ADMIN_KEY ||
      request.body.key !== process.env.EDITOR_KEY
    ) {
      console.error("Auth fail");

      // Auth failed, return the log data plus a failed flag
      params.failed = "You provided invalid credentials!";

      // Get the log list
      params.actions = await db.getAdminKennings();
    } else {
      
      // Delete operation
      let deleteId = request.body['delete-id']
      if (!deleteId) {
        params.error = 'No ID was provided to be deleted.'
      } else {
        if (!(await db.deleteKenning(deleteId)))
          params.error = 'Delete request was unsuccessful.'
      }
      
      // We have a valid key and can clear the log
      params.actions = await db.deleteKenning(unpubl);

      // Check for errors - method would return false value
      params.error = params.actions ? null : data.errorMessage;
    }

    // Send a 401 if auth failed, 200 otherwise
    const status = params.failed ? 401 : 200;
    // Send an unauthorized status code if the user credentials failed
    return request.query.raw
      ? reply.status(status).send(params)
      : reply.status(status).view("/templates/admin.hbs", params);


    // Get the log history from the db
    params.actions = await db.getReviewKennings();

    // Let the user know if there's an error
    params.error = params.actions ? null : data.errorMessage;

  }
}