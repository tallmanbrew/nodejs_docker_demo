// persons.js

const express = require('express');
const router = express.Router();
const db = require('../database');

router.get("/all", function(req, res) {
    db.Person.findAll()
        .then( persons => {
            res.status(200).send(JSON.stringify(persons));
        })
        .catch( err => {
            res.status(500).send(JSON.stringify(err));
        });
});

router.get("/:id", function(req, res) {
    db.Person.findByPk(req.params.id)
        .then( person => {
            res.status(200).send(JSON.stringify(person));
        })
        .catch( err => {
            res.status(500).send(JSON.stringify(err));
        });
});

// Create a new person (POST /persons)
router.post('/', async function(req, res) {
    if (!req.body || !req.body.firstName) {
        return res.status(400).json({ error: 'firstName is required' });
    }
    try {
        const person = await db.Person.create({
            firstName: req.body.firstName,
            lastName: req.body.lastName
        });
        res.status(201).json(person);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete("/:id", function(req, res) {
    db.Person.destroy({
        where: {
            id: req.params.id
        }
        })
        .then( () => {
            res.status(200).send();
        })
        .catch( err => {
            res.status(500).send(JSON.stringify(err));
        });
});

module.exports = router;