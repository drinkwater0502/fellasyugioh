const express = require('express');
const mysql = require('mysql2/promise')
const bodyParser = require('body-parser');
const session = require('express-session');
const MemoryStore = require('memorystore')(session)
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function getAllUserCards(discordID) {
  let connection
  try {
    connection = await pool.getConnection();
    console.log('Connected to MySQL database');
    await connection.beginTransaction();
    let allUserCardsArray = []

    let [inventoryRows] = await connection.query(`SELECT * FROM fellas_cards WHERE discordID = ${discordID} AND location = 'inventory'`);
    let [maindeckRows] = await connection.query(`SELECT * FROM fellas_cards WHERE discordID = ${discordID} AND location = 'main'`);
    let [extradeckRows] = await connection.query(`SELECT * FROM fellas_cards WHERE discordID = ${discordID} AND location = 'extra'`);
    let [sidedeckRows] = await connection.query(`SELECT * FROM fellas_cards WHERE discordID = ${discordID} AND location = 'side'`);

    let inventoryIDS = []
    inventoryRows.forEach(card => inventoryIDS.push(card['cardID']))
    allUserCardsArray.push(inventoryIDS)

    let maindeckIDS = []
    maindeckRows.forEach(card => maindeckIDS.push(card['cardID']))
    allUserCardsArray.push(maindeckIDS)

    let extradeckIDS = []
    extradeckRows.forEach(card => extradeckIDS.push(card['cardID']))
    allUserCardsArray.push(extradeckIDS)

    let sidedeckIDS = []
    sidedeckRows.forEach(card => sidedeckIDS.push(card['cardID']))
    allUserCardsArray.push(sidedeckIDS)

    await connection.commit()
    await connection.release();
    console.log('MySQL connection closed');
    return allUserCardsArray

  } catch (error) {
    // Rollback the transaction in case of an error
    if (connection) {
      await connection.rollback();
      await connection.release();
    }

    console.error('Error:', error);
    return null;
  }
}

async function updateAllUserCards(discordID, inventory, maindeck, extradeck, sidedeck) {
  let connection
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(`DELETE FROM fellas_cards WHERE discordID = '${discordID}'`);

    await Promise.all(
      inventory.map(async cardID => {
        await connection.query(`INSERT INTO fellas_cards (id, discordID, cardID, location) VALUES (NULL, ?, ?, 'inventory')`, [String(discordID), Number(cardID)]);
      }),
      maindeck.map(async cardID => {
        await connection.query(`INSERT INTO fellas_cards (id, discordID, cardID, location) VALUES (NULL, ?, ?, 'main')`, [discordID, Number(cardID)]);
      }),
      extradeck.map(async cardID => {
        await connection.query(`INSERT INTO fellas_cards (id, discordID, cardID, location) VALUES (NULL, ?, ?, 'extra')`, [discordID, Number(cardID)]);
      }),
      sidedeck.map(async cardID => {
        await connection.query(`INSERT INTO fellas_cards (id, discordID, cardID, location) VALUES (NULL, ?, ?, 'side')`, [discordID, Number(cardID)]);
      })
    );

    await connection.commit();
    await connection.release();

    console.log('Rows inserted successfully');
  } catch (error) {
    // Rollback the transaction in case of an error
    if (connection) {
      await connection.rollback();
      await connection.release();
    }

    console.error('Error:', error);
    return null;
  }
}

async function getUserData(discordID) {
  let connection
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    let [rows, fields] = await connection.query(`SELECT * FROM credits WHERE discordID = ${discordID}`);

    await connection.commit();
    await connection.release();
    return rows[0]
  } catch (error) {
    // Rollback the transaction in case of an error
    if (connection) {
      await connection.rollback();
      await connection.release();
    }

    console.error('Error:', error);
    return null;
  }
}

async function noReturnQuery(querystring) {
  let connection
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query(querystring);

    await connection.commit();
    await connection.release();
  } catch (error) {
    // Rollback the transaction in case of an error
    if (connection) {
      await connection.rollback();
      await connection.release();
    }
    console.error('Error:', error);
    return null;
  }
}

async function getCardsFromPack(packName, indexArray) {
  let connection
  let cardArray = []
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await Promise.all(
      indexArray.map(async tableindex => {
        let [rows, fields] = await connection.query(`SELECT CardID FROM ${packName} WHERE id = ${tableindex}`)
        cardArray.push(rows[0]['CardID'])
      })
    )
    await connection.commit();
    await connection.release();
    return cardArray
  } catch (error) {
    // Rollback the transaction in case of an error
    if (connection) {
      await connection.rollback();
      await connection.release();
    }

    console.error('Error:', error);
    return null;
  }
}

async function insertMultipleToFellasCards(discordID, array, location) {
  let connection
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await Promise.all(
      array.map(async cardID => {
        await connection.query(`INSERT INTO fellas_cards (id, discordID, cardID, location) VALUES (NULL, ?, ?, ?)`, [String(discordID), Number(cardID), String(location)])
      })
    )
    await connection.commit();
    await connection.release();
  } catch (error) {
    // Rollback the transaction in case of an error
    if (connection) {
      await connection.rollback();
      await connection.release();
    }

    console.error('Error:', error);
    return null;
  }
}

const app = express();
app.set('view-engine', 'ejs')
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(session({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  })
);

const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next(); // User is authenticated, proceed to the next middleware/route handler
  } else {
    res.redirect('/login'); // Redirect to the login page if not authenticated
  }
};

app.use('/home', requireAuth);
app.use('/cards', requireAuth);
app.use('/trade', requireAuth);
app.use('/buy', requireAuth);
app.use('/sell', requireAuth);
app.use('/deckfile', requireAuth);
app.use((req, res, next) => {
  // no caching for /buy
  if (req.url === '/buy') {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
  }
  next();
})

app.get('/', (req, res) => {
  res.redirect('/home')
})

app.get('/home', async (req, res) => {
  try {
    let userData = await getUserData(req.session.user)
    res.render('index.ejs', { credits: userData['credits'], discordTag: userData['discordTag'] })
  } catch (error) {
    console.log(error)
    res.render('login.ejs')
  }

})

app.get('/trade', (req, res) => {
  res.render('trade.ejs')
})

app.get('/buy', async(req, res) => {
  try {
    let userData = await getUserData(req.session.user)
    res.render('buy.ejs', { credits: userData['credits'], discordTag: userData['discordTag'], packsLeft: userData['packs_left'] })
  } catch (error) {
    console.log(error)
  }

})

app.get('/sell', (req, res) => {
  res.render('sell.ejs')
})

app.get('/login', (req, res) => {
  res.render('login.ejs')
})

app.post('/login', (req, res) => {
  const { secretCode } = req.body;

  // Check the secret code against your database or some predefined values
  if (secretCode === process.env.ODDLUPE_CODE) {
    console.log('i logged in')
    req.session.user = '347702235498545152'; // me **************
    res.redirect('/home');
  } else if (secretCode === process.env.JAMES_CODE) {
    console.log('james logged in')
    req.session.user = '211529348740677633'; // james
    res.redirect('/home');
  } else if (secretCode === process.env.CANON_CODE) {
    console.log('canon logged in')
    req.session.user = '705263315999391764'; // canon
    res.redirect('/home');
  } 
  else if (secretCode === process.env.JASON_CODE) {
    console.log('jason logged in')
    req.session.user = '265601692559474691'; // jason
    res.redirect('/home');
  } 
  else if (secretCode === process.env.MAZIN_CODE) {
    console.log('mazin logged in')
    req.session.user = '166691275959959552'; // mazin
    res.redirect('/home');
  } 
  else if (secretCode === process.env.NOAH_CODE) {
    console.log('noah logged in')
    req.session.user = '644389392697524224'; // noah
    res.redirect('/home');
  } 
  else if (secretCode === process.env.JOSH_CODE) {
    console.log('josh logged in')
    req.session.user = '210533406755389443'; // josh
    res.redirect('/home');
  } 
  else {
    res.redirect('/login');
  }
});

app.get('/cards', async (req, res) => {
  let [inventory, maindeck, extradeck, sidedeck] = await getAllUserCards(req.session.user)
  let userData = await getUserData(req.session.user)
  res.render('cards.ejs', { inventory, maindeck, extradeck, sidedeck, discordTag: userData['discordTag'] })
})

app.post('/sendData', async (req, res) => {
  const inventoryData = req.body.inventoryData
  const mainDeckData = req.body.mainDeckData
  const extraDeckData = req.body.extraDeckData
  const sideDeckData = req.body.sideDeckData
  await updateAllUserCards(req.session.user, inventoryData, mainDeckData, extraDeckData, sideDeckData)
  
  res.redirect('/cards')
})

app.post('/boughtblueeyes', async (req, res) => {
  // receive random card indexes from fetch
  const randomCardIndexes = req.body.cardIndexes
  console.log(randomCardIndexes)

  // check that free packs is higher than 0
  let userData = await getUserData(req.session.user)
  let packsLeft = Number(userData['packs_left'])
  if (packsLeft > 0) {
    // change free packs from 1 to 0
    await noReturnQuery(`UPDATE credits SET packs_left = 0 WHERE discordID = ${req.session.user}`)

    // get the 9 card ID's using the random indexes
    let packArray = await getCardsFromPack('blue_eyes_pack', randomCardIndexes)

    // insert cards into inventory
    await insertMultipleToFellasCards(req.session.user, packArray, 'inventory')
  }

  // redirect to buy page
  res.redirect('/cards')
})


app.get('/deckfile', async (req, res) => {
  let deckfilestring = '#created by THE FELLAS CASINO<br>#main<br>'
  let [inventory, maindeck, extradeck, sidedeck] = await getAllUserCards(req.session.user)
  maindeck.forEach(item => deckfilestring += `${item}<br>`)
  deckfilestring += '#extra<br>'
  extradeck.forEach(item => deckfilestring += `${item}<br>`)
  deckfilestring+= '!side<br>'
  sidedeck.forEach(item => deckfilestring += `${item}<br>`)

  res.render('deckfile.ejs', { deckfilestring })
})

app.get('/logout', (req, res) => {
  console.log(`${req.session.user} logged out`)
  req.session.destroy(); // Destroy the session to log out the user
  res.redirect('/login');
});

app.listen(3000)


