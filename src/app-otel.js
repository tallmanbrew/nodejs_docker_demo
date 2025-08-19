// Lightweight app that starts with OTEL bootstrap
require('./otel-bootstrap');

// ...existing code...
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const db = require('./database');

const personsRouter = require('./routes/persons');
const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
const itemsRouter = require('./routes/items');

const app = express();

// Seed dummy data on startup
(async () => {
    await db.seedDummyData();
})();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/persons', personsRouter);
app.use('/admin', adminRouter);
app.use('/items', itemsRouter);

module.exports = app;
