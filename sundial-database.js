'use strict';


// database config
require('dotenv').config();
const Pool = require('pg').Pool;
// const sundialEncrypt = require('./sundial-encrypt.js');

const shouldForceDisableSSLForLocalDB = process.env.LOCAL_DISABLE_SSL === '1';
const localOrRemoteDatabaseURL = process.env.LOCAL_DATABASE_URL ? process.env.LOCAL_DATABASE_URL : process.env.DATABASE_URL;
const poolOptions = {
  connectionString: localOrRemoteDatabaseURL,
  ssl: !shouldForceDisableSSLForLocalDB,
};

// google auth config
const googleClientId = '536519055297-nvagfvf3pjp7rui21aar1cd55khih4vq.apps.googleusercontent.com';
const {OAuth2Client} = require('google-auth-library');
const googleOAuthClient = new OAuth2Client(googleClientId);

// database constants
const pool = new Pool(poolOptions);
const responses = {
  invalidParameters: 'Missing required parameters, check and try again!',
  unauthenticated: 'Missing authentication for username and password',
  login: {
    success: 'Successfully logged in',
    failure: 'Failed to log in',
  },
  getItems: {
    success: 'Successfully got items',
    failure: 'Failed to get items',
  },
  newItem: {
    success: 'Successfully created new item',
    failure: 'Failed to create new items',
  },
  editItem: {
    success: 'Successfully edited item',
    failure: 'Failed to edite item',
  },
  deleteItem: {
    success: 'Successfully deleted item',
    failure: 'Failed to delete item',
  },
};

// shared response funcs
function buildReject(message, error) {
  return {
    success: false,
    message: message,
    error: error,
  };
}

function buildResolve(message, data) {
  return {
    success: true,
    message: message,
    data: data,
  };
}

// auth endpoints
async function login({ token, metadata }) {
  // step 1: verify (https://developers.google.com/identity/sign-in/web/backend-auth)
  let googleId;
  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: token,
      audience: googleClientId,  
    });

    if (!ticket || !ticket.payload || !ticket.payload["sub"]) {
      return Promise.reject("Unable to verify token with Google, no specific error given");
    }

    googleId = ticket.payload["sub"];
  } catch (verifyError) {
    console.log(`[login] Critical Verify Error: ${verifyError}`);
    return Promise.reject(`Unable to verify token with Google.`);
  }

  // step 2: check if user already exists in db (postgresql)
  let existingUsers = [];
  try {
    const selectUserRes = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    existingUsers = selectUserRes ? selectUserRes.rows : null;
  } catch (selectError) {
    console.log(`[login] Critical Select Error: ${selectError}`);
    return Promise.reject(`Unable to search for users in our backend.`);
  }

  let user;
  if (existingUsers && existingUsers.length > 0) {
    user = existingUsers[0];
  } else {
    // step 3a: if exists, log in successfully
    // try {
    //   user = await pool.query('UPDATE users SET metadata = $1 WHERE googleId = $2', [metadata, googleId]);
    // } catch (updateError) {
    //   console.log(`[login] Critical Update Error: ${updateError}`);
    //   throw new Error(`Unable to update user in our backend.`);
    // }
    // step 3b: if does not exist, add entry to db and save as new user
    try {
      const insertUserRes = await pool.query('INSERT INTO users(google_id, metadata) VALUES ($1, $2::json) RETURNING *', [googleId, metadata]);
      user = insertUserRes && insertUserRes.rows && insertUserRes.rows.length > 0 ? insertUserRes.rows[0] : null;
    } catch (insertError) {
      console.log(`[login] Critical Insert Error: ${insertError}`);
      return Promise.reject(`Unable to insert user into our backend.`);
    }
  }

  if (!user) {
    return Promise.reject(`Unable to get information about user in our backend.`);
  }

  // step 4: return user metadata scrubbed of sensitive info
  return buildResolve(responses.login.success, user);
}

// item endpoints
async function getItems({ token }) {
  let loginRes;
  try {
    loginRes = await login({ token });
  } catch (loginErr) {
    throw new Error("Unable to authenticate");
  }
     
  const userId = loginRes.data.id;
  let items;
  try {
    items = await pool.query('SELECT * FROM items WHERE user_id = $1 ORDER BY date DESC', [userId]);
  } catch (selectError) {
    throw new Error("Unable to get items for user");
  }

  return buildResolve(responses.getItems.success, items);
}

async function newItem({ token, date, metadata }) {
  let loginRes;
  try {
    loginRes = await login({ token });
  } catch (loginErr) {
    throw new Error("Unable to authenticate");
  }
     
  const userId = loginRes.data.id;
  let newItem;
  try {
    newItem = await pool.query('INSERT INTO items(user_id, date, metadata) VALUES ($1, $2, $3::json) RETURNING *', [userId, date, metadata]);
  } catch (selectError) {
    throw new Error("Unable to add new item item for user");
  }

  return buildResolve(responses.newItem.success, newItem);
}

async function editItem({ token, itemId, date, metadata}) {
  let loginRes;
  try {
    loginRes = await login({ token });
  } catch (loginErr) {
    throw new Error("Unable to authenticate");
  }
     
  const userId = loginRes.data.id;
  let updatedItem;
  try {
    updatedItem = await pool.query('UPDATE items SET date = $1 AND metadata = $2::json WHERE user_id = $3 AND id = $4 RETURNING *', [date, metadata, userId, itemId]);
  } catch (updateError) {
    throw new Error("Unable to edit existing item item for user");
  }

  return buildResolve(responses.editItem.success, updatedItem);
}

async function deleteItem({ token, itemId }) {
  let loginRes;
  try {
    loginRes = await login({ token });
  } catch (loginErr) {
    throw new Error("Unable to authenticate");
  }
     
  const userId = loginRes.data.id;
  let deleteRes;
  try {
    deleteRes = await pool.query('DELETE FROM items WHERE user_id = $1 AND id = $2', [userId, itemId]);
  } catch (updateError) {
    throw new Error("Unable to edit existing item item for user");
  }

  return buildResolve(responses.editItem.success, []);
}

module.exports = {
  responses, buildReject, buildResolve, login, getItems, newItem, editItem, deleteItem
};
