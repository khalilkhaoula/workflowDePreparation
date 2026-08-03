require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const routes = require('./routes/index');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/images', express.static(path.join(__dirname, '../images')));
app.use('/api', routes);

app.use(errorMiddleware);

module.exports = app;
