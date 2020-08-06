process.env.TESTENV = true

let Entry = require('../app/models/entry.js')
let User = require('../app/models/user')

const crypto = require('crypto')

let chai = require('chai')
let chaiHttp = require('chai-http')
let server = require('../server')
chai.should()

chai.use(chaiHttp)

const token = crypto.randomBytes(16).toString('hex')
let userId
let entryId

describe('Entries', () => {
  const entryParams = {
    title: 'Entry Title',
    text: 'Here is my blog entry.'
  }

  before(done => {
    Entry.deleteMany({})
      .then(() => User.create({
        email: 'caleb',
        hashedPassword: '12345',
        token
      }))
      .then(user => {
        userId = user._id
        return user
      })
      .then(() => Entry.create(Object.assign(entryParams, {owner: userId})))
      .then(record => {
        entryId = record._id
        done()
      })
      .catch(console.error)
  })

  describe('GET /entries', () => {
    it('should get all the entries', done => {
      chai.request(server)
        .get('/entries')
        .set('Authorization', `Token token=${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.entries.should.be.a('array')
          res.body.entries.length.should.be.eql(1)
          done()
        })
    })
  })

  describe('GET /entries/:id', () => {
    it('should get one entries', done => {
      chai.request(server)
        .get('/entries/' + entryId)
        .set('Authorization', `Token token=${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.entry.should.be.a('object')
          res.body.entry.title.should.eql(entryParams.title)
          done()
        })
    })
  })

  describe('DELETE /entries/:id', () => {
    let entryId

    before(done => {
      Entry.create(Object.assign(entryParams, { owner: userId }))
        .then(record => {
          entryId = record._id
          done()
        })
        .catch(console.error)
    })

    it('must be owned by the user', done => {
      chai.request(server)
        .delete('/entries/' + entryId)
        .set('Authorization', `Bearer notarealtoken`)
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should be succesful if you own the resource', done => {
      chai.request(server)
        .delete('/entries/' + entryId)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(204)
          done()
        })
    })

    it('should return 404 if the resource doesn\'t exist', done => {
      chai.request(server)
        .delete('/entries/' + entryId)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(404)
          done()
        })
    })
  })

  describe('POST /entries', () => {
    it('should not POST an entry without a title', done => {
      let noTitle = {
        text: 'Untitled',
        owner: 'fakedID'
      }
      chai.request(server)
        .post('/entries')
        .set('Authorization', `Bearer ${token}`)
        .send({ entry: noTitle })
        .end((e, res) => {
          res.should.have.status(422)
          res.should.be.a('object')
          done()
        })
    })

    it('should not POST an entry without text', done => {
      let noText = {
        title: 'Not a very good entry, is it?',
        owner: 'fakeID'
      }
      chai.request(server)
        .post('/entries')
        .set('Authorization', `Bearer ${token}`)
        .send({ entry: noText })
        .end((e, res) => {
          res.should.have.status(422)
          res.should.be.a('object')
          done()
        })
    })

    it('should not allow a POST from an unauthenticated user', done => {
      chai.request(server)
        .post('/entries')
        .send({ entry: entryParams })
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should POST an entry with the correct params', done => {
      let validEntry = {
        title: 'Entry Title',
        text: 'Here is my blog post.'
      }
      chai.request(server)
        .post('/entries')
        .set('Authorization', `Bearer ${token}`)
        .send({ entry: validEntry })
        .end((e, res) => {
          res.should.have.status(201)
          res.body.should.be.a('object')
          res.body.should.have.property('entry')
          res.body.entry.should.have.property('title')
          res.body.entry.title.should.eql(validEntry.title)
          done()
        })
    })
  })

  describe('PATCH /entries/:id', () => {
    let entryId

    const fields = {
      title: 'Entry Title',
      text: 'Here is my blog post.'
    }

    before(async function () {
      const record = await Entry.create(Object.assign(entryParams, { owner: userId }))
      entryId = record._id
    })

    it('must be owned by the user', done => {
      chai.request(server)
        .patch('/entries/' + entryId)
        .set('Authorization', `Bearer notarealtoken`)
        .send({ entry: fields })
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should update fields when PATCHed', done => {
      chai.request(server)
        .patch(`/entries/${entryId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ entry: fields })
        .end((e, res) => {
          res.should.have.status(204)
          done()
        })
    })

    it('shows the updated resource when fetched with GET', done => {
      chai.request(server)
        .get(`/entires/${entryId}`)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.should.be.a('object')
          res.body.entry.title.should.eql(fields.title)
          res.body.entry.text.should.eql(fields.text)
          done()
        })
    })

    it('doesn\'t overwrite fields with empty strings', done => {
      chai.request(server)
        .patch(`/entries/${entryId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ entry: { text: '' } })
        .then(() => {
          chai.request(server)
            .get(`/entries/${entryId}`)
            .set('Authorization', `Bearer ${token}`)
            .end((e, res) => {
              res.should.have.status(200)
              res.body.should.be.a('object')
              // console.log(res.body.entry.text)
              res.body.entry.title.should.eql(fields.title)
              res.body.entry.text.should.eql(fields.text)
              done()
            })
        })
    })
  })
})
