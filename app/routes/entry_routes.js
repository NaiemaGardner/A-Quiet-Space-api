// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

// pull in Mongoose model for entries
const Entry = require('../models/entry')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// this is middleware that will remove blank fields from `req.body`, e.g.
// { entry: { title: '', text: 'foo' } } -> { entry: { text: 'foo' } }
const removeBlanks = require('../../lib/remove_blank_fields')
// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `req.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// INDEX
// GET /entries
router.get('/entries', requireToken, (req, res, next) => {
  Entry.find()
    .then(entries => {
      // `entries` will be an array of Mongoose documents
      // we want to convert each one to a POJO, so we use `.map` to
      // apply `.toObject` to each one
      return entries.map(entry => entry.toObject())
    })
    // respond with status 200 and JSON of the entries
    .then(entries => res.status(200).json({ entries: entries }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// SHOW
// GET /entries/5a7db6c74d55bc51bdf39793
router.get('/entries/:id', requireToken, (req, res, next) => {
  // req.params.id will be set based on the `:id` in the route
  Entry.findById(req.params.id)
    .then(handle404)
    // if `findById` is succesful, respond with 200 and "entry" JSON
    .then(entry => res.status(200).json({ entry: entry.toObject() }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// CREATE
// POST /entries
router.post('/entries', requireToken, (req, res, next) => {
  // set owner of new entry to be current user
  req.body.entry.owner = req.user.id

  Entry.create(req.body.entry)
    // respond to succesful `create` with status 201 and JSON of new "entry"
    .then(entry => {
      res.status(201).json({ entry: entry.toObject() })
    })
    // if an error occurs, pass it off to our error handler
    // the error handler needs the error message and the `res` object so that it
    // can send an error message back to the client
    .catch(next)
})

// UPDATE
// PATCH /entries/5a7db6c74d55bc51bdf39793
router.patch('/entries/:id', requireToken, removeBlanks, (req, res, next) => {
  // if the client attempts to change the `owner` property by including a new
  // owner, prevent that by deleting that key/value pair
  delete req.body.entry.owner

  Entry.findById(req.params.id)
    .then(handle404)
    .then(entry => {
      // pass the `req` object and the Mongoose record to `requireOwnership`
      // it will throw an error if the current user isn't the owner
      requireOwnership(req, entry)

      // pass the result of Mongoose's `.update` to the next `.then`
      return entry.updateOne(req.body.entry)
    })
    // if that succeeded, return 204 and no JSON
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// DESTROY
// DELETE /entries/5a7db6c74d55bc51bdf39793
router.delete('/entries/:id', requireToken, (req, res, next) => {
  Entry.findById(req.params.id)
    .then(handle404)
    .then(entry => {
      // throw an error if current user doesn't own `entry`
      requireOwnership(req, entry)
      // delete the entry ONLY IF the above didn't throw
      entry.deleteOne()
    })
    // send back 204 and no content if the deletion succeeded
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

module.exports = router
