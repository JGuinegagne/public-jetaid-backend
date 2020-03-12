const express = require('express');

const methodOverride = require('method-override');
const bodyParser =require('body-parser');
const cors = require('cors');
const logger =require('morgan');

const db = require('./models');
const router = require('./routes');

/** The application container.
 * 
 * The module creates a new instance of this class and 
 * export the public variable express of @type {express.Application}
 * 
 * @class App
 */
class App {
  /**
   * Constructor of the container class App.
   * 
   * Creates the instance of express of @type {express.Application} and sets up 
   * the configuration, middlewares and routes.
   */
  constructor() {
    this.express = express();

    this.addPreroutingMiddlewares();

    // test data base construction
    db.sequelize
      .authenticate()
      .then(() => console.log('successfully authenticated'))
      .catch(error => console.log(`unable to connect to the database ${error}`));

    this.express.use(router);
    this.addPostRoutingMiddlewares();
  }

  /** 
     * Add middlewares to be executed before the request gets forwarded to the router.
     */
  addPreroutingMiddlewares() {        
    // cross-sites request middleware
    this.express.use(cors());

    // logger middleware
    this.express.use(logger('dev'));

    // query parser middlewares
    this.express.use(methodOverride());
    this.express.use(bodyParser.urlencoded({
      extended: false,
    }));

    // json form parser middleware
    this.express.use(bodyParser.json());
    

    // error handling
    //this.express.use(errorHandler());
  }

  /**
  * Add middlewares to be executed after the router handled the request.
  */
  addPostRoutingMiddlewares() {
    // catches 404 not found error and forward to error handler
    this.express.use((err, req, res, next) => {
      console.log(err);
      err.status = 404;
      next(err);
    });

    // debug error handling
    /* eslint-disable no-unused-vars */
    this.express.use((err, req, res, next) => {
      /* eslint-enable no-unused-vars */
      console.log(err.stack);
      res.status(err.status || 500);

      return res.json({'errors': {
        message: err.message,
        error: err
      }});

      // STOP MIDDLEWARES CHAIN
    });
  }
}

module.exports = new App().express;