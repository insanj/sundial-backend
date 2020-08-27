'use strict';

// database
var sundialDatabase = require('./sundial-database.js');
require('dotenv').config();
const shouldLog = process.env.LOCAL_DISABLE_SSL === '1';

// express
var express = require('express');
var app = express();
var port = process.env.PORT || 8080;
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

// loggers
const endpointLog = (name, req) => {
  if (shouldLog !== true) {
    return;
  }
  console.log(`[SundialBackend] [POST] ${name} [REQ HEADERS] ${JSON.stringify(req.headers ? req.headers : {})} [REQ BODY] ${JSON.stringify(req.body)}`);
}

// endpoints
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Sundial-Token');
  next();
});

app.get('/', function(req, res) {
  res.send('🌤');
});

// auth endpoints
app.post('/login', function(req, res) {
  endpointLog('/login', req);

  if (!req.body.token || !req.body.metadata) {
    const response = sundialDatabase.buildReject(sundialDatabase.responses.invalidParameters, null);
    res.send(response);
    return;
  }

  sundialDatabase.login({
    token: req.body.token, 
    metadata: req.body.metadata
  }).then((loginResponse) => {
    endpointLog(`/login success ${JSON.stringify(loginResponse)}`, req);
    res.status(200).json(loginResponse);
  }).catch((loginError) => {
    endpointLog(`/login error ${JSON.stringify(loginError)}`, req);
    res.send(loginError);
  });
});

// shared auth funcs
const syncGetTokenOrReject = (req, res) => {
  if (!req.headers || !req.headers['sundial-token']) {
    const response = sundialDatabase.buildReject(sundialDatabase.responses.unauthenticated, null);
    res.send(response);
    return null;
  }

  return req.headers['sundial-token'];
}

// item endpoints
app.post('/item/new', function(req, res) {
  endpointLog('/item/new', req);

  const token = syncGetTokenOrReject(req, res);
  if (!token) {
    return;
  }

  if (!req.body.itemName || !req.body.itemDate) {
    const response = sundialDatabase.buildReject(sundialDatabase.responses.invalidParameters, null);
    res.send(response);
    return null;
  } 

  sundialDatabase.newItem(token, {
    name: req.body.itemName,
    date: req.body.itemDate,
    metadata: req.body.itemMetadata
  }).then(r => {
    res.status(200).json(r);
  }).catch(e => {
    console.log("[/item/new] Critical Error: " + JSON.stringify(e));
    res.send(sundialDatabase.buildReject(sundialDatabase.responses.newItem.failure, e));
  });
});

app.post('/items/get', function(req, res) {
  endpointLog('/items/get', req);

  const token = syncGetTokenOrReject(req, res);
  if (!token) {
    return;
  }

  sundialDatabase.getItems(token).then(r => {
    res.status(200).json(r);
  }).catch(e => {
    console.log("[/items/get] Critical Error: " + JSON.stringify(e));
    res.send(sundialDatabase.buildReject(sundialDatabase.responses.getItems.failure, e));
  });
});


app.post('/item/edit', function(req, res) {
  endpointLog('/item/edit', req);

  const token = syncGetTokenOrReject(req, res);
  if (!token) {
    return;
  }

  if (!req.body.itemId || !req.body.itemName || !req.body.itemMetadata || !req.body.itemDate) {
    const response = sundialDatabase.buildReject(sundialDatabase.responses.invalidParameters, null);
    res.send(response);
    return null;
  }

  sundialDatabase.editItem(token, { 
    id: req.body.itemId, 
    name: req.body.itemName, 
    date: req.body.itemDate,
    metadata : req.body.itemMetadata, 
  }).then(r => {
    res.status(200).json(r);
  }).catch(e => {
    console.log("[/item/edit] Critical Error: " + JSON.stringify(e));
    res.send(sundialDatabase.buildReject(sundialDatabase.responses.editItem.failure, e));
  });
});

app.post('/item/delete', function(req, res) {
  endpointLog('/item/delete', req);

  const token = syncGetTokenOrReject(req, res);
  if (!token) {
    return;
  }

  if (!req.body.itemId) {
    const response = sundialDatabase.buildReject(sundialDatabase.responses.invalidParameters, null);
    res.send(response);
    return null;
  }

  sundialDatabase.deleteItem(token, { 
    id: req.body.itemId 
  }).then(r => {
    res.status(200).json(r);
  }).catch(e => {
    console.log("[/item/delete] Critical Error: " + JSON.stringify(e));
    res.send(sundialDatabase.buildReject(sundialDatabase.responses.deleteItem.failure, e));
  });
});

app.listen(port, () => console.log(`🌤 sundial-backend running on port ${port}!`));
