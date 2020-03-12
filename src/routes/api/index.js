const express = require('express');

const usersRouter = require('./users');
const travelersRouter = require('./travelers');
const tripsRouter = require('./trips');
const ridersRouter = require('./riders');
const filtersRouter = require('./filters');
const ridesRouter = require('./rides');
const coridersRouter = require('./coriders');
const tasksRouter = require('./tasks');
const passengersRouter = require('./passengers');
const taskersRouter = require('./taskers');
const helpersRouter = require('./helpers');
const volunteersRouter = require('./volunteers');
const noticesRouter = require('./notices');

const apiRouter = express.Router();
apiRouter.use('/users', usersRouter);
apiRouter.use('/travelers', travelersRouter);
apiRouter.use('/trips',tripsRouter);
apiRouter.use('/riders',ridersRouter);
apiRouter.use('/filters',filtersRouter);
apiRouter.use('/rides',ridesRouter);
apiRouter.use('/coriders',coridersRouter);
apiRouter.use('/tasks',tasksRouter);
apiRouter.use('/passengers',passengersRouter);
apiRouter.use('/taskers',taskersRouter);
apiRouter.use('/helpers',helpersRouter);
apiRouter.use('/volunteers',volunteersRouter);
apiRouter.use('/notices',noticesRouter);

module.exports = apiRouter;