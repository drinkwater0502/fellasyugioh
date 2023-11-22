const express = require('express');
const mysql = require('mysql2/promise')
const bodyParser = require('body-parser');
const session = require('express-session')
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

async function getAllUserCards(discordTag) {
  try {
    let connection = await pool.getConnection();
    console.log('Connected to MySQL database');
    await connection.beginTransaction();
    let allUserCardsArray = []

    let [inventoryRows] = await connection.query(`SELECT * FROM ${discordTag}_inventory`);
    let [maindeckRows] = await connection.query(`SELECT * FROM ${discordTag}_maindeck`);
    let [extradeckRows] = await connection.query(`SELECT * FROM ${discordTag}_extradeck`);
    let [sidedeckRows] = await connection.query(`SELECT * FROM ${discordTag}_sidedeck`);

    let inventoryIDS = []
    inventoryRows.forEach(card => inventoryIDS.push(card['CardID']))
    allUserCardsArray.push(inventoryIDS)

    let maindeckIDS = []
    maindeckRows.forEach(card => maindeckIDS.push(card['CardID']))
    allUserCardsArray.push(maindeckIDS)

    let extradeckIDS = []
    extradeckRows.forEach(card => extradeckIDS.push(card['CardID']))
    allUserCardsArray.push(extradeckIDS)

    let sidedeckIDS = []
    sidedeckRows.forEach(card => sidedeckIDS.push(card['CardID']))
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

async function updateAllUserCards(discordTag, inventory, maindeck, extradeck, sidedeck) {
  let connection
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(`DELETE FROM ${discordTag}_inventory`);
    await connection.query(`DELETE FROM ${discordTag}_maindeck`);
    await connection.query(`DELETE FROM ${discordTag}_extradeck`);
    await connection.query(`DELETE FROM ${discordTag}_sidedeck`);

    await Promise.all(
      inventory.map(async cardID => {
        await connection.query(`INSERT INTO ${discordTag}_inventory (id, CardID) VALUES (NULL, ?)`, [Number(cardID)]);
      }),
      maindeck.map(async cardID => {
        await connection.query(`INSERT INTO ${discordTag}_maindeck (id, CardID) VALUES (NULL, ?)`, [Number(cardID)]);
      }),
      extradeck.map(async cardID => {
        await connection.query(`INSERT INTO ${discordTag}_extradeck (id, CardID) VALUES (NULL, ?)`, [Number(cardID)]);
      }),
      sidedeck.map(async cardID => {
        await connection.query(`INSERT INTO ${discordTag}_sidedeck (id, CardID) VALUES (NULL, ?)`, [Number(cardID)]);
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

const app = express();
app.set('view-engine', 'ejs')
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }));

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

app.get('/', (req, res) => {
  res.redirect('/home')
})

app.get('/home', async (req, res) => {
  let userData = await getUserData(req.session.user)
  res.render('index.ejs', { credits: userData['credits'], discordTag: userData['discordTag'] })
})

app.get('/trade', (req, res) => {
  res.render('trade.ejs')
})

app.get('/buy', (req, res) => {
  res.render('buy.ejs')
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
    req.session.user = '347702235498545152'; // me **************
    res.redirect('/home');
  } else if (secretCode === process.env.JAMES_CODE) {
    req.session.user = '211529348740677633'; // james
    res.redirect('/home');
  } else if (secretCode === process.env.CANON_CODE) {
    req.session.user = '705263315999391764'; // canon
    res.redirect('/home');
  } 
  else if (secretCode === process.env.JASON_CODE) {
    req.session.user = '265601692559474691'; // jason
    res.redirect('/home');
  } 
  else if (secretCode === process.env.MAZIN_CODE) {
    req.session.user = '166691275959959552'; // mazin
    res.redirect('/home');
  } 
  else if (secretCode === process.env.NOAH_CODE) {
    req.session.user = '644389392697524224'; // noah
    res.redirect('/home');
  } 
  else if (secretCode === process.env.JOSH_CODE) {
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

app.get('/test', (req, res) => {
  res.send('Test Page');
});

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
  req.session.destroy(); // Destroy the session to log out the user
  res.redirect('/login');
});

app.listen(3000)


