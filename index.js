const cron = require('node-cron')
const express = require('express')
const moment = require('moment')
const fs = require('fs')
const path = require('path')
const router = express.Router()
const stat_service = require('./stat-service')
const seasonStartDate = 20210520
const rosterFile = 'store/playoff-roster.json'
const standingsFile = 'store/playoff-standings.json'
const dotenv = require('dotenv')

dotenv.config()
app = express()
app.set('view engine', 'pug')

//VIEWS
router.get('/', async (req, res) => {
    await updateStandings(true)
    fs.readFile(standingsFile, 'utf8', (err, data) => {
        let standings = JSON.parse(data)
        standings.lastUpdated = moment(standings.lastUpdated, 'YYYYMMDD').format('dddd, MMMM Do YYYY')
        res.render('index', { standings: standings })
    })
})

router.get('/roster/:team', async (req, res) => {
    await updateStandings(true)
    fs.readFile(rosterFile, 'utf8', (err, data) => {
        let roster = JSON.parse(data).teams.find((o) => o.name === req.params.team)
        res.render('roster', { team: roster })
    })
})

app.get('/standings', async (req, res, next) => {
    await updateStandings(true)
    fs.readFile(standingsFile, 'utf8', (err, data) => {
        res.header('Content-Type', 'application/json')
        res.send(JSON.stringify(JSON.parse(data), null, 4))
    })
})

app.get('/draft', async (req, res, next) => {
    let players = await stat_service.getPlayers()
    res.render('draft', { players: players })
})

//Run as 12 GMT which will be 08:00 ETC all games should be done and reported
cron.schedule('0 12 * * *', async () => {
    await updateStandings(true)
    await stat_service.tweetStandings(standingsFile)
})

const updateStandings = async () => {
    let currentStandings
    let startDate = moment(seasonStartDate, 'YYYYMMDD').startOf('day')
    let todaysDate = moment.utc().startOf('day')
    var duration = moment.duration(todaysDate.diff(startDate))
    //Get the days since the beginning of the seson and run all those days
    var days = duration.asDays().toFixed()
    while (days > 0) {
        let dateToRun = moment.utc().subtract(days, 'days').format('YYYYMMDD')
        await stat_service.getCurrentStandingsByDate(dateToRun, rosterFile, standingsFile)
        days--
    }
}
app.use('/', router)
//Add some service to get the current stadning s points totals from store/standtings file
app.listen(process.env.PORT || 9280)
